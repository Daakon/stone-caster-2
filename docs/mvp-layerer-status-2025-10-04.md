# MVP Layerer Status - 2025-10-04

## TL;DR
- [partial] Layers M0-M3 have server endpoints and migrations in place, but guest identity, ledger wiring, and DTO usage still block clean tester flows.
- [partial] React play surfaces lean on mock data, leaving Layers M4+ effectively undone despite backend coverage.
- [todo] Repository docs (for example docs/API.md) still describe the old x-user-id auth shape and must be refreshed when fixes land.

_Status legend_: [done] complete  |  [partial] in progress or incomplete  |  [todo] not started

## Core Principles - [partial]
- [done] Standard response envelopes include a traceId (`backend/src/utils/response.ts:17`).
- [done] Wrapper services exist for AI, payments, and monitoring (`backend/src/wrappers/`).
- [partial] Guest-first auth leaks 401s for anonymous checks (`backend/src/routes/me.ts:16`) and turn processing ignores guest wallets (`backend/src/services/turns.service.ts:75`).
- [partial] Frontend still hydrates adventures/worlds from mock JSON (`frontend/src/pages/CharacterSelectionPage.tsx:61`, `frontend/src/pages/GamePage.tsx:87`), so server-only state is not true yet.
- [partial] Docs reference deprecated x-user-id headers (`docs/API.md:5`).

## Layer M0 - Baseline & Static Content Loader - [partial]
- [done] /api/content/worlds serves DTO-filtered static content with trace metadata (`backend/src/routes/content.ts:69`).
- [partial] /api/me returns 401 instead of { kind: 'guest', user: null } for anonymous users (`backend/src/routes/me.ts:16`).
- Next steps: update /api/me, add regression coverage, sync docs.

## Layer M1 - Characters & Wallet Foundations - [partial]
- [done] Supabase migrations add world validation, guest ownership, and wallets (`supabase/migrations/009_m1_characters_wallet.sql`).
- [done] Character service enforces world slug validation and ownership (`backend/src/services/characters.service.ts:60`).
- [partial] /api/premades still returns hard-coded mock data (`backend/src/routes/premade-characters.ts:84`).
- [partial] CharactersService.createCharacterFromPremade pulls from mock data, so seeded premades are unused (`backend/src/services/characters.service.ts:120`).
- [done] Authenticated wallet readouts exist at /api/stones/wallet (`backend/src/routes/stones.ts:17`).
- Next steps: wire premades to Supabase, expand tests for guest/auth character CRUD, refresh docs.

## Layer M2 - Game Spawn & Single-Active Constraint - [partial]
- [done] POST /api/games issues guest cookies and enforces one active game per character (`backend/src/routes/games.ts:12`, `backend/src/services/games.service.ts:32`).
- [done] Starter stone grants run on first spawn (`backend/src/services/games.service.ts:220`).
- [partial] /api/games/:id denies callers lacking resolved identity even when guest cookies are present (`backend/src/routes/games.ts:41`).
- [partial] Frontend spawn/resume path still uses mock adventure metadata (`frontend/src/pages/CharacterSelectionPage.tsx:61`).
- Next steps: allow guest lookups without 401s, hydrate UI from live DTOs, add conflict/resume tests.

## Layer M3 - Turn Engine - [partial]
- [done] Idempotency guard and storage are in place (`backend/src/services/turns.service.ts:37`, `supabase/migrations/20241201000000_create_idempotency_keys.sql`).
- [partial] Guest turns fail because wallet lookup assumes authenticated owners (`backend/src/services/turns.service.ts:75`).
- [partial] Prompt assembly is still a placeholder string without template validation (`backend/src/services/turns.service.ts:185`).
- [partial] Game UI still consumes mock world/character context instead of the returned DTO (`frontend/src/pages/GamePage.tsx:93`).
- [done] Ledger entries are appended on stone spend and grants (`backend/src/services/wallet.service.ts:210`).
- Next steps: respect guest wallets, move prompt building to templates, drive the UI from DTOs, extend tests for guest insufficient balance and timeout handling.

## Layer M4 - Play UI (Mobile-First) - [partial]
- [done] Shadcn/Tailwind layout is responsive (`frontend/src/pages/GamePage.tsx:172`).
- [partial] Key panels still pull from mockDataService (`frontend/src/pages/GamePage.tsx:87`).
- [partial] Relationship/faction deltas rely on mocked rule data instead of TurnDTO fields (`frontend/src/pages/GamePage.tsx:220`).
- Next steps: replace mock selectors with React Query against live endpoints, verify mobile drawer/ARIA requirements, add Vitest/Playwright coverage.

## Layer M5 - Hardening & QA Readiness - [partial]
- [done] Observability middleware adds trace-aware logging (`backend/src/middleware/observability.ts:22`).
- [partial] Telemetry endpoint is still stubbed and lacks config toggles.
- [partial] Tester documentation has not been updated for the guest/JWT flow (`docs/API.md:5`).
- Next steps: finish telemetry wiring, document tester onboarding and error triage, decide log sampling strategy.

## Layer M6 - Profiles & Account Safety - [partial]
- [done] JWT-protected profile routes support CSRF tokens and session revocation (`backend/src/routes/profile.ts:13`).
- [partial] Guest-to-auth linking relies on CookieUserLinkingService but lacks automated tests for merge idempotency.
- [partial] No regression proves the ledger writes the LINK_MERGE entry on upgrade.
- Next steps: add merge/ledger tests, surface UX prompts for gated actions, cover negative cases.

## Layer M7 - Save Games Management - [todo]
- [todo] No save-slot schema or API exists; turns table only stores buffered outputs (`backend/src/services/games.service.ts:94`).
- [todo] Frontend has no save/continue affordances beyond placeholders.
- Next steps: design checkpoint/save-slot storage, enforce auth gating, wire guest-to-user migration.

## Layer M8 - Payments & Stone Purchases - [partial]
- [done] Payments wrapper and purchase endpoint exist with validation (`backend/src/routes/stones.ts:46`, `backend/src/wrappers/payments.ts`).
- [partial] Flow is auth-only and lacks Playwright coverage for success/failure.
- [partial] Webhook verification/test-mode wiring are still TODOs.
- Next steps: integrate Stripe test mode, add webhook verification tests, expose stone packs in the UI.

## Layer M9 - Prompt System Hardening - [todo]
- [todo] No template registry, variable allowlist, or audit log exists; prompt text is raw string interpolation (`backend/src/services/turns.service.ts:185`).
- Next steps: implement templates, schema versioning, audit persistence, and PII filtering.

## Layer M10 - Release Candidate QA Suite - [todo]
- [todo] No load, security, or resilience harness exists; current tests stop at unit/integration specs (`backend/src/routes/games.turn.integration.test.ts`).
- Next steps: build performance scripts, add CSRF/webhook security tests, script resilience scenarios (AI failure, DB restart).

## Cross-Cutting Follow-Ups
1. Refresh docs (`docs/API.md`, `docs/TEST_PLAN.md`, UX guides) to match the guest cookie + JWT approach.
2. Replace mockDataService usage with live DTOs and add React Query caching for gameplay surfaces.
3. Expand Vitest/Playwright coverage for guest flows, auth upgrades, insufficient stones, and purchases.
