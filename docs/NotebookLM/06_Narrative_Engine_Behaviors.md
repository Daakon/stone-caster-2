# 06 Narrative Engine Behaviors

*(StoneCaster / Chimera Engine – MVP)*

This document defines **exactly how the runtime turn-loop works** across:

**MAS-1 → Engine (deterministic) → MAS-2**,

including behavior pipelines, gating logic, emotional systems, quirk activation, relationship dynamics, survival states, and narrative constraints.
All JSON examples use quadruple backticks (````) to avoid formatting breaks.

---

# 1. Narrative Pipeline Overview

Every turn flows through the same deterministic process:

```md
Player Input
   ↓
MAS-1 (Interpretation)
   ↓
Engine (Deterministic Resolution)
   ↓
MAS-2 (Narrative Composition)
   ↓
Updated State + Narration Returned to UI
```

## 1.1 MAS-1 Responsibilities

* Extract intent
* Determine skill route
* Apply difficulty modifiers
* Assign duration tag (moment, scene, journey, rest)
* Detect gating failures (collapse, starving, combat-only actions)
* Return a strict JSON action structure

## 1.2 Engine Responsibilities

* Event Chaining: Aggregate and execute all logic blocks registered to a trigger (e.g., Travel -> Drain Stamina + Advance Time) in priority order.
* Execute ruleset-defined logic
* Apply stamina/survival changes
* Resolve skill or contest outcomes
* Update emotional states & relationships
* Apply quirks, agendas, phobias
* Advance time

## 1.3 MAS-2 Responsibilities

* Describe the outcome concisely and cinematically
* Embody NPC emotions, relationships, quirks, values, agenda
* Embed environment + time band tone
* Optionally incorporate relevant lore
* Never contradict state
* Never reveal mechanics or stats
* Produce 1–3 short paragraphs max

---

# 2. MAS-1 Behavior Specification

MAS-1 is a **pure interpreter**. It NEVER narrates.

### 2.1 Input Structure

```json
{
  "player_text": "Pick the rusty lock quietly.",
  "state_summary": "Deep Night; stamina low; NPC cautious; hunger rising.",
  "mas1_instructions": {"...": "..."}
}
```

### 2.2 Output Structure

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

If `blocked_reason` is non-null, Engine halts and returns a diegetic warning.

---

# 3. MAS-1 Processing Rules

## 3.1 Intent Extraction

Based on `intent_keywords` from rulesets:

* Attack/strike → combat action
* Sneak/quiet entry → finesse check
* Travel/walk/run → time advancement (duration = journey)
* Rest/eat/sleep → survival system hooks
* Cast/invoke → magic engine

## 3.2 Skill Routing

* If player specifies a known skill → use it
* Else → map to fallback root stat (defined in ruleset)

## 3.3 Difficulty Modifiers

Derived from text cues:

* "rusty", "unstable", "dark" → negative mod
* "simple", "familiar" → positive mod

## 3.4 Duration Tags (time system)

* moment: quick checks / combat / glances
* scene: detailed actions (lockpicking, searching)
* journey: travel across areas
* rest: sleep or meaningful recovery

## 3.5 Hard Gating

Examples:

* Collapsed → cannot travel or fight
* Starving → severe penalties or forced redirection
* Exhausted → combat may be blocked or heavily penalized

---

# 4. Engine Behavior Specification

The Engine is **deterministic** and performs NO LLM calls.

# 4.0 Event Execution Model 

When a trigger is received, the Engine retrieves the list of registered listeners from the logic_registry. It executes them sequentially by priority (System > World > Entity). If a step triggers a stop_execution flag (e.g. Collapse), the chain halts immediately.

## 4.1 Skill Resolution (D100 Systems)

Two possible cores:

* **d100-5-pillars** → roll-under root stat
* **d100-skill-engine** → alternative resolution physics

Outputs standardized:

```json
{
  "outcome": "crit|success|fail|fumble",
  "value": 37,
  "target": 55
}
```

## 4.2 Contest Resolution (Combat Lite, Wealth Checks)

Contest-based outcomes:

* actor_win
* target_win
* tie

Combat ladder:

* Healthy → Wounded → Defeated

## 4.3 Stamina System

```json
{
  "current_stamina": 88,
  "physical_condition": "Winded"
}
```

