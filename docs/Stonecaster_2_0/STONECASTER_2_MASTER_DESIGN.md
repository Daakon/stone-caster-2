# StoneCaster 2.0 — Integrated Design (generated from numbered specification files)

This is a convenience copy of the canonical files in `stonecaster2-design/`. When editing the design, update numbered source files first.

# StoneCaster 2.0 — Design Authority and Executive Decisions

**Status:** Proposed direction for the next generation of StoneCaster.  
**Date:** 2026-10-30  
**Audience:** Product owner, architects, and coding agents.  
**Purpose:** Replace the original engine-first development direction with a smaller, extensible, player-and-creator-first architecture.

## Read this first

This pack is the **design authority for StoneCaster 2.0**. It does not assert that the new architecture already exists in code. The existing StoneCaster repository is a starting point, not a specification of desired behavior.

### Authority order

1. Platform security, privacy, and applicable provider policies.
2. This `00_START_HERE.md` and the other numbered files in this design pack, interpreted together.
3. Implementation decisions recorded as subsequent, reviewed ADRs.
4. Existing repository guidance (`AGENTS.md`, build/test/deploy practices) where it does not contradict this pack.
5. Legacy game-engine, world-bundle, and prompt documentation, **reference only** when contradictory.

If a coding agent discovers a conflict, it must document it and implement the simpler 2.0 behavior. **Do not recreate legacy complexity solely because existing documents or types demand it.** Do not delete legacy production data or remove functionality without an explicit migration plan.

## One-sentence product

**StoneCaster is a platform for creating and playing AI-driven stories inside persistent worlds, with world-bound player characters, independently motivated NPCs, portable parties, reusable scenarios, optional sophisticated prompt-driven rules, and memory-aware storytelling.**

## What is different from the old design?

| Old center of gravity | New center of gravity |
|---|---|
| Build a comprehensive RPG simulation engine | Build living worlds and reusable story scenarios |
| Complex world bundles with many mandatory files | Small composable world, NPC, scenario, rule-pack objects |
| Detailed mechanics implemented in code | Mechanics adjudicated through **selectable prompt-based rule packs** |
| Quest/scene graphs needed to create content | Goal/conflict/thread-driven scenarios with optional authored beats |
| Save is primarily an adventure | Timeline belongs to the player character **within a world** |
| NPCs mostly belong to one adventure | NPC instances persist and can join the party across scenarios |
| Send large instructions or narrative history | Retrieve relevant world facts, memories, and rule modules dynamically |
| Prompt experts can build complex content | Guided creators work from plain English and playtest immediately |
| Mandatory multi-model pipeline | One strong scene model by default; extra steps only when justified |

## Non-negotiable product decisions

1. **World-bound identities.** A player character has a native world. Published NPC definitions belong to worlds. A player's NPC instances and relationship histories belong to that player's independent timeline inside that world. Cross-world travel is deferred, never silently allowed.
2. **Scenarios are portable experiences, not containers for persistent identity.** A player and recruited companions can finish/leave one scenario and enter another compatible scenario in the same world.
3. **Companions have agency.** Recruitment is an in-world outcome with explicit acceptance/decline. They may refuse actions, leave the party, or pursue goals. The player does not control them as puppets.
4. **Rules are prompt-driven.** Storytelling models adjudicate combat, abilities, social checks, survival, magic, and other complex mechanics using versioned, selectable prompt instructions. Ordinary application code validates schemas, permissions, persistence, allowed actions, and transactions—not gameplay math.
5. **Persistent truth is server-owned.** AI produces a proposed result and state changes; the application validates and commits facts. Prose cannot quietly change canon, invent ownership, or overwrite previous decisions.
6. **RAG is supplemental to exact state retrieval.** World facts, NPC knowledge, relationships, event history, and rule modules are assembled by a scoped Context Intelligence subsystem. Semantic similarity never replaces authoritative structured lookup or security filtering.
7. **Creation is guided by AI, not prompt expertise.** Users can contribute a world, a single NPC, a scenario, or a rule pack without creating an entire bundle or learning special prompt syntax.
8. **One codebase, few services.** React/Vite on Cloudflare; Node/TypeScript on Fly.io; Supabase Auth/Postgres/pgvector; AI SDK/provider adapters. No microservices or dedicated vector/graph store in the MVP.
9. **Creator content is versioned and scoped.** Publication creates immutable revisions. Community contributions require world permissions; player-specific history never mutates shared published canon.
10. **Quality and cost are measurable.** Every model or rule-pack upgrade runs story-continuity and security evaluations. Track model/token cost per successful turn.

## Required scope (MVP)

- Choose a published world; create a player character; create an independent world timeline.
- Enter scenario A, converse and act freely, meet/recruit NPCs, exit with consequences.
- Enter scenario B with the same party; companions remember relevant prior history.
- AI-guided creation of one NPC and one scenario from natural language, with editing, validation, playtest, and publication (world creator can also create a minimal world).
- Enable and combine versioned rules such as independent NPC agency, relationships, abilities, and optional tactical conflict; the same system supports complex custom rule packs.
- Context assembly using exact state and scoped hybrid retrieval; character-specific knowledge/privacy.
- One model working per scene by default; curated model choices and cost guardrails.
- Mobile-first player and creator UX; meaningful test coverage and security safeguards.

## Deliberately not required for MVP

- Cross-world character/companion travel, multiplayer/shared multiplayer timeline, real-time world simulation, always-running NPC agents, deterministic tactical-combat engine, complicated inventory/crafting/economy, public content marketplace with payments, AI-generated video, autonomous content publishing, mandatory dice/skill system, or an agent for each NPC.
- A separate database, service, or framework for each feature.
- Backward compatibility with every legacy bundle file shape in the new runtime. Legacy content may be imported or migrated separately.

## Scope-control rule

When a proposed feature adds new schema or infrastructure, ask: **Does it make world/scenario portability, believable NPCs, creator simplicity, or context quality measurably better in the first vertical slice?** If not, record it as deferred rather than implementing it.

## Documents in this pack

- `01_PRODUCT_EXPERIENCE.md` — user journeys, player/creator UX, differentiators.
- `02_DOMAIN_AND_CONTENT.md` — identities, schemas, ownership, party and scenario lifecycle.
- `03_STORY_RUNTIME.md` — turn pipeline, AI adjudication, state writes, failure behavior.
- `04_CONTEXT_MEMORY_RAG.md` — exact lookup, hybrid RAG, secrets, memory, prompt context.
- `05_RULE_PACKS_AND_MODELS.md` — prompt-driven rules, compilation, model gateway, cost controls.
- `06_CREATOR_STUDIO.md` — guided content authoring, validation, publication, playtesting.
- `07_PLATFORM_MIGRATION.md` — technology choices, existing code audit, migrations, contracts.
- `08_MVP_EVALUATION.md` — vertical slice, acceptance criteria, evaluation corpus, roadmap.
- `09_AGENT_HANDOFF.md` — coding agent instructions, work breakdown, guardrails.

