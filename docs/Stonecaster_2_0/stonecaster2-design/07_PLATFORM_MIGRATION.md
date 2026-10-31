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