Stamina thresholds updated every turn.

## 4.4 Hunger / Survival

```json
{
  "hunger_state": "Hungry"
}
```

Decay tied to duration tags.

## 4.5 Emotional System

* valence (positive, neutral, negative)
* mood (focused, anxious, irritated)

NPC emotional state is shaped by:

* preferences/phobias
* relationship events
* environment stressors
* recent failures/successes

## 4.6 Relationship Spotlighting

The spotlight represents the dominant memory influencing current behavior.

```json
{
  "npc_arven": {
    "affinity": 33,
    "memory_spotlight": "Old Debt"
  }
}
```

MAS-2 must embody this.

## 4.7 Quirk Activation

Quirks trigger when mood matches rule-defined conditions.

Example:

```json
{
  "active_quirks": ["finger_tapping"]
}
```

## 4.8 Agenda & Plot Drivers

NPCs may attempt to redirect the scene toward their objective if urgency is high.

## 4.9 Time Advancement

Duration tags modify tick count → advances `current_time_band`.

---

# 5. MAS-2 Narrative Composition Rules

MAS-2 receives **updated state + resolution summary + instructions**.

### 5.1 MAS-2 Input Structure

```json
{
  "state_after_engine": {"...": "..."},
  "resolution_summary": "Finesse check barely succeeded.",
  "style_injections": ["night tone", "caution"],
  "state_readouts": ["STAMINA", "HUNGER", "RELATIONSHIP"],
  "lore_fragments": ["Rumor about guild locks..."]
}
```

### 5.2 MAS-2 Output Structure

```json
{
  "narration": "The lock gives a reluctant click as your careful work pays off...",
  "hints": ["You feel hunger tightening your focus."]
}
```

---

# 6. MAS-2 Narrative Laws (Strict)

MAS-2 MUST:

* Produce concise cinematic prose
* Embody personality, quirks, relationships, values
* Reflect survival conditions (hunger, stamina)
* Use sensory time-band cues (Deep Night → shadows, quiet, danger)
* Stay grounded strictly in current state

MAS-2 MUST NOT:

* Reveal dice rolls, stats, or system mechanics
* Contradict Engine outcomes
* Introduce new irreversible world facts
* Repeat player text verbatim
* Jump into player internal monologue

---

# 7. Environmental Tone Rules (Time Bands)

* **Early Morning:** pale light, quiet awakening
* **Midday:** clarity, bustle, heat
* **High Noon:** tension, harsh contrast
* **Dusk:** transition, secrecy
* **Deep Night:** danger, whispers, silhouettes

MAS-2 must incorporate at least **one atmospheric cue** when time changes.

---

# 8. Survival Tone Rules

### Hunger

* Well Fed → minimal description
* Hungry → growing tension, distraction
* Starving → intrusive discomfort, weakness

### Stamina

* Rested → normal movement
* Winded → strained breath
* Exhausted → slow, labored actions
* Collapsed → forced narrative stop

---

# 9. Combat Tone Rules

When combat occurs:

* Describe movement, tension, intent (aggressive, tactical, evasive)
* Wounded state must show pain, imbalance
* Defeated outcome matches player intent tone (merciful / brutal / tactical)

---

# 10. Magic Tone Rules

Magic feels **physical**:

* heat, drain, force, trembling
* exhaustion follows casting
* danger increases when stamina is low

---

# 11. Lore Integration Rules

MAS-2 may use lore only if contextually relevant.
It should:

* add atmosphere
* deepen stakes
* avoid infodumps

Example integration style:

> "Something about the lock reminds you of an old guild rumor..."

---

# 12. Error Handling

### MAS-1 Errors

* Missing intent → return actionable guidance
* Blocked action → diegetic refusal ("You’re too exhausted to move.")

### MAS-2 Errors

* Contradiction or missing readouts → runtime regenerates output using stricter prompt

---

# 13. Summary

The Narrative Engine is a **tri-system orchestration** where:

* **MAS-1 interprets** intent
* **Engine resolves** state changes deterministically
* **MAS-2 narrates** within strict systemic and stylistic constraints

These rules ensure:

* mechanical consistency
* emotional believability
* world coherence
* cinematic flow

This file is **canonical**. Any changes to narrative logic or ruleset behavior must update this spec.
