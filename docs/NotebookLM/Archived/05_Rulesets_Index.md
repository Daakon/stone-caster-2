# 05 Rulesets Index

*(StoneCaster / Chimera Engine – MVP)*

This document defines the authoritative catalog of all **rulesets**, their **categories**, **dependencies**, **exclusion groups**, **state contributions**, and **AI bindings**.
These rulesets power the Chimera Compiler and determine MAS-1 behavior, Engine resolution paths, and MAS-2 narrative embodiment.

All JSON examples in this file use **quadruple backticks** (````) to ensure clean embedding.

---

# 1. Ruleset Categories

Rulesets are grouped into:

* **Foundation** (core mechanical systems)
* **Expansion** (optional NPC/behavior systems)
* **Flavor** (non-critical tone/style systems)

Each ruleset may specify:

* `dependencies` – which rulesets must be present
* `exclusion_group` – mutually exclusive category (e.g., only one skill core)
* `state_contributions` – Tier0/Tier1/Tier2 fields it can modify
* `ai_instructions` – MAS-1 and MAS-2 guidance

---

# 2. Full Ruleset Index Table

```md
| Key                          | Category    | Exclusion Group      | Dependencies                               | Summary |
|------------------------------|-------------|------------------------|---------------------------------------------|---------|
| d100-5-pillars              | foundation  | skill_system_root     | —                                           | Root 5 Pillars stats + cascade D100 system |
| d100-skill-engine           | foundation  | skill_system_root     | —                                           | Alternate D100 physics, crit bands |
| vitality-stamina-system     | foundation  | vitality_core         | —                                           | Stamina, exhaustion thresholds, collapse |
| needs-survival-basic        | foundation  | —                     | vitality-stamina-system, world-cycle-time-bands | Satiety/hunger decay + survival states |
| world-cycle-time-bands      | foundation  | time_core             | —                                           | Time band engine + duration tags |
| cinematic-combat-lite       | foundation  | combat_core           | —                                           | Contest ladder: Healthy→Wounded→Defeated |
| wealth-capability-lite      | foundation  | capability_core       | —                                           | Abstract wealth tiers + loadout archetypes |
| npc-personalities           | foundation  | —                     | —                                           | Core traits + emotional flavor |
| npc-relationships           | foundation  | —                     | —                                           | Affinity, memory spotlight, relationship tags |
| npc-values-motivations      | expansion   | —                     | npc-personalities                           | Values, motives, hard constraints |
| npc-value-impact-tagging    | expansion   | —                     | npc-values-motivations, npc-relationships   | Writes relationship-impact tags |
| npc-quirks-habits           | expansion   | —                     | npc-personalities                           | Conditional quirks + moods |
| npc-preferences-phobias     | expansion   | —                     | npc-personalities                           | Topic triggers → emotive shifts |
| npc-plot-drivers            | expansion   | —                     | npc-personalities                           | NPC agendas + urgency |
| npc-roles-background        | expansion   | —                     | npc-personalities                           | Social origin + competence tone |
| stamina-based-magic         | foundation  | magic_core            | vitality-stamina-system, d100-5-pillars     | Magic cost = stamina drain + exhaustion risk |
```

---

# 3. Dependency & Exclusion Rules

## 3.1 Exclusion Groups

Only **one** ruleset from each exclusion group may be selected:

* `skill_system_root`: choose one → `d100-5-pillars` **or** `d100-skill-engine`.
* `vitality_core`: stamina system must be unique.
* `combat_core`: only one combat engine.
* `capability_core`: only one wealth/inventory abstraction.
* `time_core`: only one time-band model.
* `magic_core`: only one magic system.

## 3.2 Dependencies

Examples:

* `needs-survival-basic` → requires both `vitality-stamina-system` AND `world-cycle-time-bands`.
* `npc-values-motivations` → requires `npc-personalities`.
* `npc-value-impact-tagging` → requires `npc-values-motivations` + `npc-relationships`.
* `stamina-based-magic` → requires stamina system + 5 Pillars for casting stat.

---

# 4. Ruleset Definitions (Expanded)

Below are **representative JSON structures** for each ruleset type.

## 4.1 Foundation Ruleset Example — d100-5-pillars

```json
{
  "key": "d100-5-pillars",
  "ui_category": "foundation",
  "exclusion_group": "skill_system_root",
  "dependencies": [],
  "state_contributions": {
    "tier1_entity.stats": {
      "root_force": 40,
      "root_finesse": 60
    },
    "tier2_system.physical_condition": "Rested"
  },
  "ai_instructions": {
    "mas1": {
      "intent_keywords": ["attack", "sneak", "climb"],
      "skill_routing": { "fallback_root": "root_force" }
    },
    "mas2": {
      "state_readouts": [
        {"path": "tier2_system.physical_condition", "label": "PHYSICAL CONDITION"}
      ],
      "style_injections": [
        {"content": "Convey exertion or steady breath when stamina shifts."}
      ]
    }
  }
}
```

