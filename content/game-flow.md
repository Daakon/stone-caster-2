# StoneCaster Game Flow Specification (v2.0)

**Context:** The execution pipeline from Content Creation to Runtime.
**Architecture:** v3.0 Ruleset Compatible (Compiler-Driven State Injection).

---

## Phase 1: content_initialization

### 1. Content Creation & Selection
* **User Action:** Player creates a Story and selects Rulesets (e.g., "Survival Core", "Grimdark Expansion").
* **System Check:** The UI enforces that entities have the necessary form fields defined in `state_contributions` (e.g., "Hunger Slider").

### 2. The Compiler (Static Assembly)
* **Pipeline Validation:** Checks `pipeline_compatibility` of all selected rulesets to ensure they match the Engine Version.
* **Intent Aggregation:** Merges `intent_keywords` from all rulesets into a single **Master Intent Map** for MAS 1.
* **Prompt Template Assembly:**
    * Aggregates `style_injections` (Tone, Formatting).
    * Resolves conflicts using `priority` and `unique_id`.
    * Builds the static "System Instructions" block for MAS 2.
    * Compiles a list of `state_readouts` (pointers to data) required for the dynamic context.

### 3. Story Start (Instantiation)
* **State Gen:** The Engine creates the initial JSON State Tree (World, Player, NPCs).
* **Data Injection:** Values from the creation forms (Step 1) are injected into the State (e.g., `hunger: 0`).

---

## Phase 2: runtime_loop

### 4. Game Initialization
* The Runtime loads the **Compiled Master Template** (from Step 2) and the **Current State** (from Step 3).

### 5. Game Turn (Player Input)
* **User Action:** Player inputs text (e.g., "I bandage my leg.").

### 6. Input Processing (MAS 1 - The Interpreter)
* **Input:** User Text + **Master Intent Map** (from Step 2).
* **Process:**
    * Scans text for `intent_keywords` (e.g., "bandage" -> `skills.medicine`).
    * Checks `sentiment_thresholds`.
    * Extracts parameters defined in `param_extraction`.
* **Output:** structured JSON Action Request (e.g., `{ "verb": "heal", "target": "self" }`).

### 7. Chimera Engine Processing (The Logic)
* **Input:** MAS 1 JSON Request + Current State.
* **Process:**
    * Executes Ruleset `actions` (Logic/Math).
    * Updates **State Variables** (e.g., `blood_loss: 40`).
    * Writes to **Event Logs** (e.g., Appends "Bandaging failed" to `tier1_global.event_log`).
* **Constraint:** The Engine **NEVER** writes to the Prompt directly. It only mutates State.

### 8. Prompt Creation for MAS 2 (The Assembler)
* **Action:** The Compiler constructs the final prompt for the LLM.
* **Step A (Static):** Loads the "System Instructions" (Tone/Style from Step 2).
* **Step B (Dynamic Fetch):** Iterates through the compiled `state_readouts` list.
    * *Read:* `tier1_entity.injury_description`
    * *Fetch Value:* "Bleeding profusely"
    * *Format:* Label as `[VISIBLE WOUNDS]`
* **Step C (Logs):** Appends the recent `event_log` from Step 7.

### 9. MAS 2 Processing (The Narrator)
* **Input:** The fully assembled Prompt (Instructions + Context + Logs).
* **Process:** Generates narrative prose adhering to the injected Style/Tone.
* **Output:**
    * Narrative Text (displayed to user).
    * Optional JSON side-effects (e.g., `{"remove_item": "bandage"}`).

### 10. Post-Narrative Processing
* **Process:** Engine executes any side-effects returned by MAS 2.
* **Cleanup:** Flushes `event_log` and prepares for the next turn.