## Two important terms

**Definition** means published/reusable creator content. **Instance** means mutable content belonging to a particular player's world timeline or scenario run.

**Narrative authority** means the model is free to interpret fictional consequences within prompt-defined rules. **Persistence authority** means only the server can commit them. These are complementary, not in conflict.

## Repository facts observed during preparation

Inspected `Daakon/stonecaster` main branch on 2026-10-30. There is an existing React/Vite frontend, Node/Express API, Supabase/Drizzle schema, world/character/save/session concepts, AI providers, streaming, prompt management, and tests. The repository also contains older hardcoded Mystika bundle requirements and more than one GameEngine class. These documents prescribe the **target**, not a guarantee that source is already migrated. Subsequent work must first verify actual behavior against code, not rely solely on older README/doc dates.


---

# 01 — Product and Experience Design

## Positioning

StoneCaster occupies the space between open-ended AI story generators and single-character AI roleplay apps: **modular, persistent, character-driven story worlds**. Players should feel that characters have real motivations and that their shared history survives a change of scenario. Creators should produce good initial results without knowing prompt engineering.

Distinctive promise: **Create a character. Find companions. Take them into new stories. Your history matters.**

## Player-facing concepts

- **World:** a coherent setting, its canon, narrative tone, available scenarios, and character catalog. World owner controls official canon and compatibility.
- **My Character:** one player's persona anchored to one world; descriptive abilities, traits, biography, and history. Progress persists across scenarios.
- **My Story / Timeline:** private, persistent continuity for that character in that world. Players may start independent timelines rather than having one global shared history.
- **Party:** a subset of timeline NPC instances accompanying the player. No automatic obedience; each can accept/decline participation.
- **Scenario:** a creator-built playable situation with an opening, tension, cast/role needs, rules, and possible developments. A scenario is reusable across different player histories.
- **Story Thread:** an open problem or desire with actors, known/hidden information, escalation conditions, and possible consequences, not necessarily a rigid quest graph.

## Player's minimal journey

1. Discover worlds/scenarios through readable, enticing cards (genre, tone, difficulty/complexity, content notices, model support).
2. Select a world, create a player character (quick generated or guided); choose a saved timeline or start a new one.
3. Review scenario compatibility and the party. The UI explains if the scenario calls for a role the party lacks, but allows reasonable alternatives.
4. Enter scenario, see an opening scene, act via typed text or optional suggested choices. Never force menu-only roleplay.
5. NPCs respond as independent actors using their private knowledge, motives, and relationships. Their behavior can surprise but should not contradict established facts.
6. Recruit an NPC through believable story interaction. Recruitment may fail or require time; no global 'add companion' toggle for other people's characters.
7. Complete or leave the scenario. Persistent consequences are stored. Choose another compatible scenario in the same world with the party intact.
8. Review relationships, events, active goals, and a concise timeline recap when returning.

## Scenario lifecycle UX

- **Enter:** preflight displays world compatibility, current party, unique NPC conflicts, safety/content settings, and any scenario-specific rule packs. Existing party members are not silently replaced.
- **Active:** scenario scene, cast list, text entry, 2–4 suggested choices (optional), in-world journal, compact status. No need to display raw state or prompt internals.
- **Complete:** completion status, key consequences, new companions/relationships, rewards/changes, follow-up threads.
- **Leave/Abandon:** explicitly warn that events already committed remain true. End the run without granting unearned resolution rewards. Story can account for withdrawal.
- **Pause:** retain current run; MVP supports resuming before entering another scenario. A player can complete/leave to switch freely. Multiple concurrent suspended runs are deferred due to timeline conflict complexity.

## Mobile-first screen map

Player: `Discover` → `World` → `Character/Timeline` → `Party & Scenario Entry` → `Story` → `Outcome/Journal`.

Creator: `My Content` → `Create (World / NPC / Scenario)` → `Guided Editor` → `Playtest` → `Publish`.

Global navigation: Discover, My Stories, My Characters, Create, Profile. No mandatory separate admin-only dashboard for core authoring. Player-first 390px UX; desktop adds right-side 'Cast/Journal' pane.

### Story UI requirements

- Distinguish narration, NPC speech, the player's speech/actions, internal thoughts where permitted, and system notifications with typography and spacing. Avoid presenting everything as one chatbot bubble.
- Visible character identity (portrait/name) for dialogue when useful. Keep longer narrative paragraphs readable.
- Free-text is primary. Suggestions guide new players but cannot constrain their agency.
- Companions and active threads accessible in one tap; relationship data is an in-world journal, not an artificial score meter by default.
- Pending turn progress, cancel/retry, partial generation failures, reconnection, and committed outcome must be unambiguous.
- Allow user preference for response length, pace, focus, and narrative voice without overriding character agency or world canon.

## Creator simplicity requirements

1. **Quick Create:** a short natural-language request yields a world, character, or scenario draft; no JSON or handcrafted prompt required.
2. **Guided Create:** ask only high-impact questions; infer reasonable defaults and make them visible.
3. **Advanced:** edit relationships, goals, secrets, story threads, rules, lore, and model instructions with versioning and warnings.
4. **Playtest:** run draft in a disposable sandbox with sample character/companions. See why the model behaved as it did (retrieved context/rules), without exposing protected data.
5. **Publish:** validate references, world permissions, content visibility, and rules compatibility. Official vs community labels must be clear.

A creator may submit a single NPC to a permitted world without making a scenario, or create a standalone scenario using existing world NPCs without rebuilding the world.

## Quality characteristics

- Character autonomy: meaningful refusal, initiative, personality consistency, no random over-agreeableness.
- Story flexibility: unrestricted input; not a fixed branching visual novel.
- Consequences: outcomes are remembered and affect later encounters/scenarios.
- Consistency: author canon, NPC beliefs, and player knowledge stay distinct.
- Accessibility: 390px baseline, keyboard/screen-reader-friendly, WCAG AA, no serious/critical axe violations in key routes.
- Convenience: autosave per completed turn, immediate resume, creator editing accessible without expertise.

## Differentiation not claims of exclusivity

Other platforms offer lore, memory, characters, and scenarios. StoneCaster's specific combination is **persistent player-specific world timelines + recruitable NPC instances + portable parties + reusable creator scenarios + prompt-driven rule depth + guided creation**. Judge quality by that combination, not by whether a feature name sounds unique.

## Business posture (not MVP payment specification)

- Offer low-friction entry with economical model and limited usage; premium/experimental model choices can carry usage budgets or credits.
- Avoid unlimited premium-model promises. Cost control per player and per turn must exist before subscription rollout.
- Community creator tools and discoverability are more important at launch than revenue sharing marketplaces.


---

# 02 — Domain, Content and Persistence Contracts

## Canonical domain model

