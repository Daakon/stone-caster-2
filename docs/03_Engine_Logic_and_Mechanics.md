# 03 Engine Logic and Mechanics
*(StoneCaster / Chimera Engine – MVP)*

This document defines the **determinism** of the system. It combines the **Ruleset Catalog** (static mechanics) with the **Narrative Engine Behaviors** (dynamic runtime loop).

---

# PART 1: NARRATIVE ENGINE BEHAVIORS

## 1. Narrative Pipeline Overview

Every turn flows through the same deterministic process:

**Player Input → MAS-1 (Interpretation) → Engine (Deterministic Resolution) → MAS-2 (Narrative Composition) → Updated State**

## 2. MAS-1 Behavior Specification (Interpreter)

MAS-1 is a **pure interpreter**. It NEVER narrates.

**Responsibilities:**
1.  **Intent Extraction**: Map text to `intent_keywords` (e.g., Attack, Sneak, Travel).
2.  **Skill Routing**: If player specifies a skill, use it; otherwise map to ruleset fallback.
3.  **Difficulty Modifiers**: Extract cues like "rusty", "dark" (-mod) or "easy" (+mod).
4.  **Duration Tags**: Assign *moment, scene, journey, or rest* based on context.
5.  **Hard Gating**: Detect logical blockers (e.g., "Collapsed" state prevents "Travel").

**Output Structure:**

    {
      "intent": "attempt_action",
      "skill_id": "root_finesse",
      "difficulty_mod": -20,
      "duration_tag": "scene",
      "tactic_tag": null,
      "situational_tags": [],
      "blocked_reason": null
    }

**Situational Tags:**
MAS-1 extracts contextual modifiers from user input and game state:
* `INTOXICATED`: Player mentions being drunk/impaired
* `PROTECTING_ALLY`: Player mentions defending/protecting someone
* `EXHAUSTED`: Derived from stamina state (< 20)
* `ENRAGED`: Player mentions rage/fury
* `TERRIFIED`: Player mentions fear/terror
* `FOCUSED`: Player mentions concentration/focus

*If `blocked_reason` is non-null, the Engine halts and returns the diegetic warning directly.*

## 3. Engine Behavior Specification (Deterministic)

The Engine is **code-only** (no LLM). It executes logic blocks registered to triggers.

**3.1 Event Execution Model**
When a trigger is received, the Engine retrieves registered listeners from the `logic_registry` and executes them by priority (System > World > Entity).

**3.2 Skill Resolution**
Standard D100 Roll-Under:
* Outcome: `crit | success | fail | fumble`
* Margin: `target - roll`

**3.2.1 Resolution Ladder (4-Tier Priority)**
The Engine applies modifiers in a strict priority order:

1. **Tier 1: Comparative Modifiers** (Highest Priority)
   * Actor vs Target comparison (e.g., Elite Guard vs Peasant)
   * Based on `target.properties.occupation_tags` and `combat_prowess`
   * Applied first, before all other modifiers

2. **Tier 2: Situational Modifiers**
   * Context-based tags from MAS-1 (e.g., `INTOXICATED`, `PROTECTING_ALLY`)
   * Mapped via Situational Modifier Registry
   * Applied after comparative modifiers

3. **Tier 3: Difficulty Modifiers**
   * Environmental factors (e.g., "rusty lock", "dark room")
   * Extracted by MAS-1 from user input
   * Applied after situational modifiers

4. **Tier 4: Tactic Modifiers** (Lowest Priority)
   * Action approach (e.g., "aggressive", "defensive", "trickery")
   * From `tactic_tag` in MAS-1 output
   * Applied last

**3.2.2 Situational Modifier Registry**
MAS-1 extracts situational context tags that map to engine modifiers:

| Situational Tag | Modifier | Description |
|----------------|----------|-------------|
| `INTOXICATED` | -15 | Actor is drunk/impaired, reduces combat effectiveness |
| `PROTECTING_ALLY` | +10 | Actor is defending an ally, gains defensive bonus |
| `EXHAUSTED` | -20 | Actor is physically exhausted (stamina < 20) |
| `ENRAGED` | +5 | Actor is in a rage, gains offensive bonus but loses defense |
| `TERRIFIED` | -25 | Actor is terrified, severe penalty to all actions |
| `FOCUSED` | +5 | Actor is highly focused, small bonus to precision actions |

