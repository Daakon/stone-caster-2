# StoneCaster MVP Ruleset Library (v2.1 - Master Complete)

This library defines the complete MVP stack. It merges the **Backend-Logic Architecture** with the **Casting Circle UI Schema**.

**Architecture Key:**
* **`form_hints`**: Instructions for the UI to render sliders/inputs during story creation.
* **`context_priority`**:
    * `engine_private`: Math hidden from the AI (e.g., raw `social_dna` numbers).
    * `ai_visible`: Cues sent to the AI (e.g., `narrative_cues`).
* **`system_auto`**: Actions that run automatically to convert Private Math into Public Cues.

---

## 1. FOUNDATIONS (THE HUBS)

### 1.1 Social Bonds & DNA
**Name:** Deep NPC Behaviors
**Source:**

```json
{
  "name": "Deep NPC Behaviors",
  "ui_category": "foundation",
  "exclusion_group": "social_engine",
  "short_description": "Tracks how characters feel about each other and their core personality traits.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": {
        "social_dna": { 
          "value": { "honesty": 50, "order": 50, "altruism": 50, "aggression": 50, "sociability": 50, "curiosity": 50 },
          "context_priority": "engine_private" 
        },
        "relationships": { "value": {}, "context_priority": "engine_private" },
        "narrative_cues": { "value": { "social_tone": "Neutral" }, "context_priority": "ai_visible" }
      },
      "form_hints": {
        "social_dna.honesty": { "label": "Honesty", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 },
        "social_dna.aggression": { "label": "Aggression", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 },
        "social_dna.altruism": { "label": "Altruism", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 },
        "social_dna.order": { "label": "Orderliness", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 },
        "social_dna.sociability": { "label": "Sociability", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 },
        "social_dna.curiosity": { "label": "Curiosity", "control": "slider", "min": 0, "max": 100, "group": "Personality", "default": 50 }
      }
    }
  },
  "actions": {
    "modify_relationship": {
      "kind": "mechanical",
      "params": { "target_id": "string", "component": "string", "amount": "number" },
      "logic": "target.relationships[actor_id][component] += amount"
    },
    "update_social_cues": {
      "kind": "system_auto",
      "trigger": "on_stat_change(relationships)",
      "logic": [
        { "if": "relationships[target_id].affection < 30", "then": "narrative_cues.social_tone = 'Hostile'" },
        { "if": "relationships[target_id].trust > 70", "then": "narrative_cues.social_tone = 'Confiding'" },
        { "if": "relationships[target_id].respect > 70", "then": "narrative_cues.social_tone = 'Deferential'" },
        { "if": "relationships[target_id].attraction > 70", "then": "narrative_cues.social_tone = 'Flirtatious'" }
      ]
    }
  },
  "ai_instructions": {
    "mas1": {
      "intent_mappings": "Deception/Truth -> 'social_dna.honesty'; Violence/Peace -> 'social_dna.aggression'; Generosity -> 'social_dna.altruism'."
    },
    "mas2": {
      "tone_instructions": "Adopt the 'social_tone' defined in narrative_cues."
    }
  }
}
```

### 1.2 Behavior Intent Framework
**Name:** Behavior Intent Framework
**Source:**

```json
{
  "name": "Behavior Intent Framework",
  "ui_category": "foundation",
  "exclusion_group": "ai_brain",
  "short_description": "The decision-making engine for NPCs.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc"],
      "definitions": {
        "intents": { 
          "value": {
            "flirt": 0, "comfort": 0, "negotiate": 0, "banter": 0,
            "challenge": 0, "assist": 0, "withdraw": 0, "observe": 0
          },
          "context_priority": "engine_private"
        },
        "current_intent": { "value": "observe", "context_priority": "ai_visible" }
      },
      "form_hints": {
        "current_intent": { "label": "Default Intent", "control": "select", "options": ["observe", "guard", "wander"], "default": "observe", "group": "AI Behavior" }
      }
    }
  },
  "actions": {
    "calculate_base_intents": {
      "kind": "system_auto",
      "trigger": "on_turn_start",
      "logic": [
        { "if": "social_dna.aggression > 70", "then": "intents.challenge += 20" },
        { "if": "social_dna.altruism > 70", "then": "intents.assist += 20" },
        { "if": "social_dna.sociability > 70", "then": "intents.banter += 20" },
        { "if": "relationships[target_id].attraction > 50", "then": "intents.flirt += 30" },
        { "if": "relationships[target_id].trust < 20", "then": "intents.withdraw += 40" }
      ]
    },
    "resolve_intent": {
      "kind": "system_auto",
      "trigger": "after_calculation",
      "logic": "current_intent = intents.sort_by_value().top()"
    }
  },
  "ai_instructions": {
    "mas2": {
      "outcome_instructions": "The NPC has chosen to [current_intent]. Describe this action consistent with their Social DNA."
    }
  }
}
```

