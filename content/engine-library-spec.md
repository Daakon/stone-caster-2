# Engine Standard Library Registry (v2.1)

**Context:** Backend implementation of the "Registry Pattern".
**Usage:** In a Ruleset Action, use `function: "ID"` and `args: { ... }`.
**Security:** All functions are pre-compiled in the backend. No user code is executed.

```json
{
  "meta": {
    "version": "2.1",
    "status": "DRAFT",
    "description": "The complete catalog of hard-coded functions available to the Chimera Runtime Engine."
  },
  "registry": {
    "cat_01_resolution": {
      "description": "Dice mechanics and outcome determination. These functions return values intended for 'output_to' variables.",
      "functions": [
        {
          "id": "resolve_roll_under",
          "summary": "Standard D100 check (Success if Roll <= Target).",
          "arguments": {
            "stat_path": { "type": "string", "desc": "Dot-notation path to the entity stat." },
            "modifier": { "type": "number", "desc": "Flat bonus/penalty applied to the Target Value." }
          },
          "returns": {
            "type": "enum",
            "values": ["critical_success", "success", "failure", "critical_failure"],
            "desc": "String enum for condition checks."
          }
        },
        {
          "id": "resolve_roll_over",
          "summary": "Standard D20 check (Success if Roll + Stat + Mod >= DC).",
          "arguments": {
            "stat_path": { "type": "string" },
            "dc": { "type": "number" },
            "modifier": { "type": "number" }
          },
          "returns": {
            "type": "enum",
            "values": ["success", "failure"]
          }
        },
        {
          "id": "resolve_contest",
          "summary": "Opposed check between Actor and Target.",
          "arguments": {
            "actor_stat": { "type": "string" },
            "target_stat": { "type": "string" },
            "actor_mod": { "type": "number" },
            "target_mod": { "type": "number" }
          },
          "returns": {
            "type": "enum",
            "values": ["actor_win", "target_win", "tie"]
          }
        }
      ]
    },
    "cat_02_state_mutation": {
      "description": "Direct modification of Entity or World data. These usually return void.",
      "functions": [
        {
          "id": "modify_stat",
          "summary": "Add or subtract from a numeric value.",
          "arguments": {
            "path": { "type": "string", "desc": "Target path." },
            "amount": { "type": "number", "desc": "Value to add (negative to subtract)." },
            "clamp_min": { "type": "number", "optional": true },
            "clamp_max": { "type": "number", "optional": true }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "set_flag",
          "summary": "Set a boolean or string value explicitly.",
          "arguments": {
            "path": { "type": "string" },
            "value": { "type": "any", "desc": "The strict value to set." }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "manage_list",
          "summary": "Add or remove items from an array (Inventory, Tags).",
          "arguments": {
            "path": { "type": "string" },
            "item": { "type": "any" },
            "operation": { "type": "enum", "options": ["add", "remove", "clear"] }
          },
          "returns": { "type": "void" }
        }
      ]
    },
    "cat_03_logic_calculators": {
      "description": "Complex algorithms for derived stats.",
      "functions": [
        {
          "id": "check_thresholds",
          "summary": "Maps a numeric range to a string label (e.g., Hunger -> Starving).",
          "arguments": {
            "source_path": { "type": "string", "desc": "Value to check." },
            "thresholds": { "type": "map", "desc": "Key=MinVal (String), Value=OutputString." },
            "output_path": { "type": "string", "desc": "Where to write the result string." }
          },
          "returns": { "type": "void", "side_effects": "Mutates output_path." }
        }
      ]
    },
    "cat_04_event_logging": {
      "description": "Output management. Writes to the 'Event Stream' that the Compiler reads.",
      "functions": [
        {
          "id": "log_event",
          "summary": "Appends a text string to the standard 'recent_events' list.",
          "arguments": {
            "message": { "type": "string" },
            "tag": { "type": "string", "optional": true }
          },
          "returns": { "type": "void", "side_effects": "Appends to tier1_global.event_log" }
        },
        {
          "id": "trigger_system_alert",
          "summary": "Sets a high-priority flag that forces MAS 2 to shift context.",
          "arguments": {
            "alert_id": { "type": "string" },
            "message": { "type": "string" }
          },
          "returns": { "type": "void", "side_effects": "Updates tier1_global.system_alerts" }
        }
      ]
    }
  }
}
```