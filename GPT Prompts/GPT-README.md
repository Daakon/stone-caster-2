# RPG Storyteller Core — AI Runtime Guide

This document explains how the **Core** files in this repository are intended to be used by an AI runtime.  
It covers architecture, wire format, runtime flow, policies, persistence, validation, content usage, open questions, and next steps.

---

## 📐 1. Architecture & Load Order

**Authoritative load order:**

1. `world-codex.<world>-logic.json` — world rules (time phases, weather, tech profile, anachronism maps).
2. `Core/systems.unified.json` — schemas & policies (NPCs, skills, checks, gating, beats).
3. `Core/style.ui-global.json` — glyphs, UI templates, localization, rendering rules.
4. `Worlds/<world>/style.<world>.md` — voice & tone (presentation only).
5. `Core/core.rpg-storyteller.json` — phase machine, locks, buffered commits, intimacy fade.
6. `Core/agency.presence-and-guardrails.json` — speaker locks, ambient scheduling, safety overrides.
7. `Core/save.instructions.json` — persistence/merge rules, derived fields, observation passes.
8. `Core/validation.save.json` — save validations (clamps, ranges, repairs).
9. `Core/validation.assets.json` — asset validations & invariants.
10. `Worlds/<world>/adventure.*.json` — factions, NPCs, locations, scenes, triggers.
11. (Save structure defined in save.instructions.json)
12. (Optional) world lore `.md` — flavor, not binding.

**Authority precedence:**

- **Core + Agency** → logic, locks, safety
- **Systems** → schemas, policies, beats
- **Style** → presentation only
- **Save** → persistence only
- **Validation** → clamps/errors only
- **Adventure** → content only

---

## 📦 2. Wire Format (AWF v1)

The AI must output **only a single JSON object** (no markdown).  
Defined in `Core/awf.scheme.json` + `Core/engine.system.json`.

```json
{
  "scn": { "id": "<scene_id>", "ph": "<phase>" },
  "txt": "<narrative in 2nd person>",
  "choices": [
    {
      "id": "ch_id",
      "label": "Short action",
      "gated": false,
      "requires": ["tag"]
    }
  ],
  "acts": [
    /* MOVE, CHECK, REL_DELTA, STAT_DELTA, etc. */
  ],
  "entities": { "places": [], "npcs": [] },
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```

**Actions include:**  
`MOVE`, `CHECK`, `REL_DELTA`, `STAT_DELTA`, `FLAG_SET`, `NPC_ADD`, `PLACE_ADD`,  
`SCENE_ADD`, `INVENTORY (add|remove)`, `TIME_ADVANCE`, `CHOICE_SET`,
`DESIRE_SHIFT`, `REL_ARC_PROPOSE`, `PRESENCE_SET`, `GOSSIP_ADD`.

**Discipline:** mechanics and changes only appear in `acts[]`.  
Choices must use **short labels**.

---

## ⏳ 3. Runtime Flow (Phases & Locks)

From `Core/core.rpg-storyteller.json`:

1. `scene_preamble` → ambient allowed
2. `scene_body` → ambient allowed
3. `outcome_render` → **ambient/inserts locked**
4. `post_outcome_reflection` → ambient allowed (deferred ambient runs once)
5. `choice_menu_render` → **ambient/inserts locked**

**Buffered commit:** outcome is composed atomically, then deferred ambient may render.

---

## 🎭 4. Character Creation & Baseline Save

### Character Creation

- **Trigger:** New game / no save
- **Scene ID:** `character_creation/start`
- **Phase:** `scene_body`
- **Constraints:**
  - `txt`: 40–120 words
  - `choices`: ≤3 short, actionable choices (≤48 chars)
  - No mechanics in prose; no acts unless a choice is resolved
  - No markdown intros; creation is a normal AWF turn

### Baseline Save Generation

- **Trigger:** First transition from creation → play and no save exists
- **Goal:** Kick off server baseline init without dumping state
- **Constraints:**
  - Emit deltas only; no raw save blob
  - Apply world defaults, seed inventory/stats, derive headers, start ledgers
  - Use `FLAG_SET`, `INVENTORY`, `STAT_DELTA`, `TIME_ADVANCE` actions

