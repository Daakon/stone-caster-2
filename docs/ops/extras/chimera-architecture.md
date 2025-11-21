# **Chimera System Architecture: The Master Blueprints**

**Version 3.4 \- Hub & Spoke Dependency Model (Final)**

This document serves as the definitive source of truth for the StoneCaster/Chimera Engine. It unifies the **Creator Layer** (Character/World/Ruleset creation) with the **Runtime Layer** (The Play Loop), detailing exactly how data flows from a static database entry to a dynamic game experience.

# **PART 1: THE CREATOR ARCHITECTURE (STATIC ASSETS)**

This section details how the static assets (Characters, Worlds, Rulesets) are structured before the game begins.

## **1\. The "Layered" Character Architecture**

A Player Character in Chimera is not a single flat file. It is a **Composite Object** built from three distinct layers during the Story Creation process.

### **Layer 1: Base Identity (Universal)**

* **Source:** base\_character.json (Hardcoded System Asset).  
* **Content:** Name, Pronouns, Age, Appearance, Backstory, Drive, Flaws.  
* **Behavior:** These fields *always* exist in every story, regardless of genre or rules. They feed primarily into the **Narrative (Tier 0\)** context.

### **Layer 2: World Context (Setting Specific)**

* **Source:** chimera\_worlds\[id\].character\_schema\_extensions.  
* **Content:** Setting-specific data (e.g., "Essence" for Mystika, "Cybernetics" for Sci-Fi).  
* **Behavior:** These fields are injected into the Character Creator UI. They often act as **Tags** for the AI or modifiers for Rulesets.

### **Layer 3: Ruleset Mechanics (Physics Specific)**

* **Source:** Aggregated from all active\_rulesets.  
* **Content:** Stats, Skills, Resource Bars.  
* **Behavior:** These are often *invisible* during initial creation (auto-calculated) OR appear as a point-buy step (e.g., "Distribute 50 points into Skills").

## **2\. Ruleset Architecture: The Hub & Spoke Model**

To solve the complexity of "Systems vs. Modifiers," we strictly define Rulesets by their **Dependency Relationship** (Backend) and their **Presentation Category** (Frontend).

### **A. Backend Logic (The Compiler's View)**

1. **Hubs (Foundations):** Standalone rulesets that define the "Physics" of the world. They often belong to strict exclusion\_groups (e.g., "You can't have D100 and D20 active simultaneously").  
2. **Spokes (Dependents):** Rulesets that *inject* content into a Hub. They **cannot** be loaded unless their specific Hub is active.

### **B. Frontend Presentation (The User's View)**

We use the ui\_category field to sort rulesets into a clear 3-Step Wizard for the user.

| UI Category | Description | UX Behavior |
| :---- | :---- | :---- |
| **Foundation** | The "Operating System" of the game. | **Step 1:** User picks 1 option per Exclusion Group (e.g., "Pick your Skill System"). |
| **Expansion** | Heavy mechanical add-ons (Code \+ State). | **Step 2:** User shops for compatible modules (e.g., "Add Magic", "Add Survival"). Filtered by selected Foundation. |
| **Flavor** | Narrative themes (State/Prompts only). | **Step 3:** "Vibe Check". Optional themes that tweak descriptions but rarely change math (e.g., "Gothic Horror"). |

## **3\. The Ruleset Catalog (Standard Library)**

This section defines the standard library of rulesets available to Creators.

### **A. Foundations (Core Physics)**

* **D100 Core (rs\_d100\_core)**:  
  * *Group:* skill\_engine  
  * *Provides:* \["d100\_mechanics", "skill\_based"\]  
* **Time Tracker (rs\_time\_simple)**:  
  * *Group:* time\_engine  
  * *Provides:* \["time\_tracking"\]

### **B. Expansions (Mechanical Modules)**

* **D100 Magic (rs\_d100\_magic)**:  
  * *Dependency:* rs\_d100\_core  
  * *Logic:* Injects mana state and cast\_spell actions into the D100 ecosystem.  
* **Survival Needs (rs\_survival\_basic)**:  
  * *Dependency:* rs\_time\_simple  
  * *Logic:* Hooks into the time loop to trigger hunger/thirst updates.  
* **Inventory Grid (rs\_inventory\_grid)**:  
  * *Dependency:* None (Global)  
  * *Logic:* Adds slot-based inventory management.

### **C. Flavor (Narrative Themes)**

* **Gothic Horror (rs\_theme\_gothic)**:  
  * *Dependency:* None (Global)  
  * *Logic:* Injects AI instructions: "Describe scenes with dread, decay, and shadow." No new math.  
* **High Fantasy (rs\_theme\_heroic)**:  
  * *Dependency:* None  
  * *Logic:* Injects AI instructions: "Focus on heroism, vibrant colors, and epic scale."

# **PART 2: THE COMPILER (TRANSFORMATION LAYER)**

State: Processing (Triggered on "Play" or "Save")  
Responsibility: Validation, Merging, and Optimization.  
The Compiler turns "Raw Ideas" into a "Playable Artifact" (compiled\_story\_json).

### **Step 1: Base Load & Injection**

1. Load base\_character.json.  
2. Inject World Schema (Layer 2\) into the Character Template.

### **Step 2: Dependency Resolution (Topological Validation)**

The Compiler performs a strict validity check before merging data.

1. **Exclusion Check:**  
   * Iterate through active rulesets.  
   * Map { group\_name: \[ruleset\_ids\] }.  
   * **Constraint:** If any group has \> 1 ID, Throw Error: *"Conflict: Multiple systems selected for 'skill\_engine'."*  
2. **Dependency Check:**  
   * Iterate through active rulesets.  
   * If ruleset.dependencies is not empty:  
   * **Constraint:** Verify every ID in dependencies exists in the active\_ruleset\_ids list.  
   * If missing, Throw Error: *"Missing Dependency: 'Advanced Combat' requires 'D100 Core'."*  
3. **Tag Aggregation:**  
   * Collect all provides\_tags from active rulesets.  
   * Store in compiled\_story\_json.meta.tags (e.g., \["has\_magic", "is\_survival"\]).

### **Step 3: Master Allowlist Generation**

The Compiler merges all valid rulesets to determine what variables are "Real Mechanics" (Tier 1\) vs "Flavor Text" (Tier 0).

1. **Merge:** Combine all state\_keys from active rulesets into a **Tier 1 Allowlist**.  
2. **Merge:** Combine all narrative\_keys into a **Tier 0 Allowlist**.  
3. **Merge:** Combine all actions into a consolidated **Action Map**.

### **Step 4: Entity Processing (The Filter)**

The Compiler iterates through every Entity Template linked to the story.

1. **Input:** Entity raw\_data (e.g., { "hp": 100, "mana": 50, "backstory": "..." }).  
2. **Check:** For each key:  
   * **If in Tier 1 Allowlist:** Move to tier1\_mechanical\_state (Engine Accessible).  
   * **If in Tier 0 Allowlist:** Move to tier0\_narrative\_context (RAG Accessible).  
   * **If in Neither:** **Discard** (Data pruning for performance).  
3. **Result:** A ChimeraGameInstance where mechanics are strictly separated from flavor.

# **PART 3: THE RUNTIME LOOP (THE PLAY ENGINE)**

State: Active / Recursive  
Responsibility: Execution of the Game Loop.  
The loop consists of three distinct steps triggered by User Input.

### **Step 1: MAS 1 (The Interpreter)**

**Role:** Translate Chaos (Text) into Order (JSON).

* **Input:**  
  * User Prompt ("I shoot the goblin.")  
  * available\_actions (Derived from the Compiled Action Map).  
  * Short-term History.  
* **Process:**  
  1. **Intent Parsing:** Analyze Intent using parser\_prompt\_rules.  
  2. **Mapping:** Map Intent to a valid Action Key (e.g., shoot\_weapon).  
  3. **Extraction:** Extract Parameters (Target: goblin, Weapon: pistol).  
  4. **Sentiment Analysis:** Analyze Tone (e.g., aggressive, hesitant).  
* **Output:** Mas1ResponseDto (contains ActionDto).  
* **Constraint:** MAS 1 **CANNOT** change state. It is read-only.

### **Step 2: The Engine (The Resolver)**

**Role:** Deterministic Truth (Math & Logic).

* **Input:**  
  * ActionDto (from MAS 1).  
  * tier1\_mechanical\_state (Current Game State).  
  * action\_logic (from Compiled Ruleset).  
* **Process:**  
  1. **Validation:** Can the user afford the cost? Is the target valid?  
  2. **Execution:** Run the specific logic (e.g., D100 \+ Skill vs Defense).  
  3. **Calculation:** Compute numeric deltas (e.g., target\_hp \- 20, ammo \- 1).  
* **Output:** EngineResultDto (Success/Fail \+ Numeric Deltas).  
* **State Change:** **Immediate update** to tier1\_mechanical\_state.

### **Step 3: MAS 2 (The Narrator)**

**Role:** The Dungeon Master (Story & Memory).

* **Input:**  
  * EngineResultDto (The cold hard facts).  
  * Mas1ResponseDto (The user's original sentiment).  
  * tier0\_narrative\_context (Lore, Backstory).  
  * narrator\_prompt\_rules (Style guide).  
* **Process:**  
  1. **Narration:** Generate the "Ripple Narrative" text describing the outcome.  
  2. **Mutation:** Determine how this changes the story (e.g., "The goblin is now afraid").  
* **Output:** Mas2ResponseDto (Text \+ MutationDto).  
* **State Change:** **Immediate update** to tier0\_narrative\_state via Mutations.

# **PART 4: THE VIEW LAYER (FRONTEND)**

State: Rendering  
Responsibility: Visualizing the Abstract.

* **Input:** The current Game State (Tier 1 \+ Tier 0\) \+ The latest Ripple Narrative.  
* **Process:**  
  1. Filter out hidden/internal state.  
  2. Format data for UI components (Health Bars, Text Log, Inventory).  
* **Output:** ClientViewDto.

**State Sync:**

* The Frontend polls for ClientViewDto or receives it via WebSocket.  
* **MVP UI Components:**  
  * **Status Bar:** Renders health, stamina (if Physics/Combat active).  
  * **Action Bar:** Dynamic buttons based on valid\_next\_actions (e.g., Only show "Attack" if an entity is hostile).  
  * **Log:** Renders the narrative\_stream.