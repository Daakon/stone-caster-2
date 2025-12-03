# StoneCaster Material World (v3.0)

**Focus:** Items, Equipment, and Atmosphere.
**Impact:** High | **Difficulty:** Low

---

## 1. Inventory & Equipment (`core_inventory`)
**Purpose:** Simple list management for player agency.

```json
{
  "id": "core_inventory",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Inventory & Equipment",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player"],
      "definitions": {
        "inventory": { "value": [], "context_priority": "ai_visible" },
        "equipped_weapon": { "value": "Fists", "context_priority": "engine_private" }
      },
      "form_hints": {
        "inventory": { "label": "Starting Items", "control": "tag_list", "default": ["Rations", "Knife"] }
      }
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "state_readouts": [
        { "path": "tier1_entity.inventory", "label": "[BACKPACK CONTENTS]" }
      ]
    }
  }
}
```

## 2. Cinematic Weather (`flavor_weather`)
**Purpose:** Adds atmospheric depth without complex simulation, using conditional sensory injections.

```json
{
  "id": "flavor_weather",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Cinematic Weather",
  "ui_category": "flavor",
  "state_contributions": {
    "tier1_global": {
      "definitions": {
        "weather_state": { "value": "Clear", "context_priority": "ai_visible" }
      },
      "form_hints": {
        "weather_state": { "label": "Initial Weather", "control": "select", "options": ["Clear", "Rain", "Fog", "Storm"], "default": "Clear" }
      }
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "sensory",
          "condition": "tier1_global.weather_state == 'Rain'",
          "priority": 20,
          "content": "Mention the sound of rain, the slickness of surfaces, and the cold dampness."
        },
        {
          "category": "sensory",
          "condition": "tier1_global.weather_state == 'Fog'",
          "priority": 20,
          "content": "Describe limited visibility, muffled sounds, and a sense of isolation."
        },
        {
          "category": "sensory",
          "condition": "tier1_global.weather_state == 'Storm'",
          "priority": 25,
          "content": "Emphasize the violence of the wind and the crashing thunder."
        }
      ]
    }
  }
}
```