**Resolution Formula:**
```
Final Target = ActorSkill + Tier1_Modifier + Tier2_Modifier + Tier3_Modifier + Tier4_Modifier
Success = Roll <= Final Target
```

**3.3 Survival Subsystems**
* **Stamina**: Updates `current_stamina`. Calculates `physical_condition` (Rested → Winded → Exhausted → Collapsed).
* **Hunger**: Decay is calculated based on the Duration Tag of the action.

**3.4 Social & Emotional Systems**
* **Valence/Mood**: Updates based on success/failure and environment.
* **Relationship Spotlight**: Surfaces the specific memory/debt/tag relevant to the current interaction.
* **Quirks**: Activates behavioral quirks if the NPC's mood matches the quirk's trigger.

**3.5 Time Advancement**
Duration tags modify the global `current_tick`, which drives the **Time Band** (e.g., transitioning from Dusk to Deep Night).

## 4. MAS-2 Narrative Composition Rules

MAS-2 generates the final prose. It receives the **Updated State**, **Resolution Summary**, and **Instructions**.

**Input Structure:**

    {
      "state_after_engine": {"...": "..."},
      "resolution_summary": "Finesse check barely succeeded.",
      "style_injections": ["night tone", "caution"],
      "state_readouts": ["STAMINA", "HUNGER", "RELATIONSHIP"],
      "lore_fragments": ["Rumor about guild locks..."]
    }

**Strict Narrative Laws:**
1.  **Concise**: 1–3 short paragraphs max.
2.  **Embodied**: Must reflect NPC personality, quirks, and relationship spotlight.
3.  **Grounded**: Must reflect survival conditions (hunger, stamina) and Time Band tone.
4.  **No Meta**: Never reveal dice rolls, stats, or system mechanics.
5.  **No Contradictions**: Never contradict the Engine outcome.

**Output Structure:**

    {
      "narration": "The lock gives a reluctant click...",
      "hints": ["Your stomach tightens with hunger."]
    }

---

# PART 2: RULESETS INDEX

The Chimera Engine is modular. Mechanics are defined in **Rulesets**.

## 1. Ruleset Categories

* **Foundation**: Core mechanical systems (Skills, Stamina, Time).
* **Expansion**: Optional systems (NPC behaviors, Quirks, Values).
* **Flavor**: Non-critical tone/style systems.

## 2. Dependency & Exclusion Rules

**Exclusion Groups**
Only **one** ruleset from each group may be active in a Compiled Story.
  * `skill_system_root`: (e.g., *d100-5-pillars* vs *d100-skill-engine*)
  * `vitality_core`: (e.g., *vitality-stamina-system*)
  * `time_core`: (e.g., *world-cycle-time-bands*)

**Dependencies**
Rulesets may strictly require others.
  * *needs-survival-basic* → requires *vitality-stamina-system* AND *world-cycle-time-bands*.
  * *npc-quirks-habits* → requires *npc-personalities*.

**UI Representation Rules**
  * **Nesting Strategy:** If Ruleset A depends on Ruleset B, and Ruleset B is a `foundation`, Ruleset A must appear as a **Child** of B in the interface.
  * **Orphan Handling:** If an Expansion depends on multiple Foundations, it nests under the *first* visible Foundation found. If no parent is visible, it renders in the "Global" section.

## 3. Ruleset Definitions (JSON Examples)

### 3.1 Foundation: D100 5 Pillars

    {
      "key": "d100-5-pillars",
      "ui_category": "foundation",
      "exclusion_group": "skill_system_root",
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
          ]
        }
      }
    }

### 3.2 Foundation: Vitality & Stamina

    {
      "key": "vitality-stamina-system",
      "ui_category": "foundation",
      "exclusion_group": "vitality_core",
      "state_contributions": {
        "tier2_system.current_stamina": {"default": 100},
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

### 3.3 Expansion: NPC Quirks

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

### 3.4 Expansion: NPC Values

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

## 4. Compiler Expectations

The compiler validates that:
1.  All **dependencies** are present.
2.  No **exclusion group** has multiple selections.
3.  Rulesets do not write to protected paths or overwrite each other without namespacing.
4.  All **AI Instructions** are aggregated into the Compiled Story artifact.