# StoneCaster Social Mechanics (v3.0 - Triangulation Optimized)

**Architecture:** "Broadcast & React"
**Goal:** High-fidelity social dynamics with minimal stat tracking.

---

## 1. Social Identity Core (`core_social_identity`)
**The Data Layer.**
Defines the "Capacity" for social depth. It adds Personality (DNA), Relationships, and Social Roles (Context) to every entity.

```json
{
  "id": "core_social_identity",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Social Identity Core",
  "ui_category": "foundation",
  "exclusion_group": "social_data",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": {
        "social_dna": { "value": { "honor": 50, "empathy": 50, "aggression": 50 }, "context_priority": "engine_private" },
        "relationships": { "value": {}, "context_priority": "engine_private" },
        "social_roles": { "value": ["Civilian"], "context_priority": "ai_visible" }
      },
      "form_hints": {
        "social_roles": { "label": "Social Roles", "control": "tag_list", "options": ["Civilian", "Guard", "Bully", "Victim", "Noble"], "default": ["Civilian"] }
      }
    }
  },
  "mas_directives": {
    "mas2_narrator": {
      "style_injections": [
        {
          "category": "mechanics",
          "priority": 10,
          "content": "Refer to the entity's 'social_roles' to determine their authority and social standing (e.g., Guards have legal authority, Nobles expect deference)."
        }
      ]
    }
  }
}
```

---

## 2. Contextual Social Actions (`exp_contextual_actions`)
**The Input Layer.**
Defines the "Buttons" the player can press. Instead of calculating the result immediately, it **Broadcasts** the event to the room via `log_event`.

```json
{
  "id": "exp_contextual_actions",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Contextual Social Actions",
  "ui_category": "expansion",
  "dependencies": ["core_social_identity"],
  "actions": {
    "perform_contextual_intimidation": {
      "kind": "interaction",
      "params": { "target_id": "string", "justification": "string", "method": "string" },
      "logic": {
        "function": "cat_01_resolution.resolve_roll_under",
        "args": { "stat_path": "skills.intimidation", "modifier": 0 }
      },
      "effects": {
        "success": {
          "logic": [
            {
              "comment": "Update the Target's relationship to the Actor directly.",
              "function": "cat_03_logic_calculators.calc_social_impact",
              "args": { 
                "action_signature": { "aggression": 80, "dominance": 90 },
                "actor_id": "player", 
                "target_id": "target_id" 
              }
            },
            {
              "comment": "Broadcast the event so Witnesses can react (Triangulation).",
              "function": "cat_04_event_logging.log_event",
              "args": {
                "message": "Player successfully intimidated the target.",
                "tag": "social_conflict",
                "metadata": { "type": "intimidation_success", "actor_id": "player", "target_id": "target_id" }
              }
            }
          ]
        }
      }
    }
  },
  "mas_directives": {
    "mas1_interpreter": {
      "intent_keywords": [
        { "verb": "intimidate", "mapped_stat": "skills.intimidation", "tags": ["hostile"] },
        { "verb": "threaten", "mapped_stat": "skills.intimidation", "tags": ["hostile"] }
      ],
      "param_extraction": [
        { "key": "target_id", "instruction": "Identify the target of the threat." },
        { "key": "justification", "instruction": "Why is the user threatening them? Default to 'unprovoked'." }
      ]
    }
  }
}
```

---

## 3. Social Triangulation Logic (`exp_social_triangulation`)
**The Reactive Layer.**
This is the "Brain." It listens for the broadcasted logs and updates how NPC witnesses feel based on *their* relationship to the victim.

```json
{
  "id": "exp_social_triangulation",
  "pipeline_compatibility": ["v2025_01"],
  "name": "Social Triangulation Logic",
  "ui_category": "expansion",
  "dependencies": ["core_social_identity"],
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc"],
      "definitions": {
        "narrative_cues": { "value": { "reaction_style": "Neutral" }, "context_priority": "ai_visible" }
      }
    }
  },
  "actions": {
    "witness_victimization": {
      "kind": "system_auto",
      "trigger": "on_stat_change(global_event_log)",
      "logic": [
        {
          "comment": "If I HATE the victim (<30 affection), I enjoy seeing them threatened.",
          "if": "event.metadata.type == 'intimidation_success' && relationships[event.metadata.target_id].affection < 30",
          "then": {
            "function": "cat_02_state_mutation.set_flag",
            "args": { "path": "narrative_cues.reaction_style", "value": "Smirking" }
          }
        },
        {
          "comment": "If I LIKE the victim (>70 affection), I am horrified.",
          "if": "event.metadata.type == 'intimidation_success' && relationships[event.metadata.target_id].affection > 70",
          "then": {
            "function": "cat_02_state_mutation.set_flag",
            "args": { "path": "narrative_cues.reaction_style", "value": "Shocked" }
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
          "condition": "narrative_cues.reaction_style == 'Smirking'",
          "priority": 50,
          "content": "Describe this NPC with a tone of dark amusement (Schadenfreude). Use words like 'grin', 'chuckle', or 'watchful'."
        },
        {
          "category": "tone",
          "condition": "narrative_cues.reaction_style == 'Shocked'",
          "priority": 50,
          "content": "Describe this NPC as freezing in place or gasping. They are visibly disturbed by the aggression towards their friend."
        }
      ],
      "state_readouts": [
        {
          "path": "tier1_entity.narrative_cues.reaction_style",
          "label": "[CURRENT EMOTIONAL REACTION]"
        }
      ]
    }
  }
}
```