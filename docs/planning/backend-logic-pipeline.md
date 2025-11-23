# StoneCaster Architecture: The Backend-Logic Pipeline

**Version:** 1.0 (Aligns with Ruleset Library v1.8)
**Core Philosophy:** "The Engine calculates truth; The AI describes it."

This architecture removes mathematical logic from the LLM prompts, ensuring deterministic gameplay and reducing token costs. It relies on a specific data flow between the **Compiler**, **MAS1 (Interpreter)**, **Chimera Engine**, and **MAS2 (Narrator)**.

---

## 1. The Compiler Strategy (Semantic Aggregation)
The Story Compiler does not just dump JSON into the System Prompt. It parses the **Semantic Keys** in `ai_instructions` to build optimized, role-specific prompts.

### 1.1 Aggregation Logic
When compiling a story, the system iterates through all active rulesets and merges their instructions into distinct buckets:

* **Bucket A: `intent_mappings` (For MAS1)**
    * *Compiler Action:* Collects all mappings into a single dictionary.
    * *Result:* A master list of verbs the user can trigger (e.g., "Threats -> Intimidate").
* **Bucket B: `mechanical_triggers` (For MAS1)**
    * *Compiler Action:* Merges logic rules for when to trigger system actions.
* **Bucket C: `tone_instructions` / `framing_instructions` (For MAS2)**
    * *Compiler Action:* Concatenates these into the "Style Guide" section of the prompt.
* **Bucket D: `outcome_instructions` (For MAS2)**
    * *Compiler Action:* Merges into the "Resolution Guide."

### 1.2 The "Narrative Cues" Bridge
The Compiler ensures every Entity has a `narrative_cues` object in its state. This object acts as the **Read-Only Interface** for the AI.
* **Engine:** Writes to `narrative_cues` (e.g., `distraction_level = "Severe"`).
* **AI:** Reads from `narrative_cues` (e.g., "If Severe, describe pain").

---

## 2. The Runtime Pipeline (Step-by-Step)

### Step 1: MAS1 (The Interpreter)
**Input:** User Natural Language (e.g., "I get in his face and shout!")
**Context:** The compiled `intent_mappings` list.
**Process:**
1.  MAS1 scans the user text against the mappings.
2.  It identifies the best match: `Threats -> 'intimidate'`.
3.  It outputs a structured **Intent Object**: `{ "action": "intimidate", "target": "npc_guard" }`.

### Step 2: Chimera Engine (The Logic Core)
**Input:** The Intent Object from MAS1.
**Process:**
1.  **Execute Action:** Runs the logic for `intimidate`.
    * *Math:* Rolls D100 vs Skill.
    * *State Update:* Updates `relationships.respect` (+10).
2.  **Trigger System Auto:** The Engine detects `relationships` changed. It fires `update_social_cues` (from *Relationship Dynamics* ruleset).
    * *Logic Check:* `if respect > 70`? True.
    * *Cue Update:* Sets `narrative_cues.social_tone = "Deferential"`.
3.  **Update Cues:** The action itself updates specific cues (e.g., `narrative_cues.target_reaction = "Cower"`).

### Step 3: MAS2 (The Narrator)
**Input:** The updated State (specifically `narrative_cues`) and the `outcome_instructions`.
**Process:**
1.  **No Calculation:** MAS2 does *not* look at the raw numbers (Respect: 80).
2.  **Read Cues:** It looks at `narrative_cues`:
    * `social_tone`: "Deferential"
    * `target_reaction`: "Cower"
3.  **Generate Prose:** "The guard stumbles back, eyes wide. 'I-I didn't know it was you,' he stammers, bowing his head low."

---

## 3. Data Flow Example

Here is a trace of the "Survival Needs" logic.

| Component | Action / Data | Notes |
| :--- | :--- | :--- |
| **Engine (Turn End)** | `fatigue.current` increases to **85**. | Mechanical update. |
| **Engine (Auto)** | Triggers `check_needs` action. | Found in *Survival Needs* ruleset. |
| **Logic** | `if fatigue > 70 then needs.hunger += 10`. | Hunger is now **55**. |
| **Logic** | `if needs.hunger > 50 then narrative_cues.distraction_level = 'Mild'`. | Updates the cue. |
| **Compiler** | Passes `narrative_cues` to MAS2. | |
| **MAS2** | Reads `distraction_level: Mild`. | Instruction: "Mention discomfort." |
| **Output** | *"You feel a gnawing emptiness in your stomach, but you push on."* | Deterministic output. |

---

## 4. Implementation Checklist

### For the Compiler Engineer
* [ ] **Parser:** Ensure the Compiler separates `ai_instructions` keys (`intent_mappings`, `tone_instructions`, etc.) rather than passing the whole blob.
* [ ] **State Init:** Ensure `narrative_cues` is initialized for every entity, even if empty.

### For the Engine Engineer
* [ ] **Auto-Triggers:** Implement the listener system that fires `system_auto` actions when their `trigger` condition (e.g., `on_stat_change`) is met.
* [ ] **Cue Storage:** Ensure `narrative_cues` is treated as ephemeral state (recalculated often) or persistent state (saved to DB), depending on persistence needs. (Recommendation: Persistent).

### For the Content Creator
* [ ] **Rule of Thumb:** Never ask the AI to "Check if X > Y". Always create a `system_auto` action to do the check and set a text-based Cue for the AI to read.