```
WorldDefinition (published, versioned)
  ├── NPCDefinitions (created by world owner or authorized contributor)
  ├── ScenarioDefinitions (published, versioned)
  ├── RulePackSelections (published revisions)
  └── KnowledgeDocuments / LoreFacts (published revisions)

PlayerCharacter (world-bound, player-owned)
  └── Timeline (one independent continuity)
       ├── NPCInstances (player's versions of NPCDefinitions)
       ├── PartyMemberships (subset of NPCInstances)
       ├── Relationships / CharacterBeliefs / Memories
       ├── TimelineEvents / DerivedWorldState
       └── ScenarioRuns (scenario definition revision + local state)
```

**Never use scenario run ID as the owner of a player character, persistent NPC instance, or persistent party.** Run-local cast appearances may reference these persistent instances. A scenario can also create temporary NPCs that remain local until explicitly promoted and permitted.

## Illustrative TypeScript contracts

These are conceptual shapes, not finalized SQL or a replacement for Zod validators. Production types need IDs, audit columns, revision constraints, and user/permission checks.

```ts
type ID = string;

type RevisionRef = { id: ID; revision: number };

type WorldDefinition = {
  id: ID; ownerId: ID; title: string;
  revision: number; visibility: 'private' | 'unlisted' | 'public';
  canon: string; tags: string[];
  defaultRulePacks: RevisionRef[];
  contributionPolicy: 'owner-only' | 'approval-required' | 'open-community';
};

type NpcDefinition = {
  id: ID; worldId: ID; creatorId: ID; revision: number;
  name: string; biography: string; personality: string;
  goals: string[]; limits: string[]; initialKnowledgeRefs: ID[];
  recruitable: boolean; availabilityPolicy?: string;
};

type PlayerCharacter = {
  id: ID; ownerId: ID; worldId: ID;
  name: string; persona: string;
  traits: string[]; abilities: string[];
};

type Timeline = {
  id: ID; ownerId: ID; worldId: ID;
  playerCharacterId: ID; version: number;
  activeScenarioRunId: ID | null;
};

type NpcInstance = {
  id: ID; timelineId: ID; definition: RevisionRef;
  goals: string[]; state: Record<string, unknown>;
  availability: 'available' | 'busy' | 'missing' | 'departed';
};

type ScenarioDefinition = {
  id: ID; worldId: ID; creatorId: ID; revision: number;
  title: string; premise: string; opening: string;
  roleNeeds: string[]; npcDefinitionRefs: ID[];
  storyThreadSeeds: ID[]; rulePacks: RevisionRef[];
  entryConditions: string[]; consequenceCapabilities: string[];
};

type ScenarioRun = {
  id: ID; timelineId: ID; definition: RevisionRef;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  localState: Record<string, unknown>; turnSequence: number;
};
```

## Ownership and identity invariants

- A world ID is a stable UUID, with optional friendly slug. IDs, not names/slugs, determine compatibility.
- Player character `worldId`, timeline `worldId`, NPC definition `worldId`, and scenario definition `worldId` must agree at entry, unless a future explicit transfer feature is implemented.
- An NPC *definition* is creator content; an NPC *instance* is timeline state. Instantiating a character from a published definition must not mutate that definition.
- On first appearance, resolve `(timeline_id, npc_definition_id)` to an existing instance or create one idempotently. Avoid cloned NPC identities every time a scenario references them.
- Published content revisions are immutable. A scenario run pins the revision of scenario, referenced NPC definitions at time of instantiation, and selected rule packs. Future creator edits do not silently rewrite active stories.
- A player may have several timelines in one world (alternate characters or fresh starts). Memories, companions and world changes never leak between those timelines.
- A character's **public** profile is not a license to reveal private secrets or player-specific memories.

## Party contract

- Party membership is a timeline-owned relation to an NPC instance with join/leave events and optional stated duration/conditions.
- Party member can decline recruitment or new scenario participation based on NPC goals, knowledge, circumstances, and rule packs; model proposes, server applies validated transitions.
- An absent companion remains an NPC instance and can rejoin later. Leaving the party does not erase shared history.
- A companion can appear in scenarios that were written by another creator *within the same world*; no scenario may change the companion's immutable creator definition.
- A named scenario NPC that matches a party member is resolved to the same timeline NPC instance, not a second contradictory duplicate. Resolve casting conflicts at entry.
- MVP: one primary player character per timeline and a configurable small party size (default 3 companions maximum). Limits are experience/configuration controls, not combat mechanics.

## Scenario lifecycle and effects

1. **Preflight:** check world ID, content publication/permission, pinned revisions, entry conditions, player content settings, NPC instance conflicts, and relevant party availability.
2. **Enter:** create a scenario run, bind cast roles, select prompt rule packs, start a local story thread state, record `scenario_started`.
3. **Play:** each turn can produce local events and allowed timeline events. Commit events at the end of each validated turn; the UI should not present rejected events as canonical.
4. **Pause:** store run as paused. MVP requires resuming or abandoning it before entering a different scenario; this avoids impossible multi-run timeline rebase.
5. **Complete:** finalize open threads/earned outcomes, record `scenario_completed`, release temporary context, return to timeline hub.
6. **Abandon/Leave:** record `scenario_abandoned`, preserve already committed promises, discoveries, relationships and injuries; do not award unearned completion consequences.

An 'exit' cannot revert the player's entire history. The runtime can depict withdrawal, but cannot erase previously committed consequences without a new, explicit compensating event.

## Scenario effects and boundaries

- Local scenario state can change freely within allowed schemas.
- A scenario can propose cross-scenario persistent events: relationship change, memory, item/ability note, character condition, world flag scoped to player's timeline, party membership. Each event type is allowlisted and validated.
- A scenario may **not** modify shared world canon, other users' timelines, creator definitions, or arbitrary tables.
- Narrative rules decide whether an action succeeds. App validators decide whether a resulting event is structurally valid and authorized; they are not a deterministic RPG rule engine.
- Optional creator-defined resolution conditions are prompt guidelines plus schema-level event constraints, not scripted mandatory quest graphs.

## Story thread contract

Each thread has `premise`, actors, stakes, established facts, unknown facts, pressures/triggers, status, and possible trajectories. Facts and status evolve as model-proposed events are committed. **Do not require an exhaustive solution tree**. A writer may author special beats without those beats becoming mandatory.

## Suggested database areas

- `worlds`, `world_revisions`, `content_permissions`
- `npc_definitions`, `npc_definition_revisions`
- `scenario_definitions`, `scenario_revisions`, `scenario_thread_seeds`
- `rule_packs`, `rule_pack_revisions`, `world_rule_selections`
- `player_characters`, `timelines`, `npc_instances`, `party_memberships`
- `scenario_runs`, `scenario_cast_bindings`, `timeline_events`, `timeline_snapshots`
- `character_memories`, `character_knowledge`, `relationships`, `knowledge_chunks`
- `model_profiles`, `ai_usage_ledger`

