# Engine Standard Library Registry (v2.0)

**Context:** Backend implementation of the "Registry Pattern".
**Usage:** In a Ruleset Action, use `"logic": { "function": "ID", "args": { ... } }`.
**Change Log v2.0:** Deprecated direct narrative injection. Added dedicated Log Management to support the V3 Compiler "State Readout" pipeline.

```json
{
  "meta": {
    "version": "2.0",
    "status": "DRAFT",
    "description": "The complete catalog of hard-coded functions available to the Chimera Runtime Engine."
  },
  "registry": {
    "cat_01_resolution": {
      "description": "Dice mechanics and outcome determination.",
      "functions": [
        {
          "id": "resolve_roll_under",
          "summary": "Standard D100 check (Success if Roll <= Target).",
          "arguments": {
            "stat_path": { "type": "string", "desc": "Dot-notation path to the entity stat (e.g., 'skills.stealth')." },
            "modifier": { "type": "number", "desc": "Flat bonus/penalty applied to the Target Value." }
          },
          "returns": {
            "type": "enum",
            "values": ["critical_success", "success", "failure", "critical_failure"]
          }
        },
        {
          "id": "resolve_roll_over",
          "summary": "Standard D20 check (Success if Roll + Stat + Mod >= DC).",
          "arguments": {
            "stat_path": { "type": "string", "desc": "Path to attribute/stat." },
            "dc": { "type": "number", "desc": "Difficulty Class to beat." },
            "modifier": { "type": "number", "desc": "Flat bonus/penalty to the roll." }
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
            "actor_stat": { "type": "string", "desc": "Path to actor's stat." },
            "target_stat": { "type": "string", "desc": "Path to target's stat." },
            "actor_mod": { "type": "number", "desc": "Modifier for actor." },
            "target_mod": { "type": "number", "desc": "Modifier for target." }
          },
          "returns": {
            "type": "enum",
            "values": ["actor_win", "target_win", "tie"]
          }
        }
      ]
    },
    "cat_02_state_mutation": {
      "description": "Direct modification of Entity or World data.",
      "functions": [
        {
          "id": "modify_stat",
          "summary": "Add or subtract from a numeric value.",
          "arguments": {
            "path": { "type": "string", "desc": "Target path (e.g., 'hp.current')." },
            "amount": { "type": "number", "desc": "Value to add (negative to subtract)." },
            "clamp_min": { "type": "number", "optional": true, "desc": "Hard floor for value." },
            "clamp_max": { "type": "number", "optional": true, "desc": "Hard ceiling for value." }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "set_flag",
          "summary": "Set a boolean or string value explicitly.",
          "arguments": {
            "path": { "type": "string", "desc": "Target path (e.g., 'is_unconscious')." },
            "value": { "type": "any", "desc": "The strict value to set." }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "manage_list",
          "summary": "Add or remove items from an array (Inventory, Tags).",
          "arguments": {
            "path": { "type": "string", "desc": "Target array path." },
            "item": { "type": "any", "desc": "The string/object to process." },
            "operation": { "type": "enum", "options": ["add", "remove", "clear"], "desc": "Action to perform." }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "apply_status",
          "summary": "Apply a structured Condition object.",
          "arguments": {
            "id": { "type": "string", "desc": "Status ID (e.g., 'poisoned')." },
            "severity": { "type": "number", "desc": "Intensity level." },
            "duration": { "type": "number", "desc": "Turns to persist." }
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
          "summary": "Converts a continuous number into discrete states (e.g., Hunger -> Starving).",
          "arguments": {
            "source_path": { "type": "string", "desc": "Value to check (e.g., 'hunger')." },
            "thresholds": { "type": "map", "desc": "Key=MinVal, Value=OutputString (e.g., { '80': 'starving' })." },
            "output_path": { "type": "string", "desc": "Where to write the result string." }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "calc_social_impact",
          "summary": "Calculates Social Delta based on Action Signature vs Witness DNA.",
          "arguments": {
            "action_signature": { "type": "object", "desc": "Map of social weights." },
            "witness_ids": { "type": "array[string]", "optional": true, "desc": "Specific targets." }
          },
          "returns": { "type": "void", "side_effects": "Updates relationships map." }
        }
      ]
    },
    "cat_04_event_logging": {
      "description": "Output management. These functions write to the 'Event Stream' that the Compiler reads.",
      "functions": [
        {
          "id": "log_event",
          "summary": "Appends a text string to the standard 'recent_events' list for MAS 2 to read.",
          "arguments": {
            "message": { "type": "string", "desc": "The text to log (e.g., 'You missed the attack')." },
            "tag": { "type": "string", "optional": true, "desc": "Category tag (e.g., 'combat', 'dialogue')." }
          },
          "returns": { "type": "void", "side_effects": "Appends to tier1_global.event_log" }
        },
        {
          "id": "clear_logs",
          "summary": "Flushes the event log. Typically called automatically by the Engine at the end of a turn.",
          "arguments": {
            "target_log": { "type": "string", "optional": true, "default": "tier1_global.event_log" }
          },
          "returns": { "type": "void" }
        },
        {
          "id": "trigger_system_alert",
          "summary": "Sets a high-priority flag that forces MAS 2 to shift context (e.g., 'Combat Started').",
          "arguments": {
            "alert_id": { "type": "string", "desc": "The Alert Key." },
            "message": { "type": "string", "desc": "Context for the AI." }
          },
          "returns": { "type": "void", "side_effects": "Updates tier1_global.system_alerts" }
        }
      ]
    }
  }
}