# StoneCaster Narrative Enhancers (v3.1)

**Focus:** Psychological Depth and Plot Consistency.
**Goal:** Easy-to-implement systems that prevent "AI Amnesia" and "Robotic Behavior."

---

## 1. The Knowledge Ledger (`core_knowledge`)
**Purpose:** Tracks intangible secrets, passwords, and lore.
**Why it's MVP:** It prevents the AI from spoiling the plot or forgetting that the player solved a riddle.

```json
{
  "id": "core_knowledge",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Knowledge Ledger",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player"],
      "definitions": {
        "known_facts": { "value": [], "context_priority": "ai_visible" }
      },
      "form_hints": {
        "known_facts": { "label": "Initial Secrets", "control": "tag_list", "default": [] }
      }
    }
  },
  "actions": {
    "learn_fact": {
      "kind": "mechanical",
      "params": { "fact_id": "string" },
      "logic": {
        "function": "cat_02_state_mutation.manage_list",
        "args": { "path": "known_facts", "item": "fact_id", "operation": "add" }
      }
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "state_readouts": [
        { "path": "tier1_entity.known_facts", "label": "[KNOWN SECRETS & LORE]" }
      ],
      "style_injections": [
        {
          "category": "mechanics",
          "priority": 20,
          "content": "The player can ONLY mention or act on information listed in [KNOWN SECRETS]. If they try to use knowledge they don't have, narrate confusion or failure."
        }
      ]
    }
  }
}
```

---

## 2. Mental Stress (`core_stress`)
**Purpose:** Tracks psychological toll.
**Why it's MVP:** Unlike HP (which just kills you), Stress changes *how the story is told*. It forces the AI to write in a genre-appropriate way (Horror/Panic) when things go wrong.

```json
{
  "id": "core_stress",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Mental Stress System",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["player", "npc"],
      "definitions": {
        "stress": { "value": 0, "context_priority": "ai_visible" },
        "mental_state": { "value": "Stable", "context_priority": "ai_visible" }
      },
      "form_hints": {
        "stress": { "label": "Initial Stress", "control": "slider", "min": 0, "max": 100, "default": 0 }
      }
    }
  },
  "actions": {
    "take_stress": {
      "kind": "mechanical",
      "params": { "amount": "number" },
      "logic": {
        "function": "cat_02_state_mutation.modify_stat",
        "args": { "path": "stress", "amount": "amount", "clamp_max": 100 }
      }
    },
    "update_mental_state": {
      "kind": "system_auto",
      "trigger": "on_stat_change(stress)",
      "logic": [
        { 
          "if": "stress < 40", 
          "then": { "function": "cat_02_state_mutation.set_flag", "args": { "path": "mental_state", "value": "Stable" } }
        },
        { 
          "if": "stress >= 40 && stress < 80", 
          "then": { "function": "cat_02_state_mutation.set_flag", "args": { "path": "mental_state", "value": "Shaken" } }
        },
        { 
          "if": "stress >= 80", 
          "then": { "function": "cat_02_state_mutation.set_flag", "args": { "path": "mental_state", "value": "Broken" } }
        }
      ]
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "tone",
          "condition": "tier1_entity.mental_state == 'Shaken'",
          "priority": 60,
          "content": "The protagonist is on edge. Describe sensory overload, jumpiness, or intrusive thoughts."
        },
        {
          "category": "tone",
          "condition": "tier1_entity.mental_state == 'Broken'",
          "priority": 100,
          "content": "OVERRIDE: The protagonist is hysterical or dissociating. Narration should be disjointed, paranoid, and unreliable. They may hallucinate details."
        }
      ],
      "state_readouts": [
        { "path": "tier1_entity.mental_state", "label": "[PSYCHOLOGY]" }
      ]
    }
  }
}
```