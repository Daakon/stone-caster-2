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