Don't implement every table immediately. Define event contracts and the **minimal tables for a two-scenario proof** first; add normalized read models as warranted. Event IDs, turn sequence, optimistic version, and idempotency key are required for safe commits.

## Authorization

- Supabase Auth identities plus server-verified timeline/world/content ownership. RLS on user-owned tables; service-role access restricted to trusted server workers.
- World contributor roles: `owner`, `editor`, `contributor`, `reader`; publication permissions are world-controlled.
- Knowledge access is subject to player/timeline/character/creator scope, not only row ownership. See `04_CONTEXT_MEMORY_RAG.md`.
- Published scenario creators cannot gain private timeline access merely by owning the scenario definition.


---

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


---

# 04 — Context Intelligence, Memory and RAG

## Guiding premise

RAG is **not** the main source of truth. StoneCaster's context engine joins reliable structured state with selective retrieval of world documents, scenario lore, character memories and rule instructions. Retrieval must respect what the scene needs **and what each character is allowed to know**.

## Context sources and treatment

| Source | How selected | Authority |
|---|---|---|
| Player/timeline/run/current cast/party | Exact SQL/typed domain query | Mandatory, authoritative |
| Current character goals/relationships/known facts | Exact typed state lookup | Mandatory for present actors |
| World canon and scene location | Versioned published lookup + indexed search | Canonical content |
| Scenario documents/clues | Scope-filtered exact/hybrid retrieval | Scenario evidence; some author-only |
| Events and past scenes | Event log, summaries, hybrid recall | Authoritative events + historical impressions |
| NPC memory/private belief | Ownership/knowledge-filtered lookup and recall | Character-specific, potentially false beliefs |
| Rule packs | Explicit selection and contextual activation | Versioned behavioral instructions |
| Conversation recency | Last N committed turns | Immediate continuity |

## Retrieval pipeline

1. Build typed `ContextRequest`: `worldId`, `timelineId`, `runId`, `actorIds`, location, player input, task intent, active rule selections, and content visibility scope.
2. Load *mandatory* exact state. Never let semantic search decide whether active party members are present.
3. Resolve named entities/references from canonical IDs and aliases. Search exact names first; keyword + pgvector hybrid search for loosely related lore and memories.
4. Apply **authorization before candidates become model-visible**, including per-character knowledge boundaries and creator-only scenario secrets. A global top-k retrieval over unrestricted embeddings is not acceptable even if the display layer filters later.
5. Rerank/merge by source trust, topical relevance, event recency, causal importance, confidence, and token size. Preserve provenance and duplicate suppression.
6. Resolve contradictions: canon/latest committed events win over obsolete summaries; beliefs remain labeled as beliefs even when false. Do not automatically overwrite previously held beliefs with new truth.
7. Select relevant rule packs; include stable system/world segments; construct compact, labeled context within model budget.
8. Log retrieval decisions and chunk IDs in internal trace only, with sensitive content redacted. Support an authorized 'why did this NPC say that?' inspector for debugging.

## Knowledge security and epistemics

Represent separately:

- `world_fact`: published canon in the world revision.
- `timeline_fact`: authoritative event/fact true in this player's timeline.
- `character_known_fact`: fact this specific NPC has actually learned.
- `character_belief`: what this NPC thinks, possibly mistaken or outdated.
- `player_known_fact`: what the player character has learned; distinct from secrets the underlying system knows.
- `creator_secret`: hidden scenario information used for planning, **not** automatically available to NPC voices or exposed to players.

Some director-level information may be available for planning while character-level output is constrained by knowledge scopes. For especially sensitive secrets, use a two-step plan/voice separation or explicit redaction so hidden text cannot bleed into dialogue. Testing must verify no NPC reveals an inaccessible secret even when retrieval ranks it highly.

Creator-supplied lore and uploaded documents are **untrusted content**; do not promote embedded 'ignore instructions' text into platform/system instructions. The compiler should wrap these as quoted/reference data and allow only vetted rule-pack content to become active gameplay instructions. Even rule packs never supersede platform policy, ownership checks, or tool permissions.

## Memory write path

After each committed turn:

1. Derive mechanical/relationship/party changes from committed events (no model needed to invent them).
2. Identify story-significant narrative observations, promises, discoveries and subjective reactions. A small extraction model may propose memory candidates.
3. Validate candidate subject, knowledge grant, evidence, time, provenance and duplication against event records.
4. Write typed character memory/knowledge and append event links, with short human-readable text.
5. Queue embedding generation or update only for durable, retrieval-worthy chunks. Keep raw transcript/event history as audit source.
6. Compact older transcript for prompt efficiency; summaries may be rebuilt and must never override event truths.

Do **not** embed every line of dialogue automatically. Use recency windows, structured state and selected durable memories first.

## Storage implementation (MVP)

- PostgreSQL tables for event log, NPC instance state, party, relationships and knowledge grants.
- `knowledge_chunks` with `(id, world_id, timeline_id?, scenario_revision_id?, subject_id?, kind, visibility, source_id, source_revision, content, embedding_model, embedding, full_text_index, valid_from, superseded_by?)`.
- PostgreSQL full-text search and pgvector for hybrid search; use RRF or similar rank fusion after visibility filters.
- Optional `knowledge_edges`/entity reference tables for named things, without Neo4j/Graphiti initially.
- Every query is scoped by verified caller/world/timeline and, when forming an NPC voice, the NPC's authorized knowledge.
- RLS protects user/creator ownership; server-level fine-grained actor knowledge rules protect fictional secrets. Do not rely on RLS alone for in-story awareness.

## Token budget strategy

Use configuration per model profile; these are illustrative shares, **not fixed token limits**:

| Context category | Share of context budget |
|---|---:|
| Stable platform/world/canon/rules | 25% |
| Current state, cast, active scenario | 25% |
| Retrieved lore/memories/beliefs | 25% |
| Recent dialogue and active threads | 20% |
| Safety margin | 5% |

Mandatory context is not dropped to fit a budget. Instead compress safe content, trim optional retrieval, or choose a longer-context capable model. Larger context windows don't excuse irrelevant prompts. Measure quality against token usage.

## Retrieval instrumentation

Track `turn_id`, content revision refs, chosen chunk IDs, retrieval method, visibility-filter result counts, cache hit, prompt tokens by category, total model latency/cost and errors. Provide opt-out/redaction for sensitive unpublished text in third-party observability products.

## Tests required

- NPC with private secret does not reveal it to other NPCs/the player without a recorded disclosure.
- NPC can hold a mistaken belief while the world's actual truth differs.
- Companion recalls a promise made in scenario A during scenario B without ingesting all prior turns.
- Two timelines using same NPC definition retrieve different memories and relationships.
- Old lore revision does not override a newer published revision for *new* runs; pinned runs remain consistent.
- Hybrid retrieval returns relevant obscure lore and exact-match names without unrelated lore flooding context.
- Prompt injection in lore/uploaded documents cannot change system instructions or invoke unauthorized tools.

