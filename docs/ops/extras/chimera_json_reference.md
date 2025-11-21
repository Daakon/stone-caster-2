# Chimera Editor  
# JSON Reference Sheet  
**StoneCaster System Architecture Guide**

This document provides the complete JSON structures required for defining Rulesets (System Forces), World Assets, and Entity Templates within the Chimera Editor. These definitions support the Compiler, Engine, and AI Prompt Layers.

---

## 1. Ruleset Definition  
### Location  
`chimera_ruleset_templates.definition`

### Purpose  
Defines the mechanical, state, prompt, and UI level behaviors used by the Compiler, Engine, and all AI stages.

---

## 1.1 Structure Overview

```json
{
  "key_definitions": {},
  "state_schema_contributions": {},
  "action_rules": {},
  "prompt_rules": {},
  "ui_schema": {}
}
```

---

## 1.2 key_definitions  
Defines what keys are valid in the system and how they are used.

| Field | Type | Description |
|-------|------|-------------|
| `key_definitions.state_keys` | string[] | Keys that belong in the Action Context (Tier 1 and Tier 2). Used for mechanics. |
| `key_definitions.narrative_keys` | string[] | Keys that belong in the Narrative Context (RAG). Used by the AI storyteller. |

**Examples**

```json
{
  "state_keys": ["health", "mana", "attack_roll"],
  "narrative_keys": ["backstory", "personality", "description"]
}
```

---

## 1.3 state_schema_contributions  
Defines what state fields this Ruleset adds to the global `chimera_game_states` structure.

| Field | Type | Description |
|-------|------|-------------|
| `tier0_tracked_state` | object | Mutable AI memory. Long term narrative state. |
| `tier1_singular_state` | object | Simple mechanical fields. Immediate or per-actor state. |

**Examples**

```json
{
  "tier0_tracked_state": {
    "relationships": {}
  },
  "tier1_singular_state": {
    "actor_health": {
      "player": 100
    }
  }
}
```

---

## 1.4 action_rules  
Defines the mechanics used by the Engine's ActionResolver.

**Example**

```json
{
  "pick_lock": {
    "type": "skill_check",
    "skill": "lockpicking",
    "dc": 50
  },
  "advance_time": {
    "type": "time_update",
    "max_minutes": 60
  }
}
```

---

## 1.5 prompt_rules  
Defines prompt instructions for the AI layers.

| Field | Type | Purpose |
|-------|------|---------|
| `parser_prompt_rules` | string[] | Rules for the MAS 1 Parser. |
| `narrative_prompt_rules` | string[] | Rules for MAS 2 Style and Tone. |
| `narrator_guardrails` | string[] | Safety and agency controls. |

**Example**

```json
{
  "parser_prompt_rules": [
    "Only parse actions listed in available_actions."
  ],
  "narrative_prompt_rules": [
    "Maintain a tense, hopeful mood."
  ],
  "narrator_guardrails": [
    "Never narrate a new action, decision, or dialogue for the player."
  ]
}
```

---

## 1.6 ui_schema  
JSON Schema dictating how this Ruleset's fields appear in the Advanced Editor UI.

**Example**

```json
{
  "fields": {
    "lockpicking": {
      "type": "number",
      "label": "Lockpicking Skill Modifier"
    }
  }
}
```

---

---

# 2. Character Schema Contributions  
### Location  
`chimera_worlds.character_schema_contributions`

### Purpose  
Defines additional required character creation fields for this specific world. These fields appear in the Player Creation UI and become part of the world specific schema.

---

## 2.1 Structure Overview

Each key is a UI-renderable field:

```json
{
  "field_name": {
    "label": "Display Label",
    "type": "dropdown or radio_group or reference",
    "required": true,
    "options": []
  }
}
```

---

## 2.2 Example  
### Mystika Realm Character Schema

```json
{
  "race": {
    "label": "Character Race",
    "type": "dropdown",
    "required": true,
    "options": ["Human", "Elf", "Crystalborn"]
  },
  "essence_alignment": {
    "label": "Essence Alignment",
    "type": "radio_group",
    "required": true,
    "options": ["Life", "Death", "Order", "Chaos"]
  }
}
```

These become the world-specific additions to the Player Creator and contribute to the ruleset compilation.

---

---

# 3. Entity Template Definition  
### Location  
`chimera_entity_templates.base_state_json`

### Purpose  
This is the raw data entered by creators. The Compiler consumes this blob, then distributes fields into:

- Action Context (Tier 1 and Tier 2)
- Narrative Context (RAG)
- Discarded fields (if they match no definitions)

---

## 3.1 Structure Overview

```json
{
  "health": 100,
  "backstory": "Kiera was once a court guard.",
  "random_key": "Discarded"
}
```

---

## 3.2 Compiler Behavior  
| Field | Matches | Output Behavior |
|--------|----------|----------------|
| `health` | `state_keys` | Moves to Tier 1 action_context_json. |
| `backstory` | `narrative_keys` | Moves to Narrative RAG index. |
| `random_key` | none | Removed from the final compiled entity. |

---

# Summary

This reference sheet defines:

1. **Rulesets (System Forces)**  
   Including state contributions, action rules, prompt rules, and UI schema.

2. **World Level Character Schema Contributions**  
   Defining the modular Player Creator.

3. **Entity Templates**  
   The raw data source transformed by the Compiler.

All three JSON structures now form the backbone of your Chimera Editor and support the full lifecycle from creation to compilation to runtime AI behavior.

