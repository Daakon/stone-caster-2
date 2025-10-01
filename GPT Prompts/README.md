# RPG Storyteller Core — Definitive AI Runtime Guide

This document merges the strengths of two analyses:

- **C-README.md** (behavioral nuance, safety, fallback handling)
- **GPT-README.md** (technical completeness, persistence, schema gaps, implementation steps)

Each section notes where insights originated. This serves as the **authoritative README** for the RPG Storyteller prompt rules.

---

## 📐 1. Architecture & Load Order

**Authoritative load order:** (from both)

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

(from both, unified)

The AI must output **only a single JSON object** (no markdown).

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
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```

**Actions include:**  
`MOVE`, `CHECK`, `REL_DELTA`, `STAT_DELTA`, `FLAG_SET`, `NPC_ADD`, `PLACE_ADD`,  
`SCENE_ADD`, `INVENTORY (add|remove)`, `TIME_ADVANCE`, `CHOICE_SET`.

**Discipline:**

- Mechanics and changes only appear in `acts[]`.
- Choices must use **short labels**.

---

## ⏳ 3. Runtime Flow (Phases & Locks)

(from C-README with details)

Phases:

1. `scene_preamble` → ambient allowed
2. `scene_body` → ambient allowed
3. `outcome_render` → **ambient/inserts locked**
4. `post_outcome_reflection` → ambient allowed (deferred ambient runs once)
5. `choice_menu_render` → **ambient/inserts locked**

**Buffered Commit (step-by-step):**

1. Snapshot buffer before outcome render
2. Render outcome into snapshot
3. Commit as one atomic block
4. Release locks
5. Append deferred ambient beats

---

## 🛡️ 4. Agency & Guardrails

(from both, merged)

- Player is always “you”; NPCs never speak as player.
- Name lock enabled — once named, cannot mutate.
- Turn sequencer: FIFO, `max_parallel_intents=1`.
- OOC detection pauses scene safely.
- Ambient scheduler: max 1 NPC↔NPC beat per turn; cooldown enforced.
- Safety overrides:
  ```json
  {
    "children_in_party_blocks_offense": true,
    "severe_wounded_blocks_offense": true,
    "recent_alarm_raises_stealth_dc": true
  }
  ```
- NPC consent: PC proposes, NPC approves (safe alternatives).
- Reaction tiers: crit-success → crit-fail ripple.
- Suggestion de-dupe & cooldown.
- Idleness detector: can surface nudge when ≥2 idle.
- **First-Meet Policy (from C-README):** NPC intros show only observable traits; secrets, backstory, and hidden goals are withheld.

---

## ⚙️ 5. Systems & Policies

(from both)

- **NPC schema:** `id`, `state`, `skills.tiers (0–3)`, `relationships { trust, warmth, energy }`.
- **Checks:** model `5d20_default_with_optional_d20`; compare to world difficulty bands.
- **Listen policy:** trust + warmth + stubbornness → follow / conditional / resist.
- **Skill gating:** maps world difficulty → required tier.
- **NPC social beats:** only during eligible phases (`scene_body`, `post_outcome_reflection`), max one per scene.

---

## 💾 6. Persistence

(from GPT-README for completeness)

- Preflight: apply prefs, asset validation, anachronism filter.
- Derived header inputs: `{location_name, time_icon, time_label, weather_suffix}`.
- Observation pass: auto-insert “Observe” choice if hidden info.
- Health/companions: show vitality, rescue downed, ripple emotions.
- Choice retention: last 3 tags/labels/timestamps.
- Inventory: delta model, clamp ≥0.
- Presence ledger: re-establish on load/scene start.
- Fallback: fill missing values from world defaults.
- Validation: clamp ranges, repair invalid fields.
- **Graceful degradation (from C-README):** missing templates → plain text, missing derived fields → empty strings, missing assets → continue best effort.

---

## ✅ 7. Validation

(from both)

- **Assets**: templates, glyphs, invariants (e.g., Whispercross safe_haven).
- **Saves**: warn-level craft checks, hard constraints (ranges, state validity), repairs (clamps, defaults).
- **Runtime validation** (C-README): checks missing canon, invalid states.

---

## 🌍 8. World & Adventure Content

(from GPT-README, enriched with C)

- **Verya / Veywood**: feudal politics, dual-track relationships, intrigue.
- **Mystika / Whispercross**: ritual magic, shifter culture, essence HUD, anachronism filtering.

Adventures supply starting locations, NPCs, and scene graphs with short choices.  
Core + Systems enforce mechanics, gating, and consistency.

---

## ❓ 9. Open Questions

(consolidated from GPT-README + C-README)

- Phase enumeration not enforced in schema (should lock).
- `CHECK.result` encoding ambiguous (crit/partial mapping).
- `REL_DELTA` missing dimension (trust/warmth/energy).
- Observation pass grading bands unspecified.
- Check model math unclear.
- Ambient/social beat selection not deterministic.
- `show_mechanics` default unclear.
- Adventures missing inventory sources.
- Intimacy rules: how to detect “author intent”.
- Error vocabulary not standardized.
- Phase transition clarity could benefit from more examples.
- Error recovery procedures could be more detailed.
- Performance optimization: too many files; could bundle.
- Testing framework not yet established.

---

## 🚀 10. Next Steps

(consolidated)

- Implement AWF v1 validator & acts applier.
- Lock phase enum & CHECK result mapping.
- Document check math, crit bands, and observation grading.
- Centralize `show_mechanics` toggle.
- Add `REL_DELTA.key` field or use `STAT_DELTA`.
- Add error code list.
- Expand few-shot AWF examples per action type.
- Build QA harness (outcomes, headers, toggles, cooldowns, validations).
- Add performance improvements (config bundling).
- Write edge-case test scenarios (error recovery, graceful degradation).

---

## 📝 11. Example AWF Response

(from GPT-README)

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
        "delta": 0.5,
        "why": "Shared truth"
      }
    },
    { "eid": "a3", "t": "TIME_ADVANCE", "payload": { "minutes": 10 } }
  ],
  "choices": [
    { "id": "ch_confide", "label": "Confide further, carefully" },
    { "id": "ch_listen", "label": "Ask her read on the Talon" },
    { "id": "ch_wait", "label": "Let the silence do its work" }
  ],
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```

---

# ✅ Conclusion

This README merges the **behavioral safeguards and fallback logic** emphasized in **C-README.md** with the **technical completeness and schema-driven structure** of **GPT-README.md**. It should now serve as the definitive, balanced reference for AI prompt rules in the RPG Storyteller project.
