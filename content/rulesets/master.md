# StoneCaster MVP Ruleset Library (v1.8 - Backend Determinism)

This library defines the core physics and narrative logic for the StoneCaster MVP.

**Architecture Key:**
* **Logic Layer (Backend):** `system_auto` actions handle all math, comparisons, and state updates.
* **Narrative Layer (AI):** Instructions strictly map *State Values* to *Descriptions*. No calculations allowed.

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
        "social_dna": { "honesty": 50, "order": 50, "altruism": 50, "aggression": 50, "sociability": 50, "curiosity": 50 },
        "relationships": {},
        "narrative_cues": { "social_tone": "Neutral" }
      }
    }
  },
  "actions": {
    "modify_relationship": {
      "description": "Mechanic: Adjusts relationship values.",
      "kind": "mechanical",
      "params": { "target_id": "string", "stat": "string", "amount": "number" },
      "logic": "target.relationships[actor_id][stat] += amount"
    },
    "update_social_cues": {
      "description": "Backend: Calculates tone based on stats.",
      "kind": "system_auto",
      "trigger": "on_stat_change(relationships)",
      "logic": [
        { "if": "relationships[target_id].affection < 30", "then": "narrative_cues.social_tone = 'Hostile'" },
        { "if": "relationships[target_id].trust > 70", "then": "narrative_cues.social_tone = 'Confiding'" },
        { "if": "relationships[target_id].respect > 70", "then": "narrative_cues.social_tone = 'Deferential'" }
      ]
    }
  },
  "ai_instructions": {
    "intent_mappings": "Deception/Truth -> 'social_dna.honesty'; Rule-following/Chaos -> 'social_dna.order'; Generosity/Greed -> 'social_dna.altruism'; Violence/Peace -> 'social_dna.aggression'.",
    "tone_instructions": "Adopt the 'social_tone' defined in narrative_cues."
  }
}
```

### 1.2 Core Skills System
**Name:** D100 Skill System
**Source:**

```json
{
  "name": "D100 Skill System",
  "ui_category": "foundation",
  "exclusion_group": "skill_engine",
  "short_description": "The fundamental physics for skill checks.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "skills": {}, 
        "xp_progress": 0,
        "narrative_cues": { "last_action_quality": "Average" }
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
      ],
      "effects": { "success": "xp_progress += 1" }
    }
  },
  "ai_instructions": {
    "mechanical_triggers": "If User action matches a key in 'entity.skills', trigger 'roll_skill(skill_id)'.",
    "outcome_instructions": "Describe the action using the style defined in 'narrative_cues.last_action_quality'. (Cinematic=Flawless, Competent=Standard, Complicated=Setback)."
  }
}
```

### 1.3 Conditions & Statuses
**Name:** Base Character Status System
**Source:**

```json
{
  "name": "Base Character Status System",
  "ui_category": "foundation",
  "exclusion_group": "status_engine",
  "short_description": "Manages temporary physical and emotional states.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "active_statuses": [],
        "narrative_cues": { "dominant_emotion": null }
      }
    }
  },
  "actions": {
    "add_status": {
      "kind": "mechanical",
      "params": { "status_id": "string", "severity": "number", "duration": "string" },
      "logic": "active_statuses.push({ id: status_id, severity: severity, duration: duration })"
    },
    "update_emotional_cues": {
      "description": "Backend: Determines if a status is strong enough to dominate narration.",
      "kind": "system_auto",
      "trigger": "on_stat_change(active_statuses)",
      "logic": [
        { "if": "active_statuses.some(s => s.severity > 3)", "then": "narrative_cues.dominant_emotion = active_statuses.find(s => s.severity > 3).id" },
        { "if": "!active_statuses.some(s => s.severity > 3)", "then": "narrative_cues.dominant_emotion = null" }
      ]
    }
  },
  "ai_instructions": {
    "tone_instructions": "If 'narrative_cues.dominant_emotion' is set, that emotion must override all other tones."
  }
}
```

### 1.4 Stamina & Exertion
**Name:** Stamina & Exertion
**Source:**

```json
{
  "name": "Stamina & Exertion",
  "ui_category": "foundation",
  "exclusion_group": "base_energy_system",
  "short_description": "Tracks physical energy and the toll of heavy activity.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "fatigue": { "current": 0, "max": 100 },
        "narrative_cues": { "physical_state": "Fresh" }
      }
    }
  },
  "actions": {
    "exertion": { "kind": "mechanical", "params": { "amount": "number" }, "logic": "fatigue.current += amount" },
    "update_fatigue_cues": {
      "description": "Backend: Translates fatigue number into descriptive state.",
      "kind": "system_auto",
      "trigger": "on_stat_change(fatigue)",
      "logic": [
        { "if": "fatigue.current < 50", "then": "narrative_cues.physical_state = 'Fresh'" },
        { "if": "fatigue.current >= 50", "then": "narrative_cues.physical_state = 'Winded'" },
        { "if": "fatigue.current >= 90", "then": "narrative_cues.physical_state = 'Exhausted'" }
      ]
    }
  },
  "ai_instructions": {
    "tone_instructions": "Describe movement based on 'narrative_cues.physical_state'. (Winded=Heavy Breathing, Exhausted=Stumbling)."
  }
}
```

### 1.5 Environmental Context
**Name:** Core Scene Tracker
**Source:**

```json
{
  "name": "Core Scene Tracker",
  "ui_category": "foundation",
  "exclusion_group": "scene_engine",
  "short_description": "The world state tracking time, location, and atmosphere.",
  "state_contributions": {
    "tier1_global": {
      "definitions": {
        "scene_context": { "location_id": "unknown", "time_band": "midday", "environment_tags": [], "entities_present": [] }
      }
    }
  },
  "actions": {
    "set_context": {
      "kind": "system_auto",
      "params": { "key": "string", "value": "any" },
      "logic": "scene_context[key] = value"
    }
  },
  "ai_instructions": {
    "framing_instructions": "Frame scenes using 'scene_context'. Lighting must match 'time_band'. NPC volume/tone must match 'environment_tags' (e.g., whispering in a 'quiet' library)."
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
  "short_description": "Evolves raw numbers into meaningful relationships like 'Rival' or 'Friend'.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "social_tags": [],
        "narrative_cues": { "relationship_label": "Stranger" }
      }
    }
  },
  "actions": {
    "calc_social_tags": {
      "kind": "system_auto",
      "trigger": "on_stat_change(relationships)",
      "logic": [
        { "if": "relationships[target_id].affection > 70", "then": "add_tag('friend'); narrative_cues.relationship_label = 'Friend'" },
        { "if": "relationships[target_id].respect > 80 && relationships[target_id].affection < 40", "then": "add_tag('rival'); narrative_cues.relationship_label = 'Rival'" },
        { "if": "relationships[target_id].trust < 20 && has_tag('friend')", "then": "narrative_cues.relationship_label = 'Estranged'" }
      ]
    }
  },
  "ai_instructions": {
    "tone_instructions": "Adopt the tone associated with 'narrative_cues.relationship_label'. (Rival=Competitive, Estranged=Cold, Friend=Warm)."
  }
}
```

### 2.2 Influence & Manipulation
**Name:** Social Skillset
**Source:**
**Depends On:** D100 Skill System, Deep NPC Behaviors

```json
{
  "name": "Social Skillset",
  "ui_category": "expansion",
  "dependencies": ["D100 Skill System", "Deep NPC Behaviors"],
  "short_description": "Unlocks active social abilities like Persuade, Intimidate, and Deceive.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "skills": { "persuade": 30, "intimidate": 30, "deceive": 30, "empathy": 30 },
        "narrative_cues": { "target_reaction": null }
      }
    }
  },
  "actions": {
    "intimidate": {
      "kind": "interaction",
      "logic": "roll_skill('intimidate')",
      "social_signature": { "aggression": 80, "sociability": 60 },
      "effects": {
        "success": "modify_relationship(target_id, 'respect', 10); narrative_cues.target_reaction = 'Cower'",
        "failure": "modify_relationship(target_id, 'affection', -10); narrative_cues.target_reaction = 'Scoff'"
      }
    },
    "persuade": {
      "kind": "interaction",
      "logic": "roll_skill('persuade')",
      "social_signature": { "sociability": 80, "aggression": 10 },
      "effects": {
        "success": "modify_relationship(target_id, 'trust', 10); narrative_cues.target_reaction = 'Agree'",
        "failure": "narrative_cues.target_reaction = 'Doubt'"
      }
    }
  },
  "ai_instructions": {
    "intent_mappings": "Threats/Coercion -> 'intimidate'; Charm/Logic/Diplomacy -> 'persuade'.",
    "outcome_instructions": "Describe the NPC's response based on 'narrative_cues.target_reaction'."
  }
}
```

### 2.3 NPC Motivations
**Name:** NPC Motivations
**Source:**
**Depends On:** Deep NPC Behaviors

```json
{
  "name": "NPC Motivations",
  "ui_category": "expansion",
  "dependencies": ["Deep NPC Behaviors"],
  "short_description": "Gives NPCs the agency to form their own plans and desires.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc"],
      "definitions": {
        "current_intent": null,
        "intent_scores": { "intimidate": 0, "assist": 0 }
      }
    }
  },
  "actions": {
    "assess_npc_intent": {
      "kind": "system_auto",
      "trigger": "on_turn_start",
      "logic": [
        { "if": "social_dna.aggression > 80", "then": "intent_scores.intimidate += 20" },
        { "if": "social_dna.altruism > 70", "then": "intent_scores.assist += 30" },
        { "if": "intent_scores.intimidate > intent_scores.assist", "then": "current_intent = 'Intimidate'" },
        { "if": "intent_scores.assist > intent_scores.intimidate", "then": "current_intent = 'Assist'" }
      ]
    }
  },
  "ai_instructions": {
    "mechanical_triggers": "Calculate 'intent_scores' strictly using Logic.",
    "outcome_instructions": "Narrate the NPC acting out the 'current_intent'."
  }
}
```

### 2.4 Survival Needs
**Name:** Survival Needs
**Source:**
**Depends On:** Stamina & Exertion

```json
{
  "name": "Survival Needs",
  "ui_category": "expansion",
  "dependencies": ["Stamina & Exertion"],
  "short_description": "Converts fatigue into hunger and thirst mechanics.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "needs": { "hunger": 0, "thirst": 0 },
        "narrative_cues": { "distraction_level": "None" }
      }
    }
  },
  "actions": {
    "check_needs": {
      "description": "Backend: Updates distraction cues based on hunger.",
      "kind": "system_auto",
      "trigger": "on_scene_end",
      "logic": [
        { "if": "fatigue.current > 70", "then": "needs.hunger += 10; needs.thirst += 10" },
        { "if": "needs.hunger > 50", "then": "narrative_cues.distraction_level = 'Mild'" },
        { "if": "needs.hunger > 80", "then": "narrative_cues.distraction_level = 'Severe'" }
      ]
    }
  },
  "ai_instructions": {
    "tone_instructions": "Describe focus based on 'narrative_cues.distraction_level'. (Mild=Discomfort, Severe=Pain/Distraction)."
  }
}
```

### 2.5 Emotional Memory
**Name:** Emotional Memory
**Source:**
**Depends On:** Base Character Status System, Deep NPC Behaviors

```json
{
  "name": "Emotional Memory",
  "ui_category": "expansion",
  "dependencies": ["Base Character Status System", "Deep NPC Behaviors"],
  "short_description": "Allows past events to leave lingering emotional scars or boons.",
  "state_contributions": {
    "tier1_entity": {
      "target_kind": ["npc", "player"],
      "definitions": { 
        "emotional_memory": [],
        "narrative_cues": { "recall_event": null }
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
    "tone_instructions": "Reference the event in 'narrative_cues.recall_event' if it is not null."
  }
}
```