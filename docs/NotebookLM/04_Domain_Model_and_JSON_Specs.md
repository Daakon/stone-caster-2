# 04 Domain Model and JSON Specifications

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **canonical domain model**, **tiered game‑state architecture**, and all **JSON specifications** used across Authoring, Compiler, Runtime, and MAS pipelines.

To support NotebookLM and prevent broken formatting, **all JSON examples use quadruple backticks (````)** so they embed cleanly within the document.

---

# 1. Domain Model Philosophy

StoneCaster uses a **deterministic tiered world model**:

* **Tier 0 — World:** global constants, environment, time, rule choices.
* **Tier 1 — Entities:** players + NPCs, emotional/social/trait systems.
* **Tier 2 — Systems:** stamina, hunger, combat, magic, agendas, global flags.

This structure is **compiled**, not free‑form. MAS‑1/MAS‑2 *must obey* the resulting schema.

---

# 2. Tier Structure Overview

## 2.1 Tier 0 — World Fields (T0)

* `current_time_band`
* `current_tick`
* `environment.biome`
* `environment.culture_notes`
* Safety filters
* Ruleset list

## 2.2 Tier 1 — Entities (T1)

Each entity contains:

* Identity + role tags
* Stats (root/pillar stats; optional subskills)
* Defaults (stamina, satiety, archetypes)
* Personality (traits, values, quirks)
* Preferences (interest + aversion triggers)
* Relationships (affinity, memories, tags)
* Emotional state (valence, mood)
* Active conditions

## 2.3 Tier 2 — Systems (T2)

Rulesets populate:

* Stamina + threshold condition
* Hunger/survival state
* Combat condition ladder
* Time, survival, magic variables
* Agenda + plot flags
* Any rule‑bound global state

---

# 3. Full JSON Specifications

All JSON blocks use **quad‑backtick** fences:

```json
{
  "example": "This block uses four backticks"
}
```

---

# 3.1 WorldDefinition JSON

```json
{
  "world_id": "uuid",
  "title": "string",
  "summary": "string",
  "genre_tags": ["string"],
  "safety_filters": ["pg", "pg13", "rlite"],
  "ruleset_keys": [
    "d100-5-pillars",
    "vitality-stamina-system",
    "world-cycle-time-bands"
  ],
  "world_metadata": {
    "starting_time_band": "Dusk",
    "environment": {
      "biome": "urban",
      "culture_notes": "Low‑magic guild intrigue dominated by merchant factions"
    }
  }
}
```

---

# 3.2 EntityTemplate JSON

Entities may be players or NPCs; NPC fields allow deeper personality, relationship, and emotional modeling.

```json
{
  "entity_id": "uuid",
  "name": "Kiera",
  "tags": ["player"],
  "stats": {
    "root_force": 40,
    "root_finesse": 60,
    "root_awareness": 55,
    "root_insight": 45,
    "root_influence": 50
  },
  "defaults": {
    "current_stamina": 90,
    "satiety": 70,
    "wealth_tier": 1,
    "archetype_loadout": "Rogue"
  },
  "personality": {
    "core_traits": ["Brave", "Stoic"],
    "core_values": ["Honor"],
    "quirks": ["Taps fingers when thinking"],
    "current_objective": "Recover the missing ledger"
  },
  "preferences": {
    "interest_triggers": ["guild secrets", "old locks"],
    "aversion_triggers": ["betrayal", "tight spaces"]
  },
  "social": {
    "relationships": {
      "npc_arven": {
        "affinity": 35,
        "memory_spotlight": "Old Debt",
        "tags": ["trusted_contact"]
      }
    }
  },
  "emotional": {
    "valence": "neutral",
    "mood": "focused"
  }
}
```

---

# 3.3 RulesetDefinition (as stored in DB)

Each ruleset contributes:

* state fields
* actions (engine functions)
* MAS-1 intent mapping
* MAS-2 narrative injections

```json
{
  "id": "uuid",
  "key": "d100-5-pillars",
  "ui_category": "foundation",
  "exclusion_group": "skill_system_root",
  "version": "1.0.0",
  "description_short": "5 core stats and D100 resolution",
  "description_long": "Provides root stats, cascade routing, roll-under checks.",
  "dependencies": [],
  "provides_tags": ["skill_root"],
  "state_contributions": {
    "tier2_system.current_stamina": { "default": 100 },
    "tier2_system.physical_condition": "Rested"
  },
  "actions": {
    "resolve_skill_check": {
      "type": "engine_function",
      "parameters": ["skill_id", "difficulty"],
      "description": "Roll-under D100 resolution."
    }
  },
  "ai_instructions": {
    "mas1": {
      "intent_keywords": ["attack", "climb", "sneak"],
      "skill_routing": { "fallback_root": "root_force" }
    },
    "mas2": {
      "state_readouts": [
        { "path": "tier2_system.physical_condition", "label": "PHYSICAL CONDITION" }
      ],
      "style_injections": [
        { "content": "Describe strain or exertion when stamina is low." }
      ]
    }
  }
}
```

