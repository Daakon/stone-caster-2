# StoneCaster Ruleset Schema Specification (v3.1)

**Version:** 3.1
**Context:** Backend-Logic & Compiler Pipeline
**Purpose:** Defines the strict JSON structure for Rulesets. This version enforces **Compiler-Safe Logic** (no eval) and **Structured Triggers**.

---

## 1. Root Metadata
*Defines identity, compatibility, and loading constraints.*

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`id`** | String | ✅ | Unique internal slug (e.g., `core_survival_v1`). |
| **`pipeline_compatibility`** | Array | ✅ | List of Compiler Pipelines this ruleset supports (e.g., `["v2025_01"]`). **Critical for versioning.** |
| **`name`** | String | ✅ | Display name (e.g., "D100 Skill System"). |
| **`ui_category`** | Enum | ✅ | `foundation` (Core System), `expansion` (Add-on), or `flavor` (Narrative only). |
| **`exclusion_group`** | String | ❌ | If defined, only *one* ruleset with this group ID can be active per story. |
| **`dependencies`** | Array | ❌ | List of **IDs** of other rulesets that must be loaded for this one to function. |
| **`state_contributions`** | Object | ✅ | See Section 2. |
| **`actions`** | Object | ❌ | See Section 3. |
| **`mas_directives`** | Object | ❌ | See Section 4. |

---

## 2. State Contributions (`state_contributions`)
*Defines the data schema extensions. This is how a Ruleset adds new variables to an entity.*

### 2.1 Schema Structure
```json
"tier1_entity": {
  "target_kind": ["player", "npc"],
  "definitions": {
    "stamina": { "value": 100, "context_priority": "engine_private" },
    "visible_status": { "value": "", "context_priority": "ai_visible" }
  },
  "form_hints": {
    "stamina": { "control": "slider", "min": 0, "max": 100, "label": "Initial Stamina" }
  }
}
```

* **`definitions`**: The actual variables added to the entity.
    * `engine_private`: Used for math/logic only.
    * `ai_visible`: Available for injection into prompts via `state_readouts`.
* **`form_hints`**: Instructions for the Content Creator UI to render inputs.

---

## 3. Actions (`actions`)
*Defines executable logic. This section is strictly typed to avoid `eval()` security risks.*

### 3.1 The Logic Pipeline
Actions execute as a linear chain of steps. Intermediate results can be captured in temporary variables.

#### A. Trigger Structure (`trigger`)
Must be a structured object, not a string.
* **`type`**: `intent_match` (Player input), `stat_change` (Passive), `timer` (Turn based).
* **`target`**: The specific ID or Path to watch.

#### B. Logic Steps (`logic`)
An array of function calls.
* **`step_id`**: Internal label for debugging.
* **`function`**: Reference to Registry ID.
* **`args`**: Arguments matching the Registry Schema.
* **`output_to`**: (Optional) Saves the return value to a temp variable (e.g., `roll_result`).
* **`conditions`**: (Optional) An array of strict comparisons. The step ONLY executes if all conditions pass.

### 3.2 Syntax Example: Passive Monitor
```json
"check_exhaustion": {
  "kind": "system_auto",
  "trigger": { 
    "type": "stat_change", 
    "target": "tier1_entity.stamina" 
  },
  "logic": [
    {
      "step_id": "apply_status",
      "function": "cat_02_state_mutation.set_flag",
      "args": { "path": "tier1_entity.visible_status", "value": "Panting heavily" },
      "conditions": [
        { "left": "tier1_entity.stamina", "op": "lt", "right": 10 }
      ]
    }
  ]
}
```

### 3.3 Syntax Example: Dice Roll Sequence
```json
"attempt_force_door": {
  "kind": "player_initiated",
  "trigger": { "type": "intent_match", "keyword_id": "force_open" },
  "logic": [
    {
      "step_id": "roll_dice",
      "function": "cat_01_resolution.resolve_roll_over",
      "args": { "stat_path": "tier1_entity.skills.force", "dc": 15, "modifier": 0 },
      "output_to": "check_result"
    },
    {
      "step_id": "on_success",
      "function": "cat_02_state_mutation.set_flag",
      "args": { "path": "tier1_world.door_status", "value": "broken" },
      "conditions": [
        { "left": "check_result", "op": "eq", "right": "success" }
      ]
    }
  ]
}
```

---

## 4. MAS Directives (`mas_directives`)
*Configuration for AI Inputs and Outputs.*

### 4.1 MAS 1: The Interpreter (Input Processing)
*Configures how the Engine parses user text into data.*

| Key | Type | Description |
| :--- | :--- | :--- |
| **`intent_keywords`** | Array | Maps specific verbs/phrases to Ruleset Trigger IDs. |
| **`sentiment_thresholds`** | Array | Maps Sentiment/Intensity to Engine Flags. |

**Example:**
```json
"mas1_interpreter": {
  "intent_keywords": [
    { "verb": "intimidate", "trigger_id": "action_intimidate", "tags": ["hostile"] }
  ]
}
```

### 4.2 MAS 2: The Narrator (Prompt Generation)
*Configures how the Engine assembles the System Prompt.*

#### A. Style Injections (`style_injections`)
*Static instructions merged into the System Prompt.*

| Field | Type | Description |
| :--- | :--- | :--- |
| **`category`** | Enum | `tone`, `sensory`, `formatting`, `mechanics`, `prohibited`. |
| **`content`** | String | The actual instruction text. |
| **`priority`** | Int | 1-100. Higher numbers override lower ones. |
| **`unique_id`** | String | Used to resolve collisions between Rulesets. |

#### B. State Readouts (`state_readouts`)
*Dynamic data injection pointers.*

| Field | Type | Description |
| :--- | :--- | :--- |
| **`path`** | String | Dot-notation path to the variable (e.g., `tier1_entity.visible_status`). |
| **`label`** | String | The Header used in the Prompt context block (e.g., `[CURRENT PHYSICAL CONDITION]`). |

---

## 5. Complete Example: "Grimdark Injury System"

```json
{
  "id": "exp_grimdark_injury",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Grimdark Injury Expansion",
  "ui_category": "expansion",
  
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player", "npc"],
      "definitions": {
        "blood_loss": { "value": 0, "context_priority": "engine_private" },
        "injury_description": { "value": "Healthy", "context_priority": "ai_visible" }
      },
      "form_hints": {
        "blood_loss": { "control": "slider", "min": 0, "max": 100, "label": "Initial Blood Loss" }
      }
    }
  },

  "actions": {
    "calc_bleed": {
      "kind": "system_auto",
      "trigger": { "type": "turn_start" },
      "logic": [
        { 
          "step_id": "update_status",
          "function": "cat_02_state_mutation.set_flag",
          "args": { "path": "tier1_entity.injury_description", "value": "Bleeding profusely" },
          "conditions": [
            { "left": "tier1_entity.blood_loss", "op": "gt", "right": 50 }
          ]
        }
      ]
    }
  },

  "mas_directives": {
    "mas1_interpreter": {
      "intent_keywords": [
        { "verb": "bandage", "trigger_id": "action_medical_check" }
      ]
    },
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "tone",
          "unique_id": "global_mood",
          "priority": 90,
          "content": "The tone is gritty. Emphasize the fragility of the body."
        }
      ],
      "state_readouts": [
        {
          "path": "tier1_entity.injury_description",
          "label": "VISIBLE WOUNDS"
        }
      ]
    }
  }
}
```