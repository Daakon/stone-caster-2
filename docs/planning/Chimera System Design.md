# **Chimera System: Unified Specification**

Version 4.0 \- Combined Architecture & Contracts  
Status: Definitive Source of Truth  
This document unifies the **Architectural Blueprints** (Logic & Flow) with the **Data Enforcement Contracts** (TypeScript Interfaces). It serves as the primary reference for implementing the StoneCaster/Chimera Engine.

Note on Data Examples:  
This document defines the structure and logic. For concrete JSON examples of Rulesets (D100, Survival, etc.), refer to the external file: chimera\_full\_schemas.json.

# **PART 1: THE CREATOR LAYER**

**Domain:** Static Assets, Database, Authoring Tools.

## **1.1 Shared Primitives**

Before defining the core assets, we establish the standard shape for visual assets hosted on Cloudflare.

/\*\* \* Standard object for all visual media (Cloudflare hosted).  
 \* Used in Worlds, Entities, Rulesets, and Story Metadata.  
 \*/  
interface ChimeraAssetRef {  
  id: string;               // Cloudflare ID or Internal UUID  
  url: string;              // Full CDN URL  
  role: "icon" | "banner" | "portrait" | "gallery"; // UI placement hint  
  label?: string;           // Alt text / Caption  
}

## **1.2 The "Layered" Character Architecture**

A Player Character in Chimera is not a single flat file. It is a **Composite Object** built from three distinct layers during the Story Creation process.

1. **Layer 1: Base Identity (Universal)**  
   * *Source:* base\_character.json (System Asset).  
   * *Content:* Name, Pronouns, Age, Appearance, Backstory.  
   * *Behavior:* These fields always exist. They feed primarily into the **Tier 0 Narrative Context**.  
2. **Layer 2: World Context (Setting Specific)**  
   * *Source:* chimera\_worlds\[id\].character\_schema\_extensions.  
   * *Content:* Setting-specific data (e.g., "Essence", "Cybernetics").  
   * *Behavior:* Injected into the Character Creator UI; acts as narrative tags.  
3. **Layer 3: Ruleset Mechanics (Physics Specific)**  
   * *Source:* Aggregated from active\_rulesets.  
   * *Content:* Stats, Skills, Resource Bars (e.g., HP, Mana).  
   * *Behavior:* Auto-calculated or point-buy values feeding **Tier 1 Mechanical State**.

### **Contract: World Definition (chimera\_worlds)**

interface WorldDefinition {  
  id: string;  
  name: string;  
  description: string;  
    
  // VISUALS  
  images: ChimeraAssetRef\[\]; 

  // Layer 2: World-Specific Character Fields  
  character\_schema\_extensions: {  
    \[key: string\]: {  
      label: string;  
      type: "text" | "number" | "dropdown" | "radio";  
      options?: string\[\];  
      required: boolean;  
    }  
  };

  // Static RAG Data (History, Geography, etc.)  
  lore\_fragments: {  
    id: string;  
    triggers: string\[\];        // Keywords: \["king", "war"\]  
    content: string;           // The actual text chunk  
    metadata?: { tags: string\[\] };  
  }\[\];  
}

### **Contract: Entity Template (chimera\_entities)**

interface EntityTemplate {  
  id: string;  
  name: string;

  // VISUALS  
  images: ChimeraAssetRef\[\];   
    
  // The "Blob" \- Contains BOTH mechanics (hp) and flavor (eyes)  
  // The Compiler sorts this based on active Rulesets (See Part 2).  
  raw\_data: {  
    \[key: string\]: any;        // e.g., { "strength": 18, "eye\_color": "blue" }  
  };  
}

## **1.3 Ruleset Architecture: The Hub & Spoke Model**

To manage complexity, Rulesets are strictly categorized by their dependency relationship (Backend) and presentation category (Frontend).

### **A. Backend Logic**

* **Hubs (Foundations):** Standalone rulesets defining "Physics". Belong to strict **Exclusion Groups** (e.g., skill\_engine). Only one per group allowed.  
* **Spokes (Expansions):** Rulesets that inject content into a Hub. **Cannot** load unless their Hub is active.

### **B. Frontend Presentation (The 3-Step Wizard)**

* **Step 1: Foundations:** User picks the "Operating System" (e.g., D100 vs D20).  
* **Step 2: Expansions:** User shops for compatible modules (e.g., Magic, Survival). Filtered by Foundation.  
* **Step 3: Flavor:** User selects narrative themes (e.g., Gothic Horror).

### **Contract: Ruleset Definition (chimera\_rulesets)**

interface RulesetDefinition {  
  id: string;                  // e.g., "rs\_d100\_magic"  
  name: string;  
    
