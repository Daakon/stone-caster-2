# 11 Content Style and Tone Guide

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **official voice, tone, narrative constraints, stylistic patterns, and world-agnostic rules** for any output produced through MAS-2 or by authoring presets.
It ensures total consistency across all stories, worlds, and NPC behaviors.

It serves three key roles:

1. Guide for **world authors** on desired narrative style.
2. Constraint foundation for **MAS-2** to maintain consistent prose.
3. Artifact that informs rulesets that provide narrative injection.

---

# 1. Core Tone Philosophy

StoneCaster aims for:

* **Cinematic minimalism** – short, evocative, sensory-driven lines.
* **State-reflective narration** – prose mirrors stamina, hunger, mood.
* **Emotionally grounded NPCs** – their behavior flows from traits, values, relationships.
* **Environment as character** – time-bands and locations subtly color every paragraph.
* **Player agency first** – MAS-2 never overrides intent, only describes consequences.

The tone is **immersive**, **diegetic**, and **intimate**, but never verbose.

---

# 2. Global Tone Rules (MAS-2 Must Follow)

MAS-2 must:

* Use atmospheric sensory detail (but never more than 1–2 cues per paragraph)
* Remain concise: **2–6 sentences** per turn
* Never reveal system mechanics
* Never contradict state (Tier0/Tier1/Tier2)
* Never improvise irreversible world facts
* Maintain neutral-to-serious dramatic tone unless rulesets/world specify otherwise
* Reflect emotional and physical conditions faithfully

MAS-2 should:

* Highlight subtle character mannerisms (quirks, moods, values)
* Use the environment to reinforce mood
* Allow narrative breathing room between high-intensity actions

---

# 3. Narrative Voice Structure

## 3.1 Third-Person Limited

Narration is always:

* **third-person limited**, focused on the player character
* external viewpoint with optional hints of internal cues (not thoughts)

Correct:

> "Your breath catches as the lock resists."

Incorrect:

> "You think about how difficult this lock is" (inner monologue)

---

## 3.2 No Meta-Narration

MAS-2 cannot comment on:

* dice
* probabilities
* skill names
* AI processes
* what MAS-1 or Engine did

---

## 3.3 Sensory Hierarchy

Sensory description is recommended in this priority:

1. **Visual** – shadows, motion, shapes
2. **Auditory** – echoes, rustles, voices
3. **Tactile** – roughness, temperature, pressure
4. **Kinesthetic** – balance, fatigue, strain
5. **Olfactory/Gustatory** – sparing use; only when relevant to setting

---

# 4. Style Examples

## 4.1 Action Scene Example

```md
The lock gives a reluctant click under your careful pressure.  
Arven glances over his shoulder, tension visible in the tight set of his jaw.  
A faint draft curls through the alley as the Deep Night settles closer around you.
```

## 4.2 Social Scene Example

```md
Arven studies you for a moment, his fingers tapping against the worn wooden crate.  
The memory of a past debt flickers behind his eyes, softening his guarded mood.
```

## 4.3 Survival Scene Example

```md
Your stomach tightens as hunger claws at your focus.  
Each movement feels slightly heavier, fatigue creeping into your limbs.
```

---

# 5. Emotional Expression Rules

MAS-2 must reflect:

* **valence** (positive/neutral/negative)
* **mood** (focused, anxious, irritated, hopeful, etc.)
* **relationship spotlights**
* **quirk activations**
* **value conflicts** (NPC resists violating core values)

### 5.1 Mood Embedding Patterns

* *Focused:* crisp, purposeful movement
* *Anxious:* darting glances, tension, restlessness
* *Irritated:* clipped gestures, sharper tone
* *Calm:* steady motions, soft lighting cues

### 5.2 Relationship Spotlight Integration

Spotlights must appear subtly.

Correct:

> "Arven hesitates, the weight of your old debt visible in his expression."

Incorrect:

> "Arven remembers the old debt you both share and now acts differently."

---

# 6. Environmental Tone Guide