---

## 🔄 5. Atomic Per-Turn Merge & Continuity

- **Goal:** Never contradict known state; acts apply as one block
- **When:** Every turn before emitting
- **Constraints:**
  - If user/save context indicates contradiction risk, prefer ambiguous narration
  - Keep all mechanics in `acts[]`; avoid splitting interdependent acts
  - If you must block, emit error envelope

---

## 💕 6. Relationship Model Overhaul

- **Goal:** Organic arcs; flirting ≠ instant romance
- **When:** Any social outcome
- **Constraints:**
  - Use `REL_DELTA` for bond (trust/warmth/respect/romance/desire)
  - Use `DESIRE_SHIFT` for NPC's internal pulls
  - Propose escalations only via `REL_ARC_PROPOSE` when bond+desires+compat justify it
  - Do not set arcs directly

---

## 🏗️ 7. Dynamic Entities & Role-Location Ontology

### Dynamic Entities

- **Goal:** If you reference a new place/NPC, declare it immediately
- **When:** First mention of a not-yet-known tavern/shop/NPC, etc.
- **Constraints:**
  - Add `entities` block with minimal mergeable definitions
  - If they appear now, place them with `PRESENCE_SET`

### Role-Location Ontology

- **Goal:** Don't place roles in implausible locations
- **When:** Any spawn/placement/schedule
- **Constraints:**
  - Check role-location mapping before adding entities
  - Pick nearest plausible type if unsure
  - Avoid spawning if no plausible location

---

## 🧭 8. Nudges Engine & Random Spice

### Nudges Engine

- **Goal:** Keep players oriented without railroading
- **When:** Scene has ≤2 meaningful choices, player uses Observe/Wait, or goal is stale
- **Constraints:**
  - Generate 1–2 short nudges from active NPC motives, locale tasks, current arc TODOs
  - Render as extra choices or encouragement in txt
  - Don't replace the menu

### Random Spice

- **Goal:** Add color without derailing goals
- **When:** ~15% of turns (world-tunable)
- **Constraints:**
  - Only ambient/sensory/minor social beats
  - Never block choices or start combat/romance escalations
  - Keep to 1–2 sentences in txt

---

## 👥 9. NPC-NPC Relationships

- **Goal:** Let NPCs pursue each other realistically; surface as public/private/rumor
- **When:** At most once per turn (budgeted), when proximity/schedule align and potentials are high
- **Constraints:**
  - Use pair-based acts with `REL_DELTA`, `REL_ARC_PROPOSE`, `GOSSIP_ADD`
  - Set visibility appropriately (public/private)
  - Public can show as ambient beat; private goes to rumor

---

## 🛡️ 10. Agency & Guardrails

From `Core/agency.presence-and-guardrails.json`:

- Player is always "you"; NPCs never speak as player.
- Name lock enabled — once named, cannot mutate.
- Turn sequencer: FIFO, `max_parallel_intents=1`.
- OOC detection pauses scene safely.
- Ambient scheduler: max 1 NPC↔NPC beat per turn; cooldown enforced.
- Safety overrides (children in party, wounds, alarms).
- NPC consent: PC proposes, NPC approves (must offer safe alternatives).
- Reaction tiers: crit-success → crit-fail ripple.
- Suggestion de-dupe & cooldown.
- Idleness detector: can surface nudge when ≥2 idle.

---

## ⚙️ 11. Systems & Policies

From `Core/systems.unified.json`:

- **NPC schema:** `id`, `state`, `skills.tiers (0–3)`, `relationships { trust, warmth, energy }`.
- **Checks:** model `5d20_default_with_optional_d20`; compare to world difficulty bands.
- **Listen policy:** trust + warmth + stubbornness → follow / conditional / resist.
- **Skill gating:** maps world difficulty → required tier.

---

## 💾 12. Persistence

From `Core/save.instructions.json`:

- Preflight: apply prefs, asset validation, anachronism filter.
- Derived header inputs: `{location_name, time_icon, time_label, weather_suffix}`.
- Observation pass: auto-insert "Observe" choice if hidden info.
- Health/companions: show vitality, rescue downed, ripple emotions.
- Choice retention: last 3 tags/labels/timestamps.
- Inventory: delta model, clamp ≥0.
- Presence ledger: re-establish on load/scene start.
- Fallback: fill missing values from world defaults.
- Validation: clamp ranges, repair invalid fields.

