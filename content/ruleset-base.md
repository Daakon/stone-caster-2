# StoneCaster Ruleset Schema Specification (v3.0)

**Version:** 3.0
**Context:** Backend-Logic & Compiler Pipeline
**Purpose:** Defines the strict JSON structure for Rulesets. This version introduces **Pipeline Versioning** and **Structured MAS Directives** to support the automated Compiler.

---

## 1. Root Metadata
*Defines identity, compatibility, and loading constraints.*

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`id`** | String | ✅ | Unique internal slug (e.g., `core_survival_v1`). |
| **`pipeline_compatibility`** | Array | ✅ | List of Compiler Pipelines this ruleset supports (e.g., `["v2025_01"]`). **Critical for versioning.** |
| **`name`** | String | ✅ | Display name (e.g., "D100 Skill System"). |
| **`ui_category`** | Enum | ✅ | `foundation` (Core System), `expansion` (Add-on), or `flavor` (Narrative only). |
| **`exclusion_group`** | String | ❌ | If defined, only *one* ruleset with this group ID can be active per story (e.g., `health_system`). |
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
*Defines executable logic (Verbs).*

Logic must utilize the **Engine Standard Library Registry**.

### 3.1 Syntax Example
```json
"check_exhaustion": {
  "kind": "system_auto",
  "trigger": "on_stat_change(stamina)",
  "logic": [
    {
      "if": "stamina < 10",
      "then": { 
        "function": "cat_02_state_mutation.set_flag", 
        "args": { "path": "visible_status", "value": "Panting heavily" } 
      }
    }
  ]
}
```

---

## 4. MAS Directives (`mas_directives`)
*Replaces "AI Instructions". These are strict injection slots for Game Flow Steps 6, 8, and 9.*

### 4.1 MAS 1: The Interpreter (Input Processing)
*Configures how the Engine parses user text into data (Step 6).*

| Key | Type | Description |
| :--- | :--- | :--- |
| **`intent_keywords`** | Array | Maps specific verbs/phrases to Engine Stats. |
| **`sentiment_thresholds`** | Array | Maps Sentiment/Intensity to Engine Flags. |
| **`param_extraction`** | Array | Explicit keys the JSON output must attempt to fill. |

**Example:**
```json
"mas1_interpreter": {
  "intent_keywords": [
    { "verb": "intimidate", "mapped_stat": "skills.force", "tags": ["hostile"] },
    { "verb": "beg", "mapped_stat": "skills.persuasion", "tags": ["social"] }
  ],
  "sentiment_thresholds": [
    { "metric": "intensity", "operator": ">=", "value": 80, "flag_trigger": "high_intensity_input" }
  ]
}
```

### 4.2 MAS 2: The Narrator (Prompt Generation)
*Configures how the Engine assembles the System Prompt (Steps 8 & 9).*

#### A. Style Injections (`style_injections`)
*Static instructions merged into the System Prompt. The Compiler uses `category`, `priority`, and `unique_id` to resolve conflicts.*

| Field | Type | Description |
| :--- | :--- | :--- |
| **`category`** | Enum | `tone` (Mood), `sensory` (Sights/Sounds), `formatting` (Structure), `mechanics` (Rules), `prohibited` (Constraints). |
| **`content`** | String | The actual instruction text. |
| **`priority`** | Int | 1-100. Higher numbers appear later in the prompt (overriding earlier ones). |
| **`unique_id`** | String | **(Optional)** If two rulesets provide an injection with the same ID, only the one with the higher Priority is used. |

#### B. State Readouts (`state_readouts`)
*Dynamic data injection. The Compiler fetches the value from the Engine State and labels it.*

| Field | Type | Description |
| :--- | :--- | :--- |
| **`path`** | String | Dot-notation path to the variable (e.g., `tier1_entity.visible_status`). |
| **`label`** | String | The Header used in the Prompt context block (e.g., `[CURRENT PHYSICAL CONDITION]`). |

---

## 5. Complete Example: "Grimdark Injury System"

This example demonstrates how a ruleset overrides the default tone using `unique_id` collision and provides dynamic state readouts.

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
      "trigger": "on_turn_start",
      "logic": [
        { 
          "if": "blood_loss > 50", 
          "then": { 
             "function": "cat_02_state_mutation.set_flag",
             "args": { "path": "injury_description", "value": "Bleeding profusely, pale skin" }
          }
        }
      ]
    }
  },

  "mas_directives": {
    "mas1_interpreter": {
      "intent_keywords": [
        { "verb": "bandage", "mapped_stat": "skills.medicine" }
      ]
    },
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "tone",
          "unique_id": "global_mood",
          "priority": 90,
          "content": "The tone is gritty, visceral, and hopeless. Emphasize the fragility of the body."
        },
        {
          "category": "sensory",
          "priority": 10,
          "content": "Describe the metallic smell of blood if injury is present."
        },
        {
          "category": "formatting",
          "priority": 50,
          "content": "Do not use flowery language. Be blunt."
        }
      ],
      "state_readouts": [
        {
          "path": "tier1_entity.injury_description",
          "label": "VISIBLE WOUNDS & STATUS"
        }
      ]
    }
  }
}
```