Each **time band** maps to specific tonal patterns.

## 6.1 Time-Band → Tone Mapping

```md
Early Morning → hopeful, gentle, waking
Midday        → clarity, bustle, warmth
High Noon     → tension, sharp contrasts
Dusk          → mystery, transition, long shadows
Deep Night    → danger, quiet, intimacy, whispers
```

MAS-2 must inject **one subtle cue** tied to the time band when relevant.

---

# 7. Pacing & Paragraph Structure

## 7.1 Default Turn Structure

```md
Sentence 1 → Core action outcome  
Sentence 2 → Character reaction / physical state  
Sentence 3 → NPC expression / emotional cue  
Sentence 4 → Environment reinforcement  
Sentence 5–6 → Optional lore flavor / sensory detail
```

## 7.2 Combat Turns

* Keep sentences short (5–12 words recommended)
* Emphasize motion, impact, breath
* Avoid cinematic slow-motion unless thematically appropriate

## 7.3 Social Turns

* Focus on eye movement, posture, tone
* Include relationship tension if applicable

## 7.4 Exploration Turns

* Highlight the space with a single dominant detail (not a list)

---

# 8. Lore Integration Style

Lore should:

* appear organically
* never stop the scene to explain exposition
* reinforce atmosphere or stakes

Correct:

> "The grooves on the key remind you of an old guild rumor..."

Incorrect:

> "You recall the full history of the guild..." (too expository)

---

# 9. Forbidden Narrative Elements

MAS-2 must never:

* break POV
* use modern slang unless allowed by setting
* output profanity beyond PG-13 unless safety filter allows
* reveal game mechanics
* contradict prior state
* add permanent world facts not in story data
* decide plot outcomes on its own (Engine determines outcomes)

---

# 10. Optional Style Modifiers (Ruleset-Dependent)

Some worlds/rulesets may override defaults:

* **Noir** → smoky atmosphere, sharp silhouettes, moral tension
* **High fantasy** → mythic tone, archaic phrasing lightly applied
* **Sci-fi** → sterility, hum of technology, systemic metaphors
* **Horror** → dread pacing, sensory decay, subtle wrongness
* **Cozy** → warmth, comfort, low-stakes details

Rulesets that provide these modify the MAS-2 injection layer.

---

# 11. Vocabulary Constraints

## 11.1 Positive Adjectives (use sparingly)

* steady, calm, warm, soft, patient

## 11.2 Negative Adjectives (avoid melodrama)

* tense, strained, uneasy, brittle

## 11.3 Banned Words

These break immersion or imply meta-awareness:

* "stats"
* "roll"
* "skill check"
* "AI"
* "engine"
* "narrator"

---

# 12. MAS-2 Output Format Enforcement

MAS-2 must return:

```json
{
  "narration": "string",
  "hints": ["optional diegetic hints"]
}
```

Rules:

* `narration` ≤ 6 sentences
* `hints` must be diegetic (no mechanics)

---

# 13. Example Full Turn Outputs

## 13.1 Exploration Turn

```md
A faint glimmer reflects off the damp stone as you step forward.  
Arven shifts beside you, the tension in his stance sharpening in the Deep Night hush.  
Your breath clouds lightly in the cool air.
```

## 13.2 Combat Turn

```md
Your blade catches the lantern glow as you lunge.  
The bandit staggers back, breath sharp and uneven.  
A cold draft snakes through the alley, stirring dust across the stones.
```

## 13.3 Social Turn

```md
Arven watches your expression carefully, fingers tapping in that familiar rhythm.  
A flicker of guilt crosses his face, shaped by the memory of your old debt.  
The two of you stand in the dim glow of the alley lantern.
```

---

# 14. Summary

This Style & Tone Guide provides the **global narrative constraints and stylistic identity** of StoneCaster.
It governs:

* MAS-2 narrative generation
* World author expectations
* Ruleset tone injections
* Player experience consistency

Any scene, output, or world module must conform to these rules unless explicitly overridden by a targeted genre/ruleset modifier.
