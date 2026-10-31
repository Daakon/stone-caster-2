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