### 1.3 Backstory & Context
**Name:** Static Backstory Context
**Source:**

```json
{
  "name": "Static Backstory Context",
  "ui_category": "foundation",
  "exclusion_group": "backstory_engine",
  "short_description": "Provides historical context and summary to the AI.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": {
        "backstory_summary": { "value": "", "context_priority": "ai_visible" }
      },
      "form_hints": {
        "backstory_summary": { "label": "Character History", "control": "textarea", "group": "Identity", "default": "A stranger with no past." }
      }
    }
  },
  "ai_instructions": {
    "mas2": {
      "framing_instructions": "Use 'backstory_summary' to inform the character's knowledge and biases. Do not contradict facts established here."
    }
  }
}
```

### 1.4 Core Skills System
**Name:** D100 Skill System
**Source:**

```json
{
  "name": "D100 Skill System",
  "ui_category": "foundation",
  "exclusion_group": "skill_engine",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "skills": { "value": {}, "context_priority": "engine_private" }, 
        "xp_progress": { "value": 0, "context_priority": "engine_private" }, 
        "narrative_cues": { "value": { "last_action_quality": "Average" }, "context_priority": "ai_visible" } 
      },
      "form_hints": {
        "skills": { "label": "Skill List", "control": "key_value_map", "group": "Capabilities", "default": {} }
      }
    }
  },
  "actions": {
    "roll_skill": {
      "kind": "interaction",
      "params": { "skill_id": "string" },
      "logic": [
        "let target_val = skills[skill_id] || 10",
        "let roll = 1d100",
        "if (roll <= target_val / 5) { narrative_cues.last_action_quality = 'Cinematic'; return 'critical_success' }",
        "if (roll <= target_val) { narrative_cues.last_action_quality = 'Competent'; return 'success' }",
        "narrative_cues.last_action_quality = 'Complicated'; return 'failure'"
      ]
    }
  },
  "ai_instructions": {
    "mas1": { "mechanical_triggers": "If User action matches a key in 'entity.skills', trigger 'roll_skill(skill_id)'." },
    "mas2": { "outcome_instructions": "Describe the action using the style defined in 'narrative_cues.last_action_quality'." }
  }
}
```

### 1.5 Conditions & Statuses
**Name:** Base Character Status System
**Source:**

```json
{
  "name": "Base Character Status System",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "active_statuses": { "value": [], "context_priority": "ai_visible" }, 
        "narrative_cues": { "value": { "dominant_emotion": null }, "context_priority": "ai_visible" } 
      },
      "form_hints": {
        "active_statuses": { "label": "Starting Statuses", "control": "array_object", "group": "Condition", "default": [] }
      }
    }
  },
  "actions": {
    "add_status": {
      "kind": "mechanical",
      "params": { "status_id": "string", "severity": "number" },
      "logic": "active_statuses.push({ id: status_id, severity: severity })"
    },
    "update_emotional_cues": {
      "kind": "system_auto",
      "trigger": "on_stat_change(active_statuses)",
      "logic": [
        { "if": "active_statuses.some(s => s.severity > 3)", "then": "narrative_cues.dominant_emotion = active_statuses.find(s => s.severity > 3).id" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "tone_instructions": "If 'narrative_cues.dominant_emotion' is set, that emotion must override all other tones." }
  }
}
```

### 1.6 Cinematic Time Tracker
**Name:** Cinematic Time Tracker
**Source:**