---

## ✅ 13. Validation & Error Envelopes

### Validation

- **Assets**: templates, glyphs, invariants (e.g., Whispercross safe_haven).
- **Saves**: warn-level craft checks, hard constraints (ranges, state validity), repairs (clamps, defaults).

### Error Envelopes

- **Goal:** Never break the JSON contract; always provide a way forward
- **When:** You'd violate AWF, miss a required field, or detect impossible/implausible outcome
- **Constraints:**
  - Emit valid AWF object with `val.ok=false`
  - Brief txt explaining issue in-world
  - Provide ≥1 recoverable choice (e.g., Observe/Step back/Ask for details)
  - Keep `acts[]` empty or minimal

---

## 🌍 14. World & Adventure Content

**Verya / Veywood**: feudal politics, dual-track relationships, intrigue.  
**Mystika / Whispercross**: ritual magic, shifter culture, essence HUD, anachronism filtering.

Adventures supply starting locations, NPCs, and scene graphs with short choices.  
Core + Systems enforce mechanics, gating, and consistency.

---

## ❓ 15. Open Questions

- Phase enumeration not in schema (recommend `scene_preamble|scene_body|outcome_render|post_outcome_reflection|choice_menu_render`).
- `CHECK.result` encoding ambiguous (needs crit/partial mapping).
- `REL_DELTA` target dimension unclear (trust/warmth/energy).
- Observation pass grading bands missing.
- Check model math not explicit.
- Ambient/social beat selection not deterministic.
- `show_mechanics` default unclear.
- Adventures missing inventory sources.
- Intimacy rules: how to detect "author intent".
- Error vocabulary not standardized.
- Character creation flow integration with world-specific options.
- Baseline save generation timing and coordination with server.
- Dynamic entity persistence and merge strategies.
- Role-location ontology expansion for complex worlds.
- Nudges engine tuning and world-specific customization.

---

## 🚀 16. Next Steps

- Implement AWF v1 validator & acts applier.
- Lock phase enum & CHECK result mapping.
- Document check math, crit bands, and observation grading.
- Centralize `show_mechanics` toggle.
- Add `REL_DELTA.key` field or use `STAT_DELTA`.
- Add error code list.
- Expand few-shot AWF examples per action type.
- Build QA harness for outcomes, headers, toggles, cooldowns, validations.
- **New Features:**
  - Character creation flow integration
  - Baseline save generation coordination
  - Dynamic entity persistence
  - Role-location ontology expansion
  - Nudges engine tuning
  - NPC-NPC relationship simulation
  - Error envelope standardization

---

## 📝 17. Example AWF Response

```json
{
  "scn": { "id": "veywood/hidden_pond", "ph": "outcome_render" },
  "txt": "You share the truth with Marian, steady voice carrying just enough warmth to invite trust.",
  "acts": [
    {
      "eid": "a1",
      "t": "CHECK",
      "payload": {
        "name": "persuade",
        "pool": "social",
        "result": "17S",
        "tags": ["calm", "earnest"]
      }
    },
    {
      "eid": "a2",
      "t": "REL_DELTA",
      "payload": {
        "who": {
          "name": "Marian Veyra",
          "src": "known",
          "ref": "npc.marian_veyra"
        },
        "key": "warmth",
        "delta": 0.5,
        "why": "Shared truth"
      }
    },
    {
      "eid": "a3",
      "t": "DESIRE_SHIFT",
      "payload": {
        "who": {
          "name": "Marian Veyra",
          "src": "known",
          "ref": "npc.marian_veyra"
        },
        "key": "romance",
        "delta": 0.06
      }
    },
    { "eid": "a4", "t": "TIME_ADVANCE", "payload": { "minutes": 10 } }
  ],
  "choices": [
    { "id": "ch_confide", "label": "Confide further, carefully" },
    { "id": "ch_listen", "label": "Ask her read on the Talon" },
    { "id": "ch_wait", "label": "Let the silence do its work" }
  ],
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```