## Reference implementations to evaluate

Supabase official hybrid search/pgvector docs: https://supabase.com/docs/guides/ai/hybrid-search . Use existing Supabase infrastructure before considering dedicated vector or graph services. Hosted framework memory features may assist with conversation compaction but must not replace typed, scoped NPC and timeline memory.


---

# 05 — Prompt-Driven Rule Packs, Prompt Compilation and Model Strategy

## Core choice: rich rules without a coded rules engine

StoneCaster supports simple narrative experiences and sophisticated rules-heavy RPGs through **versioned prompt modules**. Combat, skills, magic, social negotiation, crafting, resources, and progression are adjudicated by the model using selected instructions. The application does **not** hardcode dice, damage, skill checks, RPG formulas, stat progression or world-specific mechanics.

Code remains deterministic where necessary for integrity: authorization, IDs, content publication, active run status, scenario entry, event schema, duplicate prevention, atomic persistence, quotas, and visibility restrictions.

## Rule Pack definition

A Rule Pack is creator-facing reusable content with:

- `id`, `name`, `scope`, `revision`, `creator`, `worldCompatibility`, `visibility`.
- `intent`: the behavior this pack is meant to produce.
- `instructions`: the validated prompt module; explicit world-specific mechanics may be very detailed.
- `activationHints`: always-on, scene tags, action kinds, actor traits, scenario needs, or explicit selection.
- `priority`: bounded ordering within the hierarchy; never platform privilege.
- `requirements`: which typed state or knowledge chunks must be available before invocation.
- `examples`: positive/negative worked examples, useful for behavior consistency.
- `conflictsWith` and `dependsOn` references for creation-time checks.
- `evaluationFixtures`: scenarios that test expected behavior and contradictions.
- `qualityLabels`: narrative, tactical, relational, experimental (derived from evaluation, not marketing guesses).

Pack categories:

| Category | Examples | Typical activation |
|---|---|---|
| Character behavior | Agency, truthful self-presentation, relationship continuity | Often always-on |
| Social | Persuasion, politics, negotiation, reputation | Social confrontations |
| Capabilities | Skills, abilities, magic limits, crafting | Actions involving capability checks |
| Conflict | Tactical combat, injuries, fear, fatigue | Physical conflict |
| World systems | Time, travel, faction pressure, survival | Events that depend on world rules |
| Narrative style | Scene length, tone, action/dialogue balance | Scene preference (no authority over canon) |

## Rule selection levels

1. Platform guardrails and trusted event contracts (**not editable by creators**).
2. World canon, native constraints and default rule packs.
3. Scenario-specific additions/selections compatible with the world.
4. Character/persona ability definitions and NPC behavioral guidelines.
5. Player presentation preferences and current action.

A scenario can request a rule pack or make scenario-specific extensions, but cannot silently disable hard world limitations. A creator can provide a rules-only pack without creating a whole world. The compiler performs conflict detection and exposes the active rules to the creator.

## PromptCompiler contract

```ts
type CompileRequest = {
  timelineId: string; scenarioRunId: string;
  action: string; actors: string[];
  modelProfileId: string;
};

type CompiledSceneContext = {
  platformInstructions: string;
  stableWorldAndRules: string;
  activeScenarioAndActors: string;
  retrievedEvidence: Array<{ sourceId: string; text: string; kind: string }>;
  recentHistory: string;
  currentPlayerAction: string;
  outputContractVersion: string;
  audit: {
    includedRuleRevisionIds: string[];
    retrievedChunkIds: string[];
    estimatedInputTokens: number;
  };
};
```

Compiler duties: load the right published revisions; select relevant packs; enforce dependencies and conflicts; include mandatory state and authorized memories; maintain clear source labels and role separation; use token budgets and caching; fail with a diagnostics report if critical context cannot be assembled.

**Creator-authored instructions are lower trust than platform requirements.** Don't interpolate raw creator text into a higher-priority system message without validation and role separation. Apply pack schema validation and injection screening; preserve an audit of the compiled rule versions.

## Example: optional detailed tactical pack

A creator selects `Tactical Conflict — Detailed`. The module can direct the model to:

- Evaluate each participant's established abilities, training, intent, fatigue, injuries, equipment, range, movement and surroundings.
- Treat tactics as consequential: exploiting balance, surprise, positioning or preparation may overcome numerical strength.
- Describe plausible partial outcomes, counters, retreats, costs and recovery.
- Respect specific world limitations on magic/weapons/abilities; don't conjure unestablished skills.
- Propose injury, resource, position and disposition events with evidence from the scene.
- Avoid predetermined victory, automatic success, and arbitrary punishment.

This is a **prompt interpretation of fictional combat**, not a numeric combat resolver. Authors who want exact mathematical rules can include mathematical descriptions and worked examples in a pack; the platform must document that an LLM may make calculation or consistency errors. For exact deterministic tournament-quality mechanics, a future optional external tool/rules plugin could be offered, but is not required for the core product.

## Model architecture

Use a provider-neutral TypeScript `ModelGateway` with a **capability registry** rather than switching code on raw model names:

```ts
type ModelProfile = {
  id: 'standard' | 'premium' | 'experimental' | 'creator' | 'memory';
  provider: string; model: string;
  capabilities: {
    structuredOutput: boolean;
    tools: boolean;
    streaming: boolean;
    contextWindow: number;
  };
  estimatedCostPerMillionInput: number;
  estimatedCostPerMillionOutput: number;
  maxInputTokens: number; maxOutputTokens: number;
  enabled: boolean; evaluationVersion: string;
};
```

**Model names, API prices, promo rates, effort parameters and context sizes are configuration**, checked against current provider APIs before deploy. Do not bake October 2026 prices or the latest consumer model name into application logic or content definitions.

- Direct adapters for major providers (OpenAI, Anthropic, Google) through a common interface / AI SDK where supported.
- OpenRouter or another configurable aggregator for experimental/open-weight models; provider routing and structured output availability must be tested per endpoint.
- For each model, record supported structured schema, tool semantics, safety behavior, timeout, input/output prices, and best known rule-pack performance.
- Keep model selection pinned per scenario run unless player explicitly changes it and accepts a checkpoint.
- Fallback on service failure only to vetted, schema-compatible alternatives. Never silently change models if it substantially changes user price, content behavior, or required features.
- Avoid dedicated one-LLM-per-NPC calls. One scene model handles the cast while knowing each actor's private and shared context.

## Orchestration policy

Default one high-quality scene-model call per ordinary turn. Conditional second step when classification, feasibility or schema-repair is likely to improve correctness/cost. Previous Jev work may be reused only after benchmark; it must not become mandatory for all scenes without evidence. Treat model reasoning effort as a per-profile tunable, not a global constant.

No specific orchestration framework is required. Start with AI SDK and small services; prototype Mastra separately only if it reduces code or improves observability. Do not stack multiple overlapping agent frameworks.

## Cost and quality controls