---

# 3.4 CompiledStory JSON

The compiler produces a deterministic artifact used by the runtime.

```json
{
  "story_id": "uuid",
  "world_id": "uuid",
  "version": "1.0.0",
  "selected_rulesets": [
    "d100-5-pillars",
    "vitality-stamina-system",
    "npc-personalities"
  ],
  "schema": {
    "tier0_world": {},
    "tier1_entity": {},
    "tier2_system": {}
  },
  "initial_state": {
    "tier0_world": {
      "current_time_band": "Deep Night",
      "current_tick": 0
    },
    "tier1_entities": {
      "player_id": {
        "name": "Kiera",
        "stats": {"root_force": 40, "root_finesse": 60},
        "emotional": {"valence": "neutral", "mood": "focused"}
      }
    },
    "tier2_system": {
      "current_stamina": 90,
      "physical_condition": "Winded",
      "hunger_state": "Hungry"
    }
  },
  /* NEW FIELD: Shows how the compiler stacks actions from different rulesets */
  "logic_registry": {
    "travel_action": [
      { 
        "source_ruleset": "vitality-stamina-system", 
        "priority": 10, 
        "steps": [ ... ] 
      },
      { 
        "source_ruleset": "world-cycle-time-bands", 
        "priority": 5, 
        "steps": [ ... ] 
      }
    ]
  },
  "instructions": {
    "mas1": {"...": "..."},
    "mas2": {"...": "..."}
  },
  "lore_index": {
    "retrieval": {"k": 3, "min_score": 0.65}
  },
  "provenance": {
    "compiled_at": "2025-12-06T00:00:00Z",
    "compiler_version": "1.0.0"
  }
}
```

---

# 3.5 RuntimeState JSON

This is the complete state that persists through turns.

```json
{
  "session_id": "uuid",
  "turn_index": 4,
  "tier0_world": {
    "current_tick": 4,
    "current_time_band": "Deep Night"
  },
  "tier1_entities": {
    "player_id": {
      "name": "Kiera",
      "stats": {"root_force": 40, "root_finesse": 60},
      "emotional": {"valence": "neutral", "mood": "focused"},
      "social": {
        "relationships": {
          "npc_arven": {
            "affinity": 33,
            "memory_spotlight": "Old Debt",
            "tags": ["trusted_contact"]
          }
        }
      }
    },
    "npc_arven": {
      "name": "Arven",
      "personality": {"core_traits": ["Cautious", "Methodical"]},
      "emotional": {"valence": "wary", "mood": "cautious"}
    }
  },
  "tier2_system": {
    "current_stamina": 88,
    "physical_condition": "Winded",
    "hunger_state": "Hungry",
    "combat_condition": null,
    "active_quirks": ["finger_tapping"]
  }
}
```

---

# 3.6 MAS-1 DTOs

## MAS-1 Input

```json
{
  "player_text": "Pick the rusty lock quietly.",
  "state_summary": "Deep Night; stamina low; hunger rising; NPC Arven cautious.",
  "mas1_instructions": {"...": "..."}
}
```

## MAS-1 Output

```json
{
  "intent": "attempt_action",
  "skill_id": "root_finesse",
  "difficulty_mod": -20,
  "duration_tag": "scene",
  "tactic_tag": null,
  "blocked_reason": null
}
```

---

# 3.7 MAS-2 DTOs

## MAS-2 Input

```json
{
  "state_after_engine":{"...":"..."},
  "resolution_summary":"Finesse check barely succeeded.",
  "style_injections":["night tone","caution","subtle tension"],
  "state_readouts":["STAMINA","HUNGER","RELATIONSHIP"],
  "lore_fragments": [
    "Rumor: Guild locks sometimes refuse unworthy hands."
  ]
}
```

## MAS-2 Output

```json
{
  "narration":"The lock gives a reluctant click...",
  "hints":["Your stomach tightens with hunger."]
}
```

---

# 4. Naming Rules

* All fields use `snake_case`.
* Enum values are lowercase or Title Case depending on system.
* No dynamic keys except entity IDs.

---

# 5. Deterministic Requirements

* Schema cannot change after compile.
* MAS-1/MAS-2 may only access whitelisted paths.
* Runtime updates only allowed for rule‑authorized fields.
* Ruleset additions must extend, not break, schemas.

---

# 6. Summary

This unified Domain Model governs:

* Authoring validity
* Compiler merge logic
* Runtime state evolution
* Prompt assembly boundaries
* MAS-1/MAS-2 behavior

It is the **canonical source-of-trust** and must remain in sync