```json
{
  "name": "Cinematic Time Tracker",
  "ui_category": "foundation",
  "state_contributions": {
    "tier1_global": {
      "definitions": {
        "time_state": { "value": { "ticks": 0, "band": "Morning" }, "context_priority": "engine_private" },
        "narrative_cues": { "value": { "lighting": "Dim", "activity_level": "Low" }, "context_priority": "ai_visible" }
      },
      "form_hints": {
        "time_state.band": { "label": "Start Time", "control": "select", "options": ["Morning", "Midday", "Evening", "Night"], "default": "Morning" }
      }
    }
  },
  "actions": {
    "update_time_band": {
      "kind": "system_auto",
      "trigger": "on_stat_change(time_state.ticks)",
      "logic": [
        { "if": "time_state.ticks < 10", "then": "time_state.band = 'Morning'; narrative_cues.lighting = 'Dawn'" },
        { "if": "time_state.ticks >= 40", "then": "time_state.band = 'Night'; narrative_cues.lighting = 'Dark'" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "framing_instructions": "Establish scene lighting based on 'narrative_cues.lighting'." }
  }
}
```

---

## 2. EXPANSIONS (THE SPOKES)

### 2.1 Relationship Dynamics
**Name:** Relationship Dynamics
**Source:**
**Depends On:** Deep NPC Behaviors

```json
{
  "name": "Relationship Dynamics",
  "ui_category": "expansion",
  "dependencies": ["Deep NPC Behaviors"],
  "short_description": "Applies Friend/Rival tags based on complex thresholds.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "social_tags": { "value": [], "context_priority": "ai_visible" },
        "narrative_cues": { "value": { "relationship_label": "Stranger" }, "context_priority": "ai_visible" } 
      },
      "form_hints": {
        "social_tags": { "label": "Initial Tags", "control": "tag_list", "default": [] }
      }
    }
  },
  "actions": {
    "calc_social_tags": {
      "kind": "system_auto",
      "trigger": "on_stat_change(relationships)",
      "logic": [
        { "if": "relationships[target_id].affection > 70 && relationships[target_id].trust > 60", "then": "add_tag('friend'); narrative_cues.relationship_label = 'Friend'" },
        { "if": "relationships[target_id].respect > 80 && relationships[target_id].affection < 40", "then": "add_tag('rival'); narrative_cues.relationship_label = 'Rival'" },
        { "if": "relationships[target_id].trust < 20 && has_tag('friend')", "then": "remove_tag('friend'); add_tag('estranged'); narrative_cues.relationship_label = 'Estranged'" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "tone_instructions": "Adopt the tone associated with 'narrative_cues.relationship_label'. (Rival=Competitive, Estranged=Cold, Friend=Warm)." }
  }
}
```

### 2.2 Skill-Driven Behaviors
**Name:** Skill-Driven Behaviors
**Source:**
**Depends On:** Behavior Intent Framework, D100 Skill System

```json
{
  "name": "Skill-Driven Behaviors",
  "ui_category": "expansion",
  "dependencies": ["Behavior Intent Framework", "D100 Skill System"],
  "short_description": "Allows skills to influence NPC decision making.",
  "actions": {
    "apply_skill_weights": {
      "kind": "system_auto",
      "trigger": "on_turn_start",
      "logic": [
        { "if": "skills.persuade > 50", "then": "intents.negotiate += 15" },
        { "if": "skills.intimidate > 50", "then": "intents.challenge += 15" },
        { "if": "skills.empathy > 50", "then": "intents.comfort += 15" }
      ]
    }
  }
}
```

### 2.3 Quirks & Traits
**Name:** Quirks & Traits
**Source:** New Request
**Depends On:** Behavior Intent Framework

```json
{
  "name": "Quirks & Traits",
  "ui_category": "expansion",
  "dependencies": ["Behavior Intent Framework"],
  "short_description": "Adds flavor and micro-modifiers to behavior.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc"],
      "definitions": { "quirks": { "value": [], "context_priority": "ai_visible" } },
      "form_hints": {
        "quirks": { "label": "Personality Quirks", "control": "tag_list", "options": ["Hot-Headed", "Shy", "Greedy"], "default": [], "group": "Personality" }
      }
    }
  },
  "actions": {
    "apply_quirk_modifiers": {
      "kind": "system_auto",
      "trigger": "on_turn_start",
      "logic": [
        { "if": "quirks.includes('Hot-Headed')", "then": "intents.challenge += 10; intents.negotiate -= 10" },
        { "if": "quirks.includes('Shy')", "then": "intents.withdraw += 10; intents.flirt -= 20" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "tone_instructions": "Incorporate the entity's 'quirks' into their dialogue style." }
  }
}
```