- Budget by user subscription/credit allowance, model profile, input/output tokens, optional supporting calls, and generation jobs.
- Cache stable compiled world/rule segments keyed by revision IDs, and benefit from provider prompt caching if supported.
- Summarize/compact context carefully; retain authoritative events and critical NPC identity even when token budget is tight.
- Log usage and model rates used at time of call, retries, failures, and final committed outcome. Charge only according to explicit product billing policy; use a reservation/settlement design for credits.
- Release models through private evaluation → experimental → standard/premium. Validate rule-following and fiction quality, not just aggregate benchmark scores.

## Baseline evaluation matrix

For each model profile and major ruleset test: NPC agency, private knowledge containment, cross-scenario continuity, relationship consistency, tactical plausibility, content schema adherence, cost/turn, p50/p95 latency, and recovery after invalid output. Record when a model is unsuitable for detailed rule packs even if excellent at dialogue.


---

# 06 — Creator Studio and Guided Authoring

## Creator Studio outcome

Anyone with a good story idea can create a **playable**, coherent NPC, scenario or world without learning prompt engineering, authoring dozens of files, or configuring a complex mechanics engine. Expert creators can still edit deep knowledge and prompt rule packs.

## Four independent creation entry points

1. **World:** name, premise, tone, canon, setting boundaries, default rules and content permissions. Generate a minimal playable shell, not a sprawling mandatory encyclopedia.
2. **NPC:** select an existing world; name/role, personality, motives, fears, knowledge, goals, behavior constraints, availability, recruitability. Can publish alone.
3. **Scenario:** select world; premise, opening, participants/roles, stakes, hidden truths, threads, optional authored beats and rule packs. Can reuse existing world NPCs and locations.
4. **Rule Pack:** choose type and behavior goal; generate prompt instructions, sample adjudications, dependencies, test cases. Can share with compatible worlds or keep private.

Player personas/characters have a separate simple create/edit flow with native-world identity, personality and optional abilities.

## Three levels of authoring

- **Quick Create:** one description → AI-generated typed draft → inspect a readable summary → playtest. Minimal follow-up questions.
- **Guided:** AI asks a *small* number of impactful questions (e.g., how strictly abilities matter, whether NPC is recruitable, how replayable the mystery should be). Defaults are explicit and editable.
- **Advanced:** precise edit of behavior constraints, secret access, role bindings, source lore, rule instructions, prompt examples, output style, versions, publishing metadata. No requirement to use Advanced for quality results.

## Creator Assistant tools (server-authorized)

| Tool | Scope |
|---|---|
| `draft_world` | Generate minimal setting, canon and defaults |
| `draft_npc` | Create NPC definition tied to selected world |
| `draft_scenario` | Reuse world assets, scenario threads and roles |
| `draft_rule_pack` | Create prompt instructions + examples + tests |
| `search_world_content` | Retrieve only content the creator may access |
| `validate_draft` | Structural/schema, referential, permission, conflict, completeness checks |
| `preview_context` | Inspect the actual rule packs and knowledge available to a test scene |
| `run_playtest` | Isolated scratch timeline; no persistent live-player changes |
| `suggest_revision` | Convert natural-language critique into typed, reviewable patches |
| `publish_revision` | Explicit creator confirmation, validation and authorization required |

Do not let the assistant directly update published canon or other players' histories. Tool calls require ACL checks and separate draft/publish transactions; publishing is an explicit user action.

## Example creator journey

Creator: 'Make a political fantasy mystery about a vanished royal courier; let players enter with their own companions.'

Assistant:

1. Ask the world choice and one major tone/complexity question if not already known.
2. Retrieve permitted locations, factions, NPCs, world rules and canon via Context Intelligence.
3. Produce an editable scenario with opening event, active actors, goals, secrets, causal pressures, multiple plausible outcomes, role needs, and selected rule packs.
4. Identify conflicts: unavailable world NPC, contradiction to royal succession lore, scenario requiring an absent NPC, or secret-visibility problem.
5. Offer to use an existing NPC or create a new NPC definition as a separate artifact.
6. Run a playtest with supplied/temporary party. Show narrative quality plus objective checks: memory, agency, rule adherence, unauthorized information leaks.
7. Creator says 'the guard is too trusting' → assistant proposes adjustments to guard's behavior and agency instructions; creator reviews change and reruns test.
8. Publish approved revision as a scenario that other users of that world can enter.

## Content assembly without duplication

- Reuse world canon by references rather than copying entire lore into each NPC/scenario.
- A scenario's required roles may resolve to a fixed world NPC, a compatible party member, or an AI-generated ephemeral scene actor according to author constraints.
- Creators can provide exact NPC dialogue examples, but only as examples. They should not force players down a predetermined dialogue tree unless explicitly marked as a guided story experience.
- Publication validates missing references, contradictory facts, visibility scopes, rule-pack conflicts, content ownership and world-owner approval.
- Uploaded Markdown/TXT/PDF documents can seed drafts and knowledge indexing after author review. Preserve provenance, rights declaration and privacy; no uploaded text automatically becomes official canon.

## Publication and permissions

- `draft` → `in_review` (optional) → `published_revision` → `archived`.
- World owner chooses `owner-only`, `approval-required`, or `open-community`. Open community does not imply automatic promotion to official canon.
- Use immutable revisions for published entities; edits produce new revisions.
- A content library can show `official`, `community`, and `private` distinctions plus creator attribution, world compatibility, rule complexity and content notices.
- No marketplace payments/revenue sharing required for MVP.

## Creator UX surfaces

- **Home / My Creations:** continue draft, test, or update published content.
- **Creation Chat + Cards:** conversational suggestions on one side, generated structured cards on the other. Editable without code.
- **Connections:** embedded browser for existing world people/places/rules; clear provenance, avoid duplicate creations.
- **Playtest:** launch disposable timeline with visible `Reset`, inspect scene, rules/memories included, feedback, and 'Apply suggestion'.
- **Publish wizard:** permission, compatibility, validation warnings, preview, explicit publish.

Mobile-first 390px flow with single-column editor, compact preview, and obvious Save/Playtest/Publish controls. Desktop supports side-by-side chat and form. Never require creators to see or edit raw JSON.

## Creator quality rubric

Before publication, verify: character has actual motives/limits, clear speech/behavior examples, scenario has actionable tension and alternative routes, no contradictory canon, compatible role requirements, no accidental knowledge leaks, rule packs tested on at least one positive and negative example. Provide auto-generated explanations in plain language, not opaque completeness scores.


---

# 07 — Technology Architecture, Existing Code and Migration

## Platform decision

**Keep:** Cloudflare frontend/static assets; React/Vite/TypeScript/shadcn; Fly.io Node/Express TypeScript backend; Supabase Auth + PostgreSQL + RLS; Drizzle ORM; existing source control/testing practices.

