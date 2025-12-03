# StoneCaster Progression System (v3.0)

**Focus:** XP, Leveling, and Growth.
**Impact:** Medium | **Difficulty:** Low

---

## 1. XP & Advancement (`core_progression`)
**Purpose:** Tracks long-term growth and triggers "Level Up" events.

```json
{
  "id": "core_progression",
  "pipeline_compatibility": ["v2025_01"],
  "name": "XP & Advancement",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player"],
      "definitions": {
        "xp": { "value": 0, "context_priority": "engine_private" },
        "level": { "value": 1, "context_priority": "ai_visible" }
      }
    }
  },
  "actions": {
    "grant_xp": {
      "kind": "mechanical",
      "params": { "amount": "number" },
      "logic": {
         "function": "cat_02_state_mutation.modify_stat",
         "args": { "path": "xp", "amount": "amount" }
      }
    },
    "check_levelup": {
      "kind": "system_auto",
      "trigger": "on_stat_change(xp)",
      "logic": [
        { 
          "if": "xp >= 100 * level", 
          "then": {
             "function": "cat_04_event_logging.log_event",
             "args": { "message": "You feel a surge of new power. (Level Up!)", "tag": "progression" }
          }
        },
        {
          "if": "xp >= 100 * level",
          "then": {
             "function": "cat_02_state_mutation.modify_stat",
             "args": { "path": "level", "amount": 1 }
          }
        }
      ]
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "state_readouts": [
        { "path": "tier1_entity.level", "label": "[CURRENT LEVEL]" }
      ]
    }
  }
}
```