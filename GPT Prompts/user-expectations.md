# USER_EXPECTATIONS.md — RPG Storyteller (Behavior Contract)

> Purpose: Define **player-visible, predictable behavior** that the engine and prompts must uphold. This is a contract for UX. Implementation rules (schemas, phases, guardrails) must satisfy these expectations without exception.

---

## 1) Universal Output Contract

- **Always JSON**: Every AI turn returns one and only one JSON object (AWF v1 envelope). No Markdown, code fences, or stray text.
- **Human-readable strings allowed**: Strings in `txt` and `choices[].label` can contain icons/emoji.
- **No hidden mechanics in prose**: All mechanics live in `acts[]`; `txt` is narrative only.
- **Deterministic fields**: Keys `scn`, `txt`, `choices`, `acts`, `val` are always present, in that order.

**Acceptance**

- Given any prompt step, When a response is produced, Then it is a well-formed AWF JSON object with no extraneous characters.

---

## 2) Character Creation (Player Onboarding)

- **Single-screen start**: The first response presents a clear intro `txt` and ≤ 3 initial choices to begin creation.
- **Short labels**: Choice labels are concise (≤ 48 chars) and readable.
- **No lore dumps**: Creation avoids long exposition; uses progressive disclosure.
- **Immediate agency**: The player can always proceed without reading external docs.

**Acceptance**

- The initial creation turn includes `scn.id = "character_creation/start"`, `ph = "scene_body"`, ≤ 3 choices, and no more than ~250 chars in `txt`.

---

## 3) Starting an Adventure (Baseline Save)

- **Auto-baseline**: On the first transition from creation to play, the game auto-generates a baseline save.
- **Complete & valid**: Baseline includes starting stats, inventory, presence ledger, derived headers, and passes validation/repairs.
- **Zero-config for player**: The player is not asked to confirm technical details.

**Acceptance**

- After the first “Start Adventure” choice, a save blob exists with: derived headers, starter inventory, clamped stat ranges, and no validation errors.

---

## 4) Turn Flow & Feedback

- **Clear phase rhythm**: Narrative → outcome → menu feels snappy and consistent.
- **One action cadence**: Each player choice triggers a single turn commit with visible outcome in `txt`.
- **Outcome before menu**: The player always sees the consequence before the next menu of choices.

**Acceptance**

- After a choice is selected, the next turn’s `txt` reflects the resolved outcome before new `choices[]` appear.

---

## 5) Choices & Gating

- **Always at least one choice**: The menu never disappears; if stuck, an “Observe” or “Wait” option appears.
- **Gated options surfaced transparently**: If an option is locked, the label remains visible with a short, in-world hint when hovered or toggled (wrapper responsibility).
- **No dead-ends**: There is always a way to progress, retreat, or gather info.

**Acceptance**

- Every turn contains ≥1 actionable choice. If none are mechanically legal, an auto-injected utility choice (e.g., Observe) is present.

---

## 6) Save Behavior (Per-Turn Merge)

- **Atomic updates**: Each turn’s `acts[]` are applied as a single atomic commit.
- **Undo safety (wrapper)**: Wrapper may implement an undo to the pre-turn snapshot.
- **Choice history**: The last 3 choice labels/tags are retained in the save for UX surfaces.

**Acceptance**

- After a turn, committed save state reflects all `acts[]` deltas; history contains the most recent 3 choices.

---

## 7) Mechanics Visibility

- **Opt-in surfacing**: Dice/check math and numbers are hidden by default, with a UI toggle to reveal.
- **No out-of-character chatter**: Mechanical info appears in UI panels, not in `txt` prose.

**Acceptance**

- When mechanics are hidden, the narrative remains clean and in-world. When mechanics are shown, their values come from `acts[]` exactly.

---

## 8) NPC Behavior & Consent

- **Player speaks for player**: NPCs never speak as the player. Names lock once chosen.
- **First meeting restraint**: Intros reveal only observable traits. Hidden motives require discovery.
- **Consent gating**: Relationship or context is required for intimacy/risks; alternatives are suggested.

**Acceptance**

- NPC reactions feel plausible and escalate with trust/warmth; no sudden intimacy or hostility without cause.

---

## 9) Ambient & Social Beats

- **Never spammy**: At most one NPC↔NPC ambient beat per turn.
- **Player-first**: Ambient beats never replace the choice menu.
- **Deferrable**: If a beat would interrupt resolution, it is queued and shown after outcome.

**Acceptance**

- Turns never present more than one ambient interjection, and it never hides or delays the new menu.

---

## 10) Error Handling & Recovery

