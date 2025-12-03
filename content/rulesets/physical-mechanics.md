# StoneCaster Physical Mechanics (v3.0)

**Focus:** Vitality, Combat, and Death.
**Impact:** High | **Difficulty:** Medium

---

## 1. Basic Vitality System (`core_vitality`)
**Purpose:** Tracks HP and Death state using V3 conditional injections for "Near Death" narrative overrides.

```json
{
  "id": "core_vitality",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Basic Vitality System",
  "ui_category": "foundation",
  "exclusion_group": "health_engine",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player", "npc"],
      "definitions": {
        "hp": { "value": { "current": 10, "max": 10 }, "context_priority": "ai_visible" },
        "is_dead": { "value": false, "context_priority": "engine_private" }
      },
      "form_hints": {
        "hp.max": { "label": "Max Hit Points", "control": "number", "min": 1, "default": 10 }
      }
    }
  },
  "actions": {
    "take_damage": {
      "kind": "mechanical",
      "params": { "amount": "number" },
      "logic": {
        "function": "cat_02_state_mutation.modify_stat",
        "args": { "path": "hp.current", "amount": "-amount", "clamp_min": 0 }
      }
    },
    "check_death": {
      "kind": "system_auto",
      "trigger": "on_stat_change(hp.current)",
      "logic": [
        { 
          "if": "hp.current <= 0", 
          "then": {
             "function": "cat_02_state_mutation.set_flag",
             "args": { "path": "is_dead", "value": true }
          }
        }
      ]
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "tone",
          "condition": "tier1_entity.hp.current < 3",
          "priority": 90,
          "content": "Describe the character as reeling, bloody, and near death. Actions should feel desperate and weak."
        }
      ],
      "state_readouts": [
        { "path": "tier1_entity.hp", "label": "[VITALITY]" }
      ]
    }
  }
}
```

## 2. Basic Combat Actions (`core_combat_actions`)
**Purpose:** Adds "Attack" verbs that resolve against the D100 system and modify HP.

```json
{
  "id": "core_combat_actions",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Basic Combat Actions",
  "ui_category": "foundation",
  "dependencies": ["core_vitality", "D100 Skill System"],
  "actions": {
    "perform_attack": {
      "kind": "interaction",
      "params": { "target_id": "string", "weapon_damage": "number" },
      "logic": {
        "function": "cat_01_resolution.resolve_roll_under",
        "args": { "stat_path": "skills.combat", "modifier": 0 }
      },
      "effects": {
        "success": {
          "logic": [
            {
              "function": "cat_04_event_logging.log_event",
              "args": { 
                "message": "Attack hit!", 
                "metadata": { "type": "damage", "target_id": "target_id", "amount": "weapon_damage" }
              } 
            },
            {
              "comment": "Note: Actual damage application is handled by the Engine processing the 'damage' event or a direct call if architecture permits.",
              "function": "cat_02_state_mutation.modify_stat",
              "args": { "path": "target.hp.current", "amount": "-weapon_damage" }
            }
          ]
        }
      }
    }
  },
  "mas_directives": {
    "mas1_interpreter": {
      "intent_keywords": [
        { "verb": "attack", "mapped_stat": "skills.combat", "tags": ["hostile"] },
        { "verb": "strike", "mapped_stat": "skills.combat", "tags": ["hostile"] },
        { "verb": "shoot", "mapped_stat": "skills.marksmanship", "tags": ["hostile"] }
      ],
      "param_extraction": [
        { "key": "target_id", "instruction": "Who is being attacked?" }
      ]
    }
  }
}
```