**Add carefully:** provider-neutral AI SDK layer; direct major AI provider adapters and optional OpenRouter adapter; Supabase pgvector + PostgreSQL full-text search; versioned prompt/rule content; AI regression harness such as Promptfoo; optional managed tracing such as Langfuse; database-backed asynchronous processing when necessary.

**Do not require:** Vercel hosting, Next.js, Kubernetes, Redis, a new vector database, Graphiti/Neo4j, LangChain+Mastra+LangGraph simultaneously, microservices, or one agent per NPC.

Dependency versions and compatibility must be confirmed during implementation; do not assume current AI SDK version, gateway feature, model prices or tool APIs from this design are permanent.

## Logical architecture

```
React/Vite SPA (Cloudflare)
     │ authenticated HTTPS (streaming on supported route)
     ▼
Node/Express API (Fly.io)
  ├─ Auth/ACL & creator content CRUD
  ├─ Timeline + Scenario + Party service
  ├─ Context Intelligence / hybrid RAG
  ├─ Prompt Compiler & RulePack Resolver
  ├─ Scene Orchestrator / Model Gateway
  ├─ Outcome Validator / Event Store
  └─ Background job workers (same codebase initially)
     │                       │
     ▼                       ▼
Supabase Postgres       External model APIs
(Auth, state, events,      (mainstream direct,
knowledge, pgvector)        experimental via router)
     │
     └─ Object storage for assets (Supabase Storage or Cloudflare R2)
```

## Current repository inspection (2026-10-30)

Based on connected `Daakon/stonecaster` main branch:

- `client/src` React app, route/pages/features; retain frontend foundation.
- `server/aiProviders.ts` uses older direct OpenAI/Anthropic API patterns, including a synthetic narrative fallback on failure; replace with typed model adapter and explicit recoverable errors.
- `server/gameEngine.ts` ties gameplay to `gameSaves.gameData`, bundle content and adventure ID; build the new runtime beside it rather than bolting party/timeline logic into all its JSON paths.
- `server/game-engine.ts` is a separate class also named `GameEngine`; determine actual import/call sites before deprecating either.
- `server/bundleLoader.ts` requires specific Mystika-named assets (`world-codex.mystika-logic.json`, `adventure.whispercross.json`, etc.); this **must not** be the authoring model for new content.
- `shared/schema.ts` contains world, character, game save and game session concepts; add new normalized contracts/tables rather than destroy old saves.
- `server/narrativeStreaming.ts` handles existing WebSocket narrative phases and session lifecycle; reuse transport only where helpful. For simple scene requests, HTTP streaming/SSE is also viable.
- `AGENTS.md` requires mobile/a11y-first UX, Zod, tests, security, and has a ban on Next.js; retain compatible practices.
- Repository listing showed `.env` and `.env.test` are tracked. **Security check required:** inspect privately for actual secrets, rotate any exposed credentials, and remove sensitive environment material from tracked files/history as appropriate. Never print secrets to logs or coding-agent output.

These source observations describe the checked branch, not necessarily deployment state or work in unpublished branches. Verify live Git status and current deployed flows before changing production.

## Migration strategy: coexist, prove, redirect

### Stage 0 — Inventory and safety

- Confirm current routes, components, imports, deployed versions, branch state, migrations and secret posture.
- Record tests and existing data to preserve. Backup Supabase and identify data migration/rollback requirements.
- Mark legacy docs as historical; add this design pack under `docs/stonecaster-2/` in the repository when approved.

### Stage 1 — Minimum contracts

- Define Zod schemas for world revisions, player character, timeline, NPC definition/instance, party membership, scenario revision/run, event union and model profiles.
- Add tables and indexes with additive Drizzle migrations; enforce RLS and user/creator ownership.
- Start new server feature folder (`server/story2/` is a suggestion) to avoid editing legacy `GameEngine` until new runtime is proven.

### Stage 2 — One persistent timeline + scenario switch

- Use a fixed test world and 2 scenarios. Add player character, persistent NPC instance, party membership, event log, scenario entry/turn/completion/abandon. No AI creator yet.
- Prove character and companion state survives scenario exit/entry. Test cast conflicts and duplicate recruitment.

### Stage 3 — Context and prompt-driven rules

- Integrate exact context lookup, scoped RAG, memory extraction, and rule pack selection. Start with stable rule packs `NPC Agency`, `Relationships`, `Abilities`, and `Tactical Conflict`.
- Implement model-neutral structured turn outcomes and cost tracking. Reuse Jev classifiers only after measuring quality improvements.

### Stage 4 — Creation Assistant and publishing

- Add typed AI creator tools, guided editor, playtest scratch timelines, content publishing revisions and world compatibility approvals.
- Only then build community discovery. Preserve private-to-public revision metadata and rights.

### Stage 5 — Cutover and clean-up

- Feature-flag new player routes; use synthetic/migrated test data first. Provide import workflow for legacy worlds/saves if necessary; don't promise automatic fidelity for all legacy bundle formats.
- Run new and old runtimes side by side for an evaluation period; monitor errors, cost and user retention.
- Once old data/migration is validated, retire duplicated engines and outdated prompt code in a separate cleanup step.

## Suggested API contracts (initial)

```text
GET    /api/v2/worlds
POST   /api/v2/worlds                      [creator]
GET    /api/v2/worlds/:worldId/content
POST   /api/v2/characters                  [player]
POST   /api/v2/timelines                   [player]
GET    /api/v2/timelines/:timelineId
GET    /api/v2/timelines/:timelineId/party
POST   /api/v2/timelines/:timelineId/scenario-runs
POST   /api/v2/scenario-runs/:runId/turns
POST   /api/v2/scenario-runs/:runId/pause
POST   /api/v2/scenario-runs/:runId/resume
POST   /api/v2/scenario-runs/:runId/complete
POST   /api/v2/scenario-runs/:runId/abandon
POST   /api/v2/creator/drafts               [creator]
POST   /api/v2/creator/drafts/:id/playtest   [creator]
POST   /api/v2/creator/drafts/:id/publish    [explicit approval]
```

These are proposals, not a frozen external API; finalize with OpenAPI/Zod types before implementing clients. Responses should return immutable identifiers, timeline/run version and clear event summaries. Use per-turn idempotency keys and optimistic concurrency.

## Operation and cost controls

- Track AI input/output tokens, selected model/provider, compiled context size, RAG duration, total latency, success/failure and actual rated cost per successful turn.
- Cost and rate budgets per player, model profile and creator generation; safe queue/admission limits for high concurrency.
- Fly app is stateless for turn execution; durable state/events live in Supabase. Avoid in-memory authoritative sessions.
- Use pool limits and connection reuse for Postgres; bounded pgvector queries with well-indexed scope keys.
- Put portraits and uploaded media in object storage, not Postgres rows; image generation and heavy uploads are deferred.
- No need to migrate hosts solely because we use an AI SDK. Maintain portable SQL and providers for future alternatives.

## Production safeguards

