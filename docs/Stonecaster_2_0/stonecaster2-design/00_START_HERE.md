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
