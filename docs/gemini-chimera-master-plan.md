# **Project Chimera: Greenfield Master Specification**

**Directives:**

1. **Greenfield Implementation:** Ignore existing legacy code or data. Overwrite or drop tables/files as needed.  
2. **Architecture:** Implement the "Casting Circle" Creator, 4-Step Compiler, and 3-Layer Runtime.

---

## **Section 1: Domain & Data Models**

*Use these definitions for all Schema and Type generation.*

### **1.1 The Story Dimension (The "Casting Circle")**

A compiled story is composed of four distinct "Stones" (Asset Types):

* **World Stone:** The setting container.  
* **Forces Stone:** The active Rulesets (mechanics).  
* **Elements Stone:** Entities (NPCs, locations) and items.  
* **Lore Stone:** Narrative fragments for RAG injection.

### **1.2 Key Data Structures (Types)**

**`ChimeraAssetRef`**

* **Structure:** `{ id: string, url: string, role: 'icon'|'banner'|'portrait'|'gallery', label?: string }`  
* **Usage:** Used for visual assets across Worlds and Rulesets.

**`WorldDefinition`**

* **Core Fields:** `id`, `name`, `description`, `schema_version`.  
* **Visuals:** `images: ChimeraAssetRef[]` (Must support multiple images per world).  
* **Lore:** `lore_fragments: LoreFragment[]` (Narrative chunks for AI context).  
* **Schema:** `character_schema_extensions` (Defines world-specific fields like "Faction" or "Origin").

**`RulesetDefinition` (The Hub & Spoke Model)**

* **UI Category:** `foundation` (System), `expansion` (Subsystem), or `flavor` (Modifier).  
* **Constraints:** `exclusion_group` (string, nullable), `dependencies` (string\[\] of Ruleset IDs).  
* **Logic:** `actions` (Definition of mechanical moves), `state_contributions` (Initial state keys), `ai_instructions` (Prompt guidelines).  
* **Visuals:** `icon_url`, `banner_url` (via `ChimeraAssetRef`).

**`CompiledStory`**

* **Meta:** Source IDs for World/Rulesets.  
* **Master Schema:** `tier1_allowlist` (Mechanical keys), `tier0_allowlist` (Narrative keys), `actions_map`.  
* **Narrative Index:** RAG-ready index of Lore fragments.  
* **Initial State:** The starting `GameState`.

**`GameState` (Runtime)**

* **Tier 1 (Mechanical):** Strict JSON structure for HP, Stats, Inventory. Only modified by `Engine`.  
* **Tier 0 (Narrative):** Flexible JSON structure for Memories, Relationships, History. Modified by `MAS2` (Narrator).

---

## **Section 2: Implementation Phases & Logic**

### **Phase 1: Database & System Assets**

**Goal:** Establish the "Greenfield" storage layer.

1. **Schema Migration:**  
   * `DROP` existing `chimera_worlds`, `chimera_rulesets`, `chimera_entities`, `chimera_game_states`.  
   * `CREATE` tables strictly matching the Data Models above using `JSONB` for complex structures (`images`, `actions`, `lore_fragments`).  
2. **Base Character Asset:**  
   * Create `content/system/base_character.json`. This is **Layer 1** of the character (Name, Pronouns, Bio, basic stats).  
   * It serves as the root template before World or Ruleset modifications are applied.

### **Phase 2: The Creator (Services & UI)**

**Goal:** Enable the "Casting Circle" workflow.

1. **Ruleset Service (Hub & Spoke Validation):**  
   * Enforce: Exactly one `foundation` ruleset per story.  
   * Enforce: `expansion` dependencies must be present in the selection list.  
   * Enforce: Only one ruleset per `exclusion_group` (e.g., cannot have two "Magic Systems" if they share a group).  
2. **World & Asset Service:**  
   * Handle Cloudflare image uploads and generate `ChimeraAssetRef`.  
   * Save `lore_fragments` for RAG processing.

### **Phase 3: The Compiler Logic (The "4-Step Process")**

**Goal:** Deterministic Story Generation. *Strictly follow this order*:

1. **Step 1: Base Load & Injection:**  
   * Load `base_character.json`.  
   * Inject `world.character_schema_extensions` into the schema.  
2. **Step 2: Resolution:**  
   * Validate Ruleset Dependencies.  
   * Reject Exclusion Group conflicts.  
   * Aggregate global tags.  
3. **Step 3: Allowlist Generation:**  
   * Merge all `ruleset.state_contributions` \-\> `tier1_allowlist` / `tier0_allowlist`.  
   * Merge all `ruleset.actions` \-\> `actions_map`.  
4. **Step 4: Entity Filtering:**  
   * Iterate through selected Entities (NPCs/Items).  
   * Discard any keys in their `raw_data` that do not exist in the Allowlists.  
   * Sort remaining data into `tier1` or `tier0` buckets in the final `CompiledStory`.

### **Phase 4: The Runtime Loop (MAS1 \-\> Engine \-\> MAS2)**

**Goal:** The Gameplay Cycle.

1. **Runtime DTOs:** Define these specifically in `shared/src/types/chimera-runtime.ts`.  
   * `Mas1ResponseDto`: `{ action_slug: string, parameters: any, sentiment: string }`  
   * `EngineResultDto`: `{ success: boolean, numeric_deltas: Record<string, number>, outcome_summary: string }`  
   * `Mas2ResponseDto`: `{ ripple_narrative: string, tier0_mutations: Record<string, any> }`  
2. **Execution Flow:**  
   * User Input \-\> **MAS1** (Interprets Intent via `actions_map`).  
   * MAS1 Output \-\> **Engine** (Calculates Mechanics, validates costs, updates Tier 1).  
   * Engine Output \-\> **MAS2** (Writes Narrative, checks Lore/Sentiment, updates Tier 0).

### **Phase 5: Validation**

* Seed the DB with Standard Library rulesets (`d100_core`, `survival_basic`) to test the compiler.

---

## **Section 3: Prompt Strategy (How to use this)**

*When starting the chat, provide the context above, then ask for these specific artifacts in order:*

1. **"Generate the SQL Schema"**: Ask for the PostgreSQL migration script for `worlds`, `rulesets`, and `game_states` based on Section 1 & 2\.  
2. **"Generate the Types"**: Ask for the TypeScript interfaces (`ChimeraAssetRef`, `RulesetDefinition`, Runtime DTOs) for `shared/src/types`.  
3. **"Generate the Compiler"**: Ask for the `CompilerService` class implementing the logic in Section 3 (Phase 3).  
4. **"Generate the Runtime"**: Ask for the `GameLoopService` implementing the logic in Section 3 (Phase 4).