  // VISUALS  
  icon\_url?: string;   
    
  // Frontend Categorization  
  ui\_category: "foundation" | "expansion" | "flavor";  
    
  // Validation Logic  
  exclusion\_group?: string;    // e.g., "skill\_engine" (Only 1 allowed per story)  
  dependencies: string\[\];      // e.g., \["rs\_d100\_core"\] (Must exist to load this)  
    
  // Compiler Metadata  
  provides\_tags: string\[\];     // e.g., \["magic\_enabled", "has\_sanity"\]  
    
  // Schema Contributions (What keys does this add?)  
  state\_contributions: {  
    tier1\_entity?: string\[\];   // Mechanical keys (e.g., "mana", "hp")  
    tier1\_global?: string\[\];   // Global keys (e.g., "time", "weather")  
  };

  // Execution Logic (Pseudo-code or Function Refs)  
  actions: {  
    \[action\_key: string\]: {    // e.g., "cast\_spell"  
      logic: string;           // e.g., "d100\_roll\_under(skills.arcana)"  
      cost?: { resource: string; amount: number };  
    }  
  };

  // AI Guidance  
  ai\_instructions: {  
    mas1?: string;             // "Map 'blast' to 'cast\_spell'"  
    mas2?: string;             // "Describe magical recoil"  
  };  
}

# **PART 2: THE COMPILER LAYER**

**Domain:** Transformation Logic, Validation, Build Artifacts.

## **2.1 Compiler Logic: The 4-Step Process**

When a user clicks "Play", the Compiler transforms raw assets into a playable artifact.

### **Step 1: Base Load & Injection**

1. Load base\_character.json.  
2. Inject World Schema (Layer 2\) into the Character Template.

### **Step 2: Dependency Resolution (Topological Validation)**

1. **Exclusion Check:** Iterate through active rulesets. If any exclusion\_group has \> 1 ID, throw Conflict Error.  
2. **Dependency Check:** Iterate through active rulesets. Verify every ID in dependencies exists in active\_ruleset\_ids. If missing, throw Missing Dependency Error.  
3. **Tag Aggregation:** Collect all provides\_tags and store in meta.tags.

### **Step 3: Master Allowlist Generation**

1. **Merge:** Combine all state\_keys from active rulesets into tier1\_allowlist.  
2. **Merge:** Combine all narrative\_keys into tier0\_allowlist.  
3. **Merge:** Combine all actions into actions\_map.

### **Step 4: Entity Processing (The Filter)**

The Compiler iterates through every Entity Template:

1. **Check Keys:** For each key in raw\_data:  
   * If in Tier 1 Allowlist \-\> Move to tier1\_mechanical\_state.  
   * If in Tier 0 Allowlist \-\> Move to tier0\_narrative\_context.  
   * If in Neither \-\> Discard.  
2. **Result:** A clean ChimeraGameInstance separated into Tier 0 and Tier 1\.

## **2.2 Contract: Compiled Artifact (runtime\_memory)**

/\*\*  
 \* The single object loaded into the Game Engine.  
 \*/  
interface CompiledStory {  
  meta: {  
    story\_id: string;  
    title: string;  
      
    // VISUALS (Story Cover Art)  
    images: ChimeraAssetRef\[\];

    active\_ruleset\_ids: string\[\];  
    tags: string\[\];            // Aggregated from rulesets  
  };

  // The "Allowlist" \- generated by merging all Rulesets  
  master\_schema: {  
    tier1\_allowlist: string\[\]; // Keys allowed in Mechanical State  
    tier0\_allowlist: string\[\]; // Keys allowed in Narrative State  
    actions\_map: {             // Map of executable actions  
      \[key: string\]: { source\_ruleset: string; logic: any };  
    };  
    prompt\_instructions: {     // Aggregated AI rules  
      mas1: string\[\];  
      mas2: string\[\];  
    };  
  };

  // The RAG Index (World Lore \+ Entity Backstories)  
  narrative\_context\_index: {  
    id: string;  
    vector?: number\[\];         // Embedding  
    content: string;  
  }\[\];

  // The Initial State  
  initial\_state: GameState;  
}

# **PART 3: THE RUNTIME LAYER**

**Domain:** Gameplay Loop, State Management, AI Processing.

## **3.1 Logic: The Runtime Loop**

The loop consists of three distinct steps triggered by User Input.

### **Step 1: MAS 1 (The Interpreter)**

* **Input:** User Prompt \+ available\_actions \+ History.  
* **Process:** Parse Intent \-\> Map to Action Key \-\> Extract Params \-\> Analyze Sentiment.  
* **Output:** Mas1ResponseDto.  
* **Constraint:** Read-Only. Cannot change state.

### **Step 2: The Engine (The Resolver)**

* **Input:** ActionDto \+ Tier1State.  
* **Process:** Validate Cost \-\> Execute Logic (Math) \-\> Calculate Deltas.  
* **Output:** EngineResultDto.  
* **State Change:** Updates tier1\_mechanical\_state.

### **Step 3: MAS 2 (The Narrator)**

* **Input:** EngineResultDto \+ Sentiment \+ Tier0State \+ Lore.  
* **Process:** Narrate Result \-\> Determine Narrative Mutations (e.g. "Goblin is afraid").  
* **Output:** Mas2ResponseDto.  
* **State Change:** Updates tier0\_narrative\_state.

## **3.2 Contract: Game State (The Save File)**

interface GameState {  
  // TIER 1: Mechanical (Math-heavy, Ruleset-managed)  
  tier1\_mechanical: {  
    global: { \[key: string\]: any };    // Time, Weather  
    entities: {  
      \[instance\_id: string\]: {         // e.g., "player\_1", "goblin\_A"  
        \[key: string\]: any;            // hp: 10, mana: 5  
      };  
    };  
  };

  // TIER 0: Narrative (Text-heavy, AI-managed)  
  tier0\_narrative: {  
    memory\_stream: string\[\];           // Chronological log  
    entities: {  
      \[instance\_id: string\]: {  
        backstory: string;  
        // VISUALS (Persisted here for runtime access)  
        images: ChimeraAssetRef\[\];   
        appearance: string;  
        relationships: { \[target: string\]: string }; // "trust: high"  
      };  
    };  
  };  
}

## **3.3 Contract: Loop DTOs**

/\*\*  
 \* Output from MAS 1 (Action Parser)  
 \*/  
interface Mas1ResponseDto {  
  resolved\_query: string;              // "Player attacks Goblin A with Sword"  
    
  sentiment: {  
    tone: string;                      // "Aggressive", "Hesitant"  
    intensity: number;                 // 1-10  
  };

  action\_dto: {  
    action\_key: string;                // Must match master\_schema  
    target\_id?: string;                // UUID of entity  
    parameters?: { \[key: string\]: any }; // "weapon": "sword"  
  };  
}

/\*\*  
 \* Output from Engine (Determinism)  
 \*/  
interface EngineResultDto {  
  success: boolean;  
    
  // Immediate State Changes (Math)  
  numeric\_deltas: {  
    \[path: string\]: number;            // "entities.goblin\_A.hp": \-15  
  };  
    
  // Summary for the AI  
  outcome\_summary: string;             // "Attack Hit. Damage 15\. Goblin HP now 0."  
}

/\*\*  
 \* Output from MAS 2 (Narrator)  
 \*/  
interface Mas2ResponseDto {  
  ripple\_narrative: string;            // The final story text shown to user.

  // Narrative State Changes (Soft Data)  
  mutations: {  
    op: "add" | "replace" | "remove";  
    path: string;                      // "entities.goblin\_A.narrative.description"  
    value: any;                        // "A headless corpse."  
  }\[\];  
}

## **3.4 The View Layer**

* **Role:** Render the current state (Tier 1 \+ Tier 0\) \+ Latest Narrative.  
* **Output:** ClientViewDto (Optimized JSON for React Frontend).  
* **Logic:** Filters hidden state; Formats data for UI components (Status Bars, Logs).

# **PART 4: STANDARD LIBRARY REFERENCE**

Domain: Catalog of Default Rulesets.  
For full JSON data, refer to chimera\_full\_schemas.json

### **Foundations (Core Physics)**

| ID | Group | Tags | Description |
| :---- | :---- | :---- | :---- |
| rs\_d100\_core | skill\_engine | mechanics\_d100, skills | Percentile-based physics. Roll under Skill Level. |
| rs\_time\_simple | time\_engine | mechanics\_time | Day/Night cycle and Time tracking. |

### **Expansions (Modules)**

| ID | Dependency | Group | Description |
| :---- | :---- | :---- | :---- |
| rs\_d100\_magic | rs\_d100\_core | magic\_system | Adds Mana and Spells to D100. |
| rs\_survival\_basic | rs\_time\_simple | \- | Adds Hunger/Thirst degradation over time. |
| rs\_health\_simple | \- | health\_system | Standard HP/MaxHP logic. |
| rs\_inventory\_slots | \- | inventory\_system | Slot-based inventory management. |

### **Flavor (Themes)**

| ID | Description |
| :---- | :---- |
| rs\_theme\_gothic | Instructs AI to use a lexicon of decay, shadows, and tension. |
| rs\_theme\_steampunk | Re-skins items to appear mechanical (brass, steam, gears). |

