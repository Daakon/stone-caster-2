# 08 — MVP Vertical Slice, Acceptance Criteria and Evaluation Plan

## One vertical slice proves the architecture

**Test world:** `Emberlight Academy` (illustrative only; engine must remain world-agnostic). A school for bonded magic practitioners. A vanished bonded creature triggers a mystery. Students have rivalries and their own interests.

**Player:** `Rowan`, authored player character, world-bound.

**NPC definitions:**

- **Lyra:** capable, guarded, ambitious; knows a private clue, wants to protect her sister, recruitable but not blindly compliant.
- **Tessa:** independent, personable explorer, worried about a missing friend, recruitable.
- **Provost Merin:** non-recruitable authority figure, institution-first motivations, partially false belief about the disappearance.

**Scenario A — The Vanished Bond:** find the missing creature, question the cast, make an ally, potentially recruit Lyra, establish unresolved truth/promise. Uses agency, relationships and investigation rules.

**Scenario B — Ashfall Expedition:** investigate an abandoned sanctuary with whichever compatible companions the player brings. Uses agency, abilities and optional tactical conflict. Contains an opportunity for Lyra to refer to the promise from Scenario A, *only if* she was told and it actually happened in that timeline. Tessa may have her own agenda. No hardcoded mandatory dialogue.

## Must-pass end-to-end demonstration

1. Creator drafts a minimal world, NPC and two scenarios through UI (or fixtures for first implementation).
2. Player creates Rowan in that world and initializes Timeline 1.
3. Starts Scenario A with no pre-recruited NPCs.
4. Meets Lyra, develops trust and makes an explicit promise; recruitment may succeed based on the scene. Server persists instance, relationship, memory and event.
5. Completes/abandons Scenario A; player returns to timeline hub with the correct party and event history.
6. Starts Scenario B (different scenario definition, possibly different author in the same world) and brings recruited companion.
7. Companion maintains personality, knows appropriate past information, and doesn't know an undisclosed secret.
8. Open a separate Timeline 2 using the same published world/NPC definitions; no crossover memory, party or world changes.
9. Switch the active rule pack set for a new run; a tactical scene uses tactical instructions without a deterministic combat engine.
10. Compare at least two model profiles; verify schema, latency/cost logs, and continuity behaviors.

## Objective acceptance tests

| ID | Test | Acceptance |
|---|---|---|
| ID-01 | World compatibility | Cross-world scenario or NPC entry rejected; identity never silently rehomed |
| TL-01 | Timeline isolation | Same NPC definition in two player timelines yields distinct instances/history |
| NPC-01 | Persistent companion | Recruiting in A results in same instance ID and memories in B |
| NPC-02 | Agency | A contradictory recruitment instruction can be refused without breaking state |
| NPC-03 | Cast resolution | Scenario cast and party don't duplicate one named NPC into two identities |
| SC-01 | Scenario leave | Abandon preserves already committed events but not completion awards |
| SC-02 | Pause | Paused run resumes; incompatible new run blocked until resumption/abandon in MVP |
| SC-03 | Revision pinning | Scenario updates do not silently alter a running scenario |
| KNOW-01 | Secrets | NPC can't reveal inaccessible creator/other-NPC secrets |
| KNOW-02 | Beliefs | False NPC belief remains separate from world truth and can be corrected in story |
| RAG-01 | Context correctness | Named lore retrieval is accurate, scoped, cited internally, and not noisy |
| RULE-01 | Rule selection | Detailed tactical module activates for fight, not routine social exchange |
| RULE-02 | Rule-only mechanics | No custom numerical combat engine required in application logic |
| RT-01 | Atomic turn | Duplicate key has no duplicate effects; stale versions cannot overwrite state |
| RT-02 | Failure safety | Provider/schema failure never commits invented narrative progress |
| CR-01 | Assisted creation | Nonexpert can produce NPC/scenario without JSON or prompt syntax |
| CR-02 | Publish permissions | Nonowner can't overwrite world canon or leak unpublished content |
| MOD-01 | Model replacement | Two vetted models produce schema-compatible turns; cost ledger accurate |
| UX-01 | Mobile/a11y | Key screens function at 390px; 0 serious/critical axe issues |

## AI evaluation corpus

Create a committed, reproducible evaluation dataset containing at least:

- 10 autonomy/conflicting-desire situations (refusal, negotiation, NPC initiative).
- 10 memory/epistemic situations (secret vs belief vs public fact).
- 10 cross-scenario continuity situations (promise, injury, reunion, party change).
- 10 rules-selection cases (social, tactical, magic, exploration, noncombat abilities).
- 5 creator-prompt injection and 5 structured-output adversarial cases.

Run the same fixtures against Standard and Premium profiles; add experimental models only after baseline comparison. Automate structural assertions using Vitest/Promptfoo and grade subjective narrative quality using blind human review or clearly documented model-assisted evaluation.

### Suggested initial quality gates

These are *targets for the pilot*, subject to calibration, not performance claims:

- 100% pass on cross-user isolation, permission checks, idempotency and state schema enforcement.
- 100% pass on deterministic knowledge-scope assertions in the controlled fixture suite.
- >= 90% on model-mediated NPC agency, narrative continuity, and rule adherence across seeded repeat tests; inspect all failures.
- No unsupported automatic event commit on malformed model output.
- Keep p50/p95 latency, total tokens per turn, retrieval accuracy and cost/turn as reported metrics; set SLOs after first measurement rather than inventing them.

## Phase gates

**P0 — Existing system and data review:** source audit, secret audit, migration strategy, schemas and fixture world. Exit: no ambiguity about chosen authoritative runtime.

**P1 — State and scenario transitions:** create timeline, NPC instance, party, scenario runs, events. Exit: automated A→B portable-party continuity without AI required.

**P2 — One good scene model:** compiled scene context, agent-independent NPC voices, validated events and visible story UX. Exit: interactive A→B gameplay.

**P3 — Knowledge/rules:** hybrid RAG, scoped memory, creator-selected rule packs, prompt inspection. Exit: epistemic and rule-activation tests.

**P4 — Creator Studio:** guided NPC/scenario creation, sandbox playtesting and publishing. Exit: creator can build scenario without raw JSON.

**P5 — Model catalog and launch readiness:** cross-model evaluations, budgets, monitoring, accessibility and operations. Exit: private beta candidates.

## Explicit deferrals

Marketplace billing/revenue share, multiplayer world continuity, cross-world transfers, always-active simulation, complex world travel map, full inventory/economy, self-hosted model inference, native mobile app, continuous background agent swarms, complicated skill math, image/video pipelines.

## Stop conditions

If 2+ AI calls routinely produce worse latency/cost-adjusted quality than one, simplify. If RAG fails to improve contextual accuracy over exact state plus short summaries for a small world, keep RAG on-demand. If a creator needs to understand raw prompts for the first playable NPC/scenario, UX has failed. If party continuity is broken at scenario boundary, do not proceed to marketplace features.
