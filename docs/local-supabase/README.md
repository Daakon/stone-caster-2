# StoneCaster isolated local stack

A complete, reproducible local copy of the app: Supabase (Postgres 17 + Auth + REST) in Docker, the Express backend and the
Vite frontend. It never touches hosted Supabase and does not share containers, volumes, networks or ports with your other Docker workloads.

## Isolation

| Thing | Value |
|---|---|
| Supabase project id (container/volume suffix) | `stonecaster` → `supabase_db_stonecaster`, `supabase_auth_stonecaster`, … |
| API (Kong/PostgREST/GoTrue) | `http://127.0.0.1:54421` |
| Postgres | `127.0.0.1:54422` (`postgres`/`postgres`) — shadow DB `54420` |
| Studio / Mail (Inbucket) | `http://127.0.0.1:54423` / `http://127.0.0.1:54424` |
| Backend | `http://localhost:3000` |
| Frontend | `http://localhost:5183` (pinned; `--strictPort`) |
| Disabled to save resources | realtime, storage, edge runtime, analytics, pooler |

`npm run local:dev` refuses to start if `3000` or `5183` is taken and tells you which port.

## Everyday commands (run from the repo root)

```bash
npm run local:dev            # Supabase stack + backend + frontend, MOCK AI (no external model calls)
npm run local:dev:real       # same, but REAL OpenAI (uses OPENAI_API_KEY/PRIMARY_AI_MODEL from backend/.env; costs tokens)
npm run local:health         # stack + seed + RLS + backend + frontend checks
npm run local:smoke          # API gameplay smoke test (backend must be running in MOCK mode)
npm run local:smoke:real     # same in REAL mode (backend must be running via local:dev:real)
npm run local:smoke:browser  # live Playwright test: UI login → turn → hard refresh (backend in MOCK mode)
npm run local:reset          # destroy + recreate the local DB from migrations + seeds, then run the health check
npm run local:up | local:down   # start / stop only the Supabase stack (data is kept)
npm run local:seed:export    # re-export BASE content from hosted (READ-ONLY, see below)
```

The backend runs in **watch mode** (`backend`: `npm run dev:watch` = `tsup --watch` + restart `node dist/index.js`): saving any file under `backend/src` or `shared/src` rebuilds and restarts it automatically (a few seconds). Frontend uses Vite HMR.
`npm run local:smoke:browser` is mode-aware: mock runs the full UI flow; real mode runs the same flow with a natural-language turn (and reports OpenAI `insufficient_quota` as a skip, not a failure).

Switching AI mode = stop (`Ctrl+C`) and start again with the other command. `GET http://localhost:3000/health` reports `mockAi`.
Both paths are the app's existing ones (`ENABLE_MOCK_AI` in `backend/src/config/ai-flags.ts`); nothing was replaced.

## Local users (all passwords: `stonecaster-dev`)

| Email | Role | Notes |
|---|---|---|
| `player@stonecaster.local` | `early_access` | approved; use this to play (the early-access guard blocks `pending`/`member`) |
| `admin@stonecaster.local` | `admin` (+ `moderator` in `app_roles`) | owns all copied base content |
| `pending@stonecaster.local` | `pending` | to test the request-access flow |

## What is in the repo

```
supabase/config.toml                 isolated ports + project id
supabase/migrations/2026020100000{0-5}_*.sql   canonical schema (structure identical to hosted) + CORRECTED RLS/grants
supabase/seed/00_dev_users.sql       deterministic local auth users / roles
supabase/seed/10_base_*.sql          GENERATED base content copied from hosted (no user data)
supabase/scripts/export-hosted-base.mjs   regenerates the 10_base_* files (read-only GETs)
.env.stonecaster-local               local endpoints + public Supabase demo keys (no secrets)
scripts/stonecaster-local.mjs        launcher / health / reset
scripts/stonecaster-smoke.mjs        API smoke test
frontend/e2e-local/ + playwright.local.config.ts   live browser smoke test
docs/local-supabase/RLS_CHANGES.md   every RLS/privilege difference from hosted
```

`backend/supabase/migrations/*` are the old, partial migrations; hosted already contains their effects and the root baseline supersedes them (they are no longer applied).

### Env handling
Hosted `.env` files are untouched. `scripts/stonecaster-local.mjs` injects `.env.stonecaster-local` into the child process
environment; dotenv (backend) never overrides existing variables and Vite gives process env priority over `frontend/.env`, so local values win only for these processes.
The Supabase CLI parses the repo-root `.env`; its leading UTF-8 BOM (invisible, values unchanged) was removed because the CLI rejects it.

### Base content seeds (what was copied from hosted)
prompts (13), official world `mystika` (1), ruleset templates (16), public entities (5), lore of that world (4, embeddings omitted),
tags (42) + asset tags, mechanics skills/conditions/resources, `app_config`/`pricing_config`/`ai_config`/`feature_flags`/`config_meta`, slots,
premade characters, localization glossary/rules, injection map, dialogue config/graphs, quest graphs.
**Not copied:** users, stories, player characters, game states, turns, telemetry, payments, media assets, private/test worlds, embeddings.
All ownership columns are remapped to the local admin id, so no production user ids are in the repo.
Re-export: `npm run local:seed:export` (uses the hosted service key already in `backend/.env`; issues GET requests only), then `npm run local:reset`.

## Fix log (application defects found by running the full loop against corrected RLS)

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Everything the backend did "as the user" ran as **anon** | `getChimeraSupabaseClient` / `getSupabaseClient` called `auth.setSession({refresh_token: ''})` un-awaited → silently failed. This is why hosted needed open `anon USING(true)` policies and RLS-off tables | JWT now passed as global `Authorization` header (`backend/src/db/supabase-client.ts`, `backend/src/lib/supabaseClient.ts`) |
| 2 | Compile: `description: Expected string, received null` | `WorldsRepository.findById/findByKey` parsed `definition` strictly; `mystika.definition.description` is `null` (also on hosted) | tolerant `normalizeWorldDefinition` (falls back to long/short description) |
| 3 | Character creation returned `{ok:true}` with no character | `ChimeraEntitiesService.createPlayerCharacter` never returned the row | `return data` |
| 4 | UI showed stamina `-9` right after a turn (91 after refresh) | client `applyAdditiveDelta` overwrote a missing resource; server baselines it to 100 | client mirrors the server baselines (`frontend/src/stores/useActiveGameStore.ts`) |
| 5 | `ai_audit_logs` ↔ turn link never applied | user-scoped update blocked by RLS (also on hosted) | narrow owner-only policy + column grant `turn_id` |
| 6 | Smoke player got `EARLY_ACCESS_REQUIRED` | fixture role | player fixture is `early_access` |

## Known limitations
See the final report in the task hand-off; the short list: real-AI turn needs OpenAI credits; media/Cloudflare, embeddings, OAuth providers, Stripe are not configured locally.
