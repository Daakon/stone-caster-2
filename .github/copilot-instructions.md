<!--
Guidance for automated coding agents working on the Stonecaster monorepo.
Keep this file concise and strictly actionable. Do not add high-level policy or
legal text. Focus on repository-specific patterns, commands, and important
files that make an AI productive quickly.
-->

# Stonecaster — Copilot Instructions (concise)

Summary
- Monorepo with three packages: `frontend/` (React + Vite), `backend/` (Node + Express), and `shared/` (TS types/utilities).
- TypeScript-first: prefer changing TS files, run `npm run type-check` in the relevant workspace after edits.

Quick dev commands
- Install dependencies (workspace-aware): `npm install` from repo root.
- Start both dev servers: `npm run dev` (runs frontend + backend via workspaces).
- Start only frontend: `npm run dev --workspace=frontend` (uses Vite, served at http://localhost:5173).
- Start only backend: `npm run dev --workspace=backend` (uses tsx watch, server on port from `backend/.env`, default 3000).
- Build all: `npm run build` (runs builds in workspaces). Build `shared` first if you change types.

Testing & linting
- Run all tests: `npm test` (runs tests across workspaces using Vitest).
- Run frontend e2e: `npm run test:e2e --workspace=frontend` (Playwright). First-time: `npx playwright install`.
- Type check: `npm run type-check --workspaces` or per package `npm run type-check --workspace=backend`.
- Lint: `npm run lint --workspaces` or per package (frontend/backend/shared) scripts exist.

Project-specific patterns and conventions
- Shared types
  - `shared/src` contains Zod schemas and exported TS types used by both frontend and backend. If you change types, update `shared` and run `npm run build --workspace=shared` before building other packages.

- Backend
  - Entry: `backend/src/index.ts`.
  - Routes live in `backend/src/routes/*.ts` (examples: `characters.ts`, `story.ts`, `dice.ts`). Follow existing pattern: route -> service -> shared types and Zod validation.
  - Services in `backend/src/services/*.ts` (AI, dice, supabase wrappers). Use Zod schemas for request/response validation (see `shared/src/types` and `backend/src/services/config.service.ts`).
  - Config scripts: `backend/scripts/setup-config.js` and `verify-config.js` — used by CI or local setup. Respect environment variable names defined in README and `.env` examples.

- Frontend
  - Entry: `frontend/src/main.tsx`. Pages under `frontend/src/pages/*` (e.g., `GamePlayPage.tsx`, `CharacterCreationPage.tsx`).
  - Data fetching: uses TanStack Query. Look for `src/services/api.ts` and `src/services/supabase.ts` for API and auth patterns.
  - State: lightweight global state via `zustand` in `frontend/src/store/*`.

- Tests
  - Unit tests use Vitest; see `*.test.ts` files in `backend/src` and `frontend/src/test`.
  - E2E tests live in `frontend/e2e` (Playwright). Keep network stubbing minimal — tests expect dev servers or properly mocked endpoints.

Integration & external dependencies
- Supabase: database + auth. Migrations in `supabase/migrations/*.sql`. RLS (Row Level Security) is expected by backend code — do not remove RLS-related logic without validating access patterns.
- OpenAI: backend integrates via `openai` SDK in `backend/src/services/ai.ts`. API key is provided via `OPENAI_API_KEY` env var. Prefer using the configured model `OPENAI_MODEL` from env.
- Deployment hints: frontend uses Cloudflare Workers (Wrangler config in `frontend/wrangler.toml`), backend uses Fly.io (`backend/fly.toml` and Dockerfile). CI may reference these in docs.

Code style & safety checks
- Use existing Zod schemas for runtime validation; prefer updating Zod first when changing shapes.
- Keep API routes strongly typed: use types from `shared` for request/response shapes.
- When editing public API surface (routes or shared types), run type checks and tests in both frontend and backend to catch cross-package breakages.

Where to look for examples
- Dice mechanics: `backend/src/services/dice.ts` and tests `backend/src/services/dice.test.ts`.
- AI interactions: `backend/src/services/ai.ts` and usage in `backend/src/routes/story.ts`.
- Auth & Supabase usage: `frontend/src/services/supabase.ts` and `backend/src/services/supabase.ts`.

Non-obvious developer notes
- Workspaces: repo root `package.json` uses npm workspaces. Many scripts assume workspace-aware npm CLI (npm >=7). When running single-package scripts include `--workspace=<name>`.
- Shared build ordering: Because `frontend` depends on `shared`, changes to `shared` must be built (tsc) before frontend build; CI already runs workspace builds but local edits may require manual `npm run build --workspace=shared`.
- Environment variables: README and `docs/SETUP.md` list required variables. Sensitive keys (SUPABASE_SERVICE_KEY, OPENAI key) must not be checked into source.

Quick examples for common edits
- Add a new API route:
  1. Create route under `backend/src/routes/` and export in `backend/src/index.ts`.
  2. Add service in `backend/src/services/` and Zod type in `shared/src/types` if it's a public shape.
  3. Run: `npm run type-check --workspace=backend` then `npm run test --workspace=backend` and `npm run build --workspace=shared` (if types changed).

CI / Tests to run before PR
- Run `npm run type-check --workspaces` and `npm test --workspaces`. If frontend UI changes are included, run Playwright e2e locally where practical.

If something isn't discoverable here
- Open `docs/SETUP.md`, `README.md`, and `docs/IMPLEMENTATION.md` for higher-level rationale and deployment steps.

End of file

## Multi-agent compatibility

This file is primarily targeted at automated coding agents (Copilot-style and chat assistants). Make edits with the following cross-agent guidance so outputs work well with Cursor, ChatGPT (Codex), Claude, and GitHub Copilot:

- Be deterministic and minimal: prefer small, focused edits rather than large refactors. Agents that produce PRs or patches should emit unified, compilable diffs (not inline prose changes).
- Use repository conventions: respect `npm workspaces`, TypeScript-only files, and the `shared` package build ordering. Many agents rely on compiling or running tests after edits.
- Code examples: when showing code, include the file path and the smallest complete snippet needed to apply the change. Prefer single-file patches and avoid multi-file sweeping edits unless the change requires it.
- Tests & checks: include commands to run (example: `npm run type-check --workspace=backend`, `npm test --workspace=backend`) so agent users can validate changes locally or in CI.
- Secrets: never print or inject real secrets (API keys, service_role tokens). Use placeholders and `.env` examples; call out required env vars (see `docs/SETUP.md`).
- Linting & formatting: preserve existing file style. Do not reformat entire files; make minimal edits and run `npm run lint --workspaces` if adding stylistic changes.

Agent-specific hints
- Cursor / Copilot-style completions: produce compact diffs/patches suitable for the editor (avoid long inline explanations). When adding code, include only the changed file content or explicit apply_patch-style instructions.
- ChatGPT / Codex: provide runnable code blocks and explicit verification commands; include short tests where practical. Prefer step-by-step instructions when the change touches multiple packages.
- Claude: include a brief rationale for architectural changes and highlight cross-package implications (types, builds, tests). Claude users often prefer more context with edits.

If you need to expand this guidance (e.g., include CI YAML snippets or PR checklist templates), open an issue or request a separate update to keep this file concise.