- Verify Supabase JWT, require world/timeline ACL, use RLS for client-data paths, and never expose service keys in Cloudflare client bundles.
- Creator uploads and retrieved documents are untrusted; apply size limits, content parsing validation, prompt-injection boundaries and document provenance.
- Store versioned, revocable content publication and audit actor/owner for writes. Avoid logging private roleplay or unpublished lore by default to third-party telemetry.
- Background memory extraction must be idempotent and reconcile with accepted event IDs.


---

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


---

# 09 — Coding Agent Handoff and Implementation Guardrails

## Mission

Implement **StoneCaster 2.0** as a simpler, extensible world/scenario/character storytelling runtime. Preserve complex *prompt-based* rule support, reliable RAG/context, persistent companions, and AI-guided creation. Do **not** rebuild the original deterministic RPG engine or require entire creator-authored world bundles.

Read in order: `00_START_HERE.md`, `02_DOMAIN_AND_CONTENT.md`, `03_STORY_RUNTIME.md`, `04_CONTEXT_MEMORY_RAG.md`, `05_RULE_PACKS_AND_MODELS.md`, then UX/creator/migration/evaluation documents. Honor `AGENTS.md` when compatible. Treat legacy files as implementation references rather than 2.0 authority.

## Copy-ready kickoff prompt

> You are the lead engineering agent implementing StoneCaster 2.0 in the existing `Daakon/stonecaster` repository. Read `docs/stonecaster-2/00_START_HERE.md` and all companion design documents first. Begin with **P0 source audit and P1 minimal state contracts**, not a broad rewrite. Preserve React/Vite + Cloudflare, Node/TypeScript + Fly.io, Supabase/Drizzle. Make worlds, NPC definitions, scenarios, prompt rule packs and timeline instances composable. Player characters, companion NPC instances and parties are anchored to a world timeline; scenarios are transient runs. Use prompt-based rules for fictional adjudication, but server-authoritative event schemas and persistence. Implement only the next approved vertical-slice milestone. Write migrations, tests and documentation; show the proposed files/contracts and risks before editing. Avoid introducing microservices or multiple overlapping orchestration frameworks.

## First task / P0 deliverables

1. Map actual runtime imports/routes: where does gameplay begin, which `GameEngine` is used, which streaming endpoint and provider code is active?
2. Assess schema, migrations and existing save data. Identify every place that assumes `save === scenario` or `NPC === scenario-local`.
3. Verify working branch and live deployment boundaries; do not assume main branch represents unpublished Jev/Director work.
4. Check tracked environment files privately for exposed credentials and prepare a safe remediation plan; never echo values.
5. Produce a short ADR covering additive v2 tables, event commit semantics, turn API, and isolation from legacy code.
6. Create/confirm the small fixture world and tests proving A→B continuity as the first implementation target.

Output: concrete change plan (files, migrations, test cases, rollback), then implement P1 only. Subsequent work continues phase by phase.

## Implementation principles

- One owner of timeline facts: validated event log with snapshots and optimistic version.
- Code handles correctness of persistence and access; prompt packs handle fictional success, failure and complex rules.
- One scene-model call by default, not one agent per character. Jev classification/feasibility optional if benchmarked.
- Mandatory state loaded by typed SQL, optional lore/memory by scoped hybrid RAG; all retrieved content treated as data.
- Full scene cast includes own goals/beliefs/knowledge; hidden creator secrets never presented as NPC-known truths.
- Creator requests produce **drafts**; only a reviewed publish action creates immutable, visible content revisions.
- Keep old runtime behind a feature flag until new data migration is proven. Do not delete legacy saves.
- In all prompts and tests, define an NPC's independent response to player action; user claims do not directly overwrite NPC intent.
- Use idempotency per turn and transactions for commits; no fake success response on AI failure.
- Integrate cost logging and model compatibility checks from the start.

## Definition of Done for each milestone

- Zod/OpenAPI or shared typed interfaces and additive migrations updated.
- Unit tests for behavior, auth, ACL, tenancy, and failure modes.
- Integration tests on Postgres with fixtures; E2E coverage for player/creator interactions where relevant.
- Mobile-first UX tested at 390px; keyboard + screen reader + axe.
- Production-compatible config with no client-exposed service keys; lint/types/tests pass.
- Any relevant legacy docs annotated/superseded to avoid contradictory source-of-truth instructions.
- Measured AI token usage/latency in runs using AI; no invented quality/performance claims.
- Demo the acceptance gate of the phase before moving to the next phase.

## Questions coding agents should resolve by safe defaults

- **Which models?** Use provider-neutral profiles, verify live APIs before pinning. Don't freeze model names in contracts.
- **Which orchestration framework?** AI SDK + small orchestrator by default; isolate Mastra experiment behind a short spike if useful.
- **What rules?** Four initial packs (Agency, Relationships, Abilities, Tactical Conflict), but allow rich creator-defined versions. No coded RPG algorithm.
- **How many players per timeline?** One player character in MVP; co-op postponed.
- **How many active scenarios?** One active or paused scenario per timeline in MVP; leaving/completing frees entry to another.
- **Cross-world characters?** Not in MVP; hard reject incompatible world IDs.
- **How are NPCs shared?** Published definition is shared, mutable instance is unique to a player's timeline.
- **When to add infrastructure?** Only after measurement; keep first implementation on Fly.io and Supabase.

## Pitfalls to avoid

- Building elaborate generic platform abstractions before the two-scenario prototype.
- Implementing fictional mechanics twice (in prompts and in code).
- Treating vector search results as automatically true or NPC-known.
- Inferring a permanent relationship or recruitment solely from narrative prose without committed event.
- Creating a new NPC instance whenever a scenario references an existing character.
- Treating a model-generated scenario draft as immediately published canon.
- Letting the server stream unvalidated critical outcomes and then reject them.
- Broad refactoring of legacy game engine, bundles, admin pages and deployment all in one PR.
- Embedding all dialogue or making one AI model call per NPC per turn.

## Suggested work split for two coding agents

After P0 contracts are frozen:

- **Agent A: backend/domain** — database migrations, Timeline/Party/Scenario/Event contracts, endpoints and tests. Owns `shared` schemas and `server/story2` runtime.
- **Agent B: frontend/experience** — world selection, timeline/party/scenario UX, story presentation, creator drafts shell. Uses frozen API DTOs; does not change server event contracts or migrations concurrently.

Next split after P1: one agent on Context/RAG/Rule Packs and another on Creator Studio/UX, with common prompt contract maintained under a single owner. Use feature flags and isolated files; merge through integration checks.

## Source references for future implementers

- Project repo: https://github.com/Daakon/stonecaster (connected private repository; permission required).
- RAG guidance: https://supabase.com/docs/guides/ai/hybrid-search
- AI SDK: https://ai-sdk.dev/docs/introduction
- Promptfoo: https://www.promptfoo.dev/docs/configuration/guide/
- Existing repo `AGENTS.md` for coding/test/deploy conventions, subject to this pack's priority.