### 2.4 Social Skillset
**Name:** Social Skillset
**Source:**
**Depends On:** D100 Skill System, Deep NPC Behaviors

```json
{
  "name": "Social Skillset",
  "ui_category": "expansion",
  "dependencies": ["D100 Skill System", "Deep NPC Behaviors"],
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "skills": { "value": { "persuade": 30, "intimidate": 30, "deceive": 30, "empathy": 30 }, "context_priority": "engine_private" },
        "narrative_cues": { "value": { "target_reaction": null }, "context_priority": "ai_visible" }
      },
      "form_hints": {
        "skills.persuade": { "label": "Persuasion", "control": "slider", "min": 0, "max": 100, "group": "Social Skills", "default": 30 },
        "skills.intimidate": { "label": "Intimidation", "control": "slider", "min": 0, "max": 100, "group": "Social Skills", "default": 30 }
      }
    }
  },
  "actions": {
    "intimidate": {
      "kind": "interaction",
      "logic": "roll_skill('intimidate')",
      "social_signature": { "aggression": 80 },
      "effects": {
        "success": "modify_relationship(target_id, 'respect', 10); narrative_cues.target_reaction = 'Cower'",
        "failure": "modify_relationship(target_id, 'affection', -10); narrative_cues.target_reaction = 'Scoff'"
      }
    },
    "flirt": {
      "kind": "interaction",
      "logic": "roll_skill('persuade')",
      "social_signature": { "sociability": 80 },
      "effects": {
        "success": "modify_relationship(target_id, 'attraction', 10); narrative_cues.target_reaction = 'Blush'",
        "failure": "modify_relationship(target_id, 'respect', -5); narrative_cues.target_reaction = 'Awkward'"
      }
    }
  },
  "ai_instructions": {
    "mas1": { "intent_mappings": "Threats -> 'intimidate'; Flirting/Romance -> 'flirt'." },
    "mas2": { "outcome_instructions": "Describe the NPC's response based on 'narrative_cues.target_reaction'." }
  }
}
```

### 2.5 Survival Needs
**Name:** Survival Needs
**Source:**
**Depends On:** Stamina & Exertion

```json
{
  "name": "Survival Needs",
  "ui_category": "expansion",
  "dependencies": ["Stamina & Exertion"],
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "needs": { "value": { "hunger": 0, "thirst": 0 }, "context_priority": "engine_private" },
        "narrative_cues": { "value": { "distraction_level": "None" }, "context_priority": "ai_visible" }
      },
      "form_hints": {
        "needs.hunger": { "label": "Hunger", "control": "slider", "min": 0, "max": 100, "group": "Needs", "default": 0 },
        "needs.thirst": { "label": "Thirst", "control": "slider", "min": 0, "max": 100, "group": "Needs", "default": 0 }
      }
    }
  },
  "actions": {
    "check_needs": {
      "kind": "system_auto",
      "trigger": "on_scene_end",
      "logic": [
        { "if": "fatigue.current > 70", "then": "needs.hunger += 10" },
        { "if": "needs.hunger > 80", "then": "narrative_cues.distraction_level = 'Severe'" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "tone_instructions": "Describe focus based on 'narrative_cues.distraction_level'." }
  }
}
```

### 2.6 Emotional Memory
**Name:** Emotional Memory
**Source:**
**Depends On:** Base Character Status System, Deep NPC Behaviors

```json
{
  "name": "Emotional Memory",
  "ui_category": "expansion",
  "dependencies": ["Base Character Status System", "Deep NPC Behaviors"],
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "emotional_memory": { "value": [], "context_priority": "engine_private" }, 
        "narrative_cues": { "value": { "recall_event": null }, "context_priority": "ai_visible" } 
      },
      "form_hints": {
        "emotional_memory": { "label": "Memories", "control": "array_object", "group": "Backstory", "default": [] }
      }
    }
  },
  "actions": {
    "check_memories": {
      "kind": "system_auto",
      "trigger": "on_turn_start",
      "logic": [
        { "if": "emotional_memory.some(m => m.weight > 5)", "then": "narrative_cues.recall_event = emotional_memory.find(m => m.weight > 5).event" }
      ]
    }
  },
  "ai_instructions": {
    "mas2": { "tone_instructions": "Reference the event in 'narrative_cues.recall_event' if it is not null." }
  }
}
```