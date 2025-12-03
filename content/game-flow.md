# StoneCaster Game Flow Specification (v2.1)

**Context:** The execution pipeline from Content Creation to Runtime.
**Architecture:** Compiler-Safe (Strict Logic/Data Separation).

---

## Phase 1: content_initialization

### 1. Content Creation & Selection
* **User Action:** Player creates a Story and selects Rulesets.
* **System Check:** The UI enforces that entities have the necessary form fields defined in `state_contributions`.

### 2. The Compiler (Static Assembly)
* **Pipeline Validation:** Checks `pipeline_compatibility` of all selected rulesets.
* **Intent Aggregation:** Merges `intent_keywords` into a single **Master Intent Map** for MAS 1.
* **Prompt Template Assembly:**
    * Aggregates `style_injections` (Tone, Formatting).
    * Resolves conflicts using `priority` and `unique_id`.
    * Builds the static "System Instructions" block for MAS 2.
    * Compiles a list of `state_readouts` (pointers to data).
* **Logic Validation:** Validates all Ruleset Actions against the Engine Registry Schema. **(No Eval Check)**.

### 3. Story Start (Instantiation)
* **State Gen:** The Engine creates the initial JSON State Tree (World, Player, NPCs).
* **Data Injection:** Values from creation forms are injected into the State.

---

## Phase 2: runtime_loop

### 4. Game Initialization
* The Runtime loads the **Compiled Master Template** (from Step 2) and the **Current State** (from Step 3).

### 5. Game Turn (Player Input)
* **User Action:** Player inputs text (e.g., "I bandage my leg.").

### 6. Input Processing (MAS 1 - The Interpreter)
* **Input:** User Text + **Master Intent Map** (from Step 2).
* **Process:**
    * Scans text for `intent_keywords` (e.g., "bandage" -> `action_medical_check`).
    * Checks `sentiment_thresholds`.
* **Output:** structured JSON Action Request (e.g., `{ "trigger_id": "action_medical_check", "target": "self" }`).

### 7. Chimera Engine Processing (The Logic)
* **Input:** MAS 1 JSON Request + Current State.
* **Process:**
    * **Trigger Match:** Finds the Ruleset Action matching `trigger_id`.
    * **Pipeline Execution:** Runs the `logic` steps sequentially.
        * *Step A:* Resolve Roll (Stores result in `temp_var`).
        * *Step B:* Check Condition (e.g., `temp_var == success`).
        * *Step C:* Mutate State (Updates `blood_loss`).
    * **Logging:** Writes results to `tier1_global.event_log`.
* **Security:** **NO AI** is involved in this step. All logic is deterministic Engine code.

### 8. Prompt Assembly (Runtime Execution)
* **Action:** The Engine constructs the final prompt for MAS 2 using the **Compiled Template**.
* **Step A (Static):** Loads the "System Instructions" (Tone/Style from Step 2).
* **Step B (Dynamic Fetch):** Iterates through the template's `state_readouts`.
    * *Read Path:* `tier1_entity.injury_description`
    * *Fetch Value:* "Bleeding profusely"
    * *Format:* Label as `[VISIBLE WOUNDS]`
* **Step C (Logs):** Appends the recent `event_log` from Step 7.

### 9. MAS 2 Processing (The Narrator)
* **Input:** The fully assembled Prompt (Instructions + Context + Logs).
* **Constraint:** **Read-Only Context.** MAS 2 cannot see the raw State Tree, only the `state_readouts`.
* **Process:** Generates narrative prose adhering to the injected Style/Tone.
* **Output:**
    * Narrative Text (displayed to user).
    * **System Tags Only:** (e.g., `[SCENE_END]`).
    * **Prohibited:** MAS 2 cannot output JSON state changes (e.g., `{"hp": -10}`). This ensures the AI cannot hallucinate game rules.

### 10. Post-Narrative Processing
* **Process:** Engine parses narrative for System Tags.
* **Cleanup:** Flushes `event_log` and prepares for the next turn.