- **Graceful degradation**: Missing templates/assets do not block play; plain text fallbacks are acceptable (still within JSON envelope).
- **Self-repair**: Minor data inconsistencies are clamped/repaired silently; major issues are surfaced as clear, actionable errors.
- **Never trap the player**: On error, a safe location/choice is available.

**Acceptance**

- If an asset is missing, the game continues with a visible but non-blocking notice; no crash, no broken envelope.

---

## 11) Pacing & Length

- **Bite-sized narration**: Default `txt` length targets ~80–180 words for play turns; creation turns ~40–120 words.
- **Short labels**: Choices are ≤ 48 chars, action-oriented, and scannable.
- **Session-friendly**: Frequent commit points ensure progress is saved often.

**Acceptance**

- Random sample of 10 turns meets length targets; no wall-of-text responses in standard play.

---

## 12) Accessibility & Readability

- **Icon + text**: Icons/emoji augment, never replace, meaning.
- **Plain-language**: Avoid jargon unless introduced in-world.
- **Contrast-safe (wrapper)**: The UI theme provides adequate contrast; color is not the sole conveyor of state.

**Acceptance**

- Removing icons still leaves labels understandable; narrative avoids unexplained mechanics terminology.

---

## 13) Performance & Latency (Perceived)

- **Snappy feel**: Typical turn response perceived within ~1–3 seconds in the wrapper (subject to model latency).
- **Progressive feedback**: The wrapper shows immediate “thinking/rolling” affordances; the engine doesn’t block interactivity.

**Acceptance**

- In a 20-turn session on average hardware/network, perceived response time meets expectations ≥ 85% of turns.

---

## 14) Content Boundaries

- **Age-safe defaults**: Content defaults to PG–PG-13 unless the world explicitly signals mature themes and the player opts in.
- **Hard lines respected**: No sexual content involving minors; no glorification of cruelty; safety systems override risky actions.

**Acceptance**

- Test cases with boundary-pushing prompts are safely redirected or softened without breaking immersion.

---

## 15) OOC (Out-of-Character) Handling

- **Polite pivot**: If the player asks meta questions, the engine answers briefly, then returns to in-world play.
- **No lecture mode**: OOC responses remain concise and do not derail the scene.

**Acceptance**

- An OOC query returns one short OOC paragraph plus a clear way back into the scene within the next turn.

---

## 16) Determinism & Continuity

- **State is truth**: The save file is the single source of truth; narrative must reflect state every turn.
- **No contradictions**: If an item is consumed or an NPC has departed, subsequent `txt` respects that fact.

**Acceptance**

- Automated regression checks find no state contradictions across 30+ sequential turns.

---

## 17) Minimal AWF Examples (for QA)

**Creation Start**

```json
{
  "scn": { "id": "character_creation/start", "ph": "scene_body" },
  "txt": "You stand at the threshold of a life you have yet to choose.",
  "choices": [
    { "id": "ch_lineage", "label": "Choose your lineage 🜁" },
    { "id": "ch_path", "label": "Choose your path ⚔️" }
  ],
  "acts": [],
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```

**Typical Play Turn**

```json
{
  "scn": { "id": "whispercross/hidden_pond", "ph": "outcome_render" },
  "txt": "You speak plainly; the water’s hush carries your words farther than you intended.",
  "choices": [
    { "id": "ch_confide", "label": "Confide further" },
    { "id": "ch_listen", "label": "Ask for her read" },
    { "id": "ch_wait", "label": "Let silence work" }
  ],
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
        "who": { "ref": "npc.marian_veyra" },
        "key": "trust",
        "delta": 0.5,
        "why": "Shared truth"
      }
    },
    { "eid": "a3", "t": "TIME_ADVANCE", "payload": { "minutes": 10 } }
  ],
  "val": { "ok": true, "errors": [], "repairs": [] }
}
```

---

## 18) Test Scenarios (Must Pass)

1. **No-choices edge**: In a cul-de-sac scene, engine injects `Observe` so ≥1 choice exists.
2. **Locked option hint**: A gated option is present with a succinct hint; selecting it shows an in-world reason rather than an error.
3. **Asset missing**: With a missing glyph/template, play proceeds; a non-blocking notice is recorded, envelope intact.
4. **Undo-safe turn**: A failed roll still commits; wrapper can revert to pre-turn snapshot without corruption.
5. **Consent required**: Attempted intimacy without relationship meets a soft redirect plus alternative choices.

---

## 19) Non-Goals (Out of Scope for Player Contract)

- Server/model selection, token budgets, or engine internals.
- World authoring pipelines and build tooling specifics.
- Analytics/telemetry behavior beyond basic error counts.

---

## 20) Versioning & Change Control

- This contract is versioned. Any change that reduces player agency, increases latency, or breaks JSON-only output is a **breaking change** and requires a version bump and migration note.