## 4.2 Foundation Ruleset Example — vitality-stamina-system

```json
{
  "key": "vitality-stamina-system",
  "ui_category": "foundation",
  "exclusion_group": "vitality_core",
  "state_contributions": {
    "tier2_system.current_stamina": {"default": 100},
    "tier2_system.physical_condition": "Rested",
    "tier2_system.stamina_thresholds": {
      "rested": 80,
      "winded": 50,
      "exhausted": 20,
      "collapsed": 0
    }
  },
  "ai_instructions": {
    "mas1": {
      "hard_gates": ["no_travel_if_collapsed", "no_combat_if_exhausted"]
    },
    "mas2": {
      "style_injections": [
        {"content": "Show breath, posture, and effort depending on condition."}
      ]
    }
  }
}
```

## 4.3 Expansion Example — npc-quirks-habits

```json
{
  "key": "npc-quirks-habits",
  "ui_category": "expansion",
  "dependencies": ["npc-personalities"],
  "state_contributions": {
    "tier1_entity.emotional.quirk_map": {
      "finger_tapping": {
        "trigger_moods": ["anxious", "focused"],
        "description": "Taps fingers rhythmically against nearby surfaces."
      }
    }
  },
  "ai_instructions": {
    "mas2": {
      "style_injections": [
        {"content": "When a quirk triggers, subtly include it in NPC behavior."}
      ]
    }
  }
}
```

## 4.4 Expansion Example — npc-values-motivations

```json
{
  "key": "npc-values-motivations",
  "ui_category": "expansion",
  "dependencies": ["npc-personalities"],
  "state_contributions": {
    "tier1_entity.personality.core_values": ["Honor", "Discretion"],
    "tier1_entity.personality.current_objective": "Recover stolen guild keys"
  },
  "ai_instructions": {
    "mas2": {
      "narrative_restrictions": ["npc_must_resist_actions_against_core_values"]
    }
  }
}
```

## 4.5 Magic Example — stamina-based-magic

```json
{
  "key": "stamina-based-magic",
  "ui_category": "foundation",
  "exclusion_group": "magic_core",
  "dependencies": ["vitality-stamina-system", "d100-5-pillars"],
  "state_contributions": {
    "tier2_system.magic": {
      "casting_stat": "root_insight",
      "stamina_cost": 25
    }
  },
  "ai_instructions": {
    "mas1": {
      "intent_keywords": ["cast", "invoke", "summon"],
      "magic_rules": {"requires_stamina": true}
    },
    "mas2": {
      "style_injections": [
        {"content": "Magic feels physically draining; show strain or heat."}
      ]
    }
  }
}
```

---

# 5. Recommended MVP Bundles

## 5.1 Story Sandbox (Default)

* d100-5-pillars
* vitality-stamina-system
* world-cycle-time-bands
* npc-personalities
* npc-relationships
* npc-quirks-habits (optional)
* npc-values-motivations (optional)
* cinematic-combat-lite (optional)
* stamina-based-magic (variant)

## 5.2 Social Drama

* npc-personalities
* npc-relationships
* npc-values-motivations
* npc-roles-background
* npc-plot-drivers
* npc-quirks-habits

## 5.3 Survival Mode

* vitality-stamina-system
* world-cycle-time-bands
* needs-survival-basic
* npc-personalities

## 5.4 Action Skirmish

* d100-5-pillars
* cinematic-combat-lite
* vitality-stamina-system
* world-cycle-time-bands
* npc-personalities

---

# 6. Compiler Expectations for Rulesets

The compiler performs:

1. **Dependency resolution**
2. **Exclusion enforcement**
3. **State contribution merging**
4. **AI instruction aggregation (MAS-1 & MAS-2)**
5. **Conflict detection**

A ruleset is INVALID if:

* It violates an exclusion group
* It has unmet dependencies
* It writes outside Tier0/Tier1/Tier2 paths
* It overrides another ruleset’s field without namespace permission

---

# 7. Authoring UI Behavior for Rulesets

* Selecting a ruleset automatically selects its dependencies.
* Selecting a ruleset in an exclusion group disables its siblings.
* Hovering shows `description_short`; expand reveals `description_long`.
* Validation panel shows:

  * ✓ dependencies satisfied
  * ✗ unmet dependency
  * ✗ exclusion conflict

---

# 8. Summary

The Ruleset Index is the **canonical reference** for how the Chimera Engine behaves.
Every module—Compiler, Authoring UI, Runtime, MAS models—must use this index as the source of truth.

Any PR modifying rulesets must update:

* this document,
* the Domain Model,
* Prompt Assembly,
* Test Plan.

This ensures systemic coherence across StoneCaster.
