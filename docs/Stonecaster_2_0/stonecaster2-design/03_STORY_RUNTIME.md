# 03 — Story Runtime and Turn Processing

## Goal

Maintain rich narrative freedom with persistent consequences and independent NPC behavior **without requiring a multi-agent pipeline or deterministic RPG engine every turn**.

## Runtime modules (logical, initially one Node service)

- `TimelineService`: load/save player-specific world continuity.
- `ScenarioService`: preflight, start, pause, complete, abandon, cast binding.
- `PartyService`: join/leave/availability, character instance resolution.
- `ContextOrchestrator`: fetch mandatory structured state and retrieve optional context.
- `RulePackResolver` / `PromptCompiler`: select and assemble instructions.
- `SceneOrchestrator`: choose execution path and invoke model.
- `OutcomeValidator`: schema, permission, state/version and provenance checks; does not calculate game mechanics.
- `EventStore`: atomic, idempotent event commit and snapshots.
- `MemoryWorker`: async summaries/indexing after accepted events.
- `ModelGateway`: provider, model profiles, usage, fallbacks, streaming.

## One-turn sequence

```
POST /api/timelines/:id/turn  {runId, playerText, idempotencyKey, expectedVersion}
  1. Authenticate; verify world/timeline/run ownership and writable state.
  2. Acquire optimistic version boundary; deduplicate idempotency key.
  3. Load exact player, scene, party, known NPCs, relationships and run state.
  4. Select relevant knowledge, memories, story threads and prompt rule packs.
  5. Compile model-specific context with visibility and token limits.
  6. Scene model proposes structured outcome + dialogue/narrative.
  7. Validate proposal, allowed event types, actor permissions, chronology,
     world/party compatibility and event preconditions.
  8. If invalid, repair once using validation errors or return a clear non-committed error.
  9. Atomically append events, update snapshots and increment timeline version.
 10. Deliver **committed** narrative and choices; queue memory/indexing jobs.
```

### Scene model output shape (illustrative)

```ts
type ProposedTurn = {
  narration: string;
  dialogue: Array<{ actorInstanceId: string; text: string }>;
  playerActionInterpretation: string;
  suggestedChoices: string[];
  events: Array<{
    type: string; actorId?: string; targetId?: string;
    payload: Record<string, unknown>;
    evidence?: string; // why this change followed from the scene
  }>;
  openQuestions?: string[];
};
```

Use Zod/discriminated union schemas for actual event variants. Prevent arbitrary database field writes from AI. Accept authored text as narrative input, not as an instruction with privilege above platform constraints.

## Two execution paths, one authoritative state

**Fast path:** ordinary dialogue, observation, low-risk relationship flavor. One capable scene model generates story plus a small structured proposal. Validate/commit, then deliver.

**Deliberate path:** consequential abilities, contested NPC actions, recruitment, major revelation, high-impact world change, tactical confrontation. A separate lightweight classification/feasibility pass (possibly Jev) *may* help, followed by scene narration. Use only if evaluated to outperform fast path on cost-adjusted quality. The model adjudicates fictional mechanics under rule packs; the validator only checks permitted state transitions.

**Do not** call independent NPC models sequentially for every participant. Scene model represents a cast with independent beliefs and goals. Separate NPC-specific deliberation is a future opt-in feature if it proves worthwhile.

## Narrative integrity and streaming

Do not stream high-impact prose as committed fact before validating the resulting state, then discover the result is illegal. MVP default: model returns a structured proposal, validate/commit, then stream the *accepted* text to the client (replaying text in chunks is optional; avoid artificial token-by-token latency). A more advanced approach can produce separately validated event decisions before streaming fresh narration, but only if quality/latency justifies it.

The client distinguishes `generating`, `validating`, `committed`, and `failed` turn states. A failed or canceled request may not leave a half-committed world. Reconnect fetches committed events and returns current version. Repeated idempotency keys return the original outcome.

## Critical failure paths

- **Provider error/timeout:** retry under bounded policy; show retry with same idempotency key. Never fabricate a generic 'everything continues' scene and commit it.
- **Schema failure:** one targeted repair attempt, then error with diagnostics. Do not accept invented IDs.
- **World contradiction:** reject proposed contradictory event, provide constraints to model for repair. If unresolved, preserve state and ask player to choose again.
- **Concurrent turn:** reject stale expectedVersion with state refresh; do not overwrite the second turn.
- **NPC absence/conflict:** preflight or runtime prevents impossible cast duplication. Explain to player in-world when appropriate.
- **Model switch:** pinned model profile and rule revisions per scenario run by default; user-initiated switch can create a documented checkpoint to prevent invisible style/rule changes.

## NPC agency and narrative action policy

- The player's input expresses what they *attempt* or *say*, not automatically what other people do or think.
- NPC choices should follow their motives, capabilities, private knowledge and recent experiences.
- Recruitment proposals include actor consent and in-world conditions; all world-bound constraints are checked before joining.
- Off-screen action: no continuous NPC simulations. During scenario entry, story beat triggers, or timeline progression, model may propose bounded off-screen events for *relevant* NPCs; each is committed through the same validator.
- Story threads should move through cause and effect; no mandatory fixed list of quest checkpoints.

## State vs narrative

- **Authoritative:** character instance IDs, current location, party membership, relationships, known facts, scenario run state, timeline event log, event versions.
- **Narrative:** descriptive presentation, flavor, voices, inferred intent, prompt-based ability outcomes subject to accepted events.
- Never rely on transcript-only facts for a character's actual identity or accumulated progress. After a turn commits, extract important memories and reconcile them with canonical events.

## Performance and cost

- Target at most one main storytelling model call per routine turn, plus optional targeted repair. Measure before setting latency guarantees.
- Include token and retrieval budgets, per-provider timeouts, caps per player and model profile.
- Prefer event snapshots and incremental compaction over reconstructing full state from the beginning for every turn.
- Deduplicate world/rule context using versioned cached prompt segments; apply provider prompt caching where beneficial.
- Trace turn timings separately for exact state, retrieval, prompt assembly, model, validation, storage, memory queue.
