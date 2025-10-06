# Play Flow Layered Implementation Plan

## Overview
This document outlines the layered path to deliver the end-to-end Play flow. Each layer is self-contained, leaves the system in a shippable state, and must be fully validated (unit, integration, Playwright, axe) before advancing. The canonical user entry point is the existing `/play/:gameId` route, which already renders server-fed game DTOs; all layers build on that surface.

## Context & Objectives
- Replace remaining mock gameplay data with live DTOs consumed by the `/play/:gameId` experience.
- Assemble AI prompts from game save, character, rules, world, scenario, and adventure sources.
- Parse AI JSON payloads, apply delta changes server-side, and surface updated state to the client.
- Keep Supabase (DB + Realtime) authoritative and keep the frontend focused on UI rendering.

## Prompt Strategy (MVP vs. Long Term)
- **MVP:** Keep prompt templates in server-side TypeScript/JSON modules for faster iteration. We can hard-code the stitched prompt content in `promptsService` while the registry interface settles.
- **Future:** Migrate the same schema into managed storage (Supabase tables) once editing/versioning needs expand. The plan below calls this out in Layer P2; if inline code becomes cumbersome earlier, we can lift the same structure into DB-backed JSON without changing the frontend.
- Recommendation: stay in code for MVP to avoid migration overhead, but mirror the structure so moving to Supabase later is a lift-and-shift.

## Assumptions
- Supabase Realtime will broadcast `turns` table inserts; when unavailable we fall back to short-lived React Query polling.
- Prompt fragments in `GPT Prompts/Core` remain the canonical source and can populate the server-side registry described above without breaking existing migrations.
- Static adventure/character seed data may live as JSON on the server, but must be served through authenticated API routes so crawlers cannot access raw files.
- Existing ledger and wallet tables are the source of truth for the stone economy; guests and authenticated users share the same APIs with ownership scoped via JWT or cookie group IDs.

---

## Layer P0 – Close M0–M3 Gaps
**Goal:** Unblock guest-first playthroughs on the current endpoints.

- Fix `/api/games/:id` to honor guest cookies instead of returning 401 (see `backend/src/routes/games.ts:88`).
- Ensure `WalletService.spendCastingStones` writes guest transactions with ledger metadata (see `backend/src/services/wallet.service.ts:333`).
- Add regression tests for guest spawn/turn flows and insufficient stones.
- Refresh docs: `docs/FEATURES.md`, `docs/API_CONTRACT.md`, `docs/TEST_PLAN.md`.
- Exit criteria: guest spawn->turn loop succeeds end-to-end through `/play/:gameId` with Vitest + Playwright coverage and axe clean on affected screens.

## Layer P1 – Replace Frontend Mocks
**Goal:** Make the Game UI consume live DTOs exclusively.

- Expose real DTOs for adventures, premades, and characters (replace `/api/premades` mocks). Static JSON can live inside the backend or Supabase, but must be delivered via API endpoints and shielded from unauthenticated access.
- Remove `mockDataService` usage in `frontend/src/pages/GamePage.tsx` in favor of React Query hooks that call those backend endpoints.
- Implement loading/skeleton states and optimistic turn submission.
- Update Vitest component tests and Playwright suites to cover live data paths.
- Exit criteria: Game page renders entirely from server APIs on mobile and desktop viewports with updated docs.

## Layer P2 – Prompt Assembly Pipeline
**Goal:** Build audited prompt templates that stitch all required context.

- Formalize a server-side template registry (world/adventure/scenario/quest scopes) seeded from `GPT Prompts/Core` assets. During MVP this can remain as code modules or structured JSON loaded at boot.
- Implement allowlisted variable interpolation for game state, character traits, world rules, scenario steps, and latest turn history.
- Validate template metadata with Zod versions and enforce schema compatibility in `promptsService`.
- Document prompt pipeline in `docs/UX_FLOW.md` and update `docs/API_CONTRACT.md` for any exposed template admin endpoints.
- Exit criteria: prompts constructed from the registry with audit logs and unit/integration coverage, ready to migrate into Supabase when needed.

## Layer P3 – Turn Engine & Delta Application
**Goal:** Harden server-side turn processing and state mutation.

- Extend `gamesService.applyTurn` to merge typed world state, advance scenario progress, and evaluate win/loss conditions (starting at `backend/src/services/games.service.ts:289`).
- Expand `TurnResponseSchema` to include explicit delta types and rollback hints.
- Add transactional guard around AI parsing -> state write -> stone spend (idempotent, rollback on failure).
- Cover stone spend idempotency, AI timeout, malformed JSON, and guest wallet edge cases in integration tests.
- Exit criteria: buffered turn loop resilient to upstream failures with deterministic state outcomes.

## Layer P4 – Client Game Experience
**Goal:** Deliver polished mobile-first gameplay UI driven by live data.

- Rebuild `GamePage` to hydrate history from `TurnDTO`s, render world/character panels from DTO metadata, and handle optimistic turns vs. confirmed state.
- Ensure navigation meets spec: mobile drawer for authed routes, persistent sidebar on `md+`.
- Add accessibility affordances (labels, `aria-describedby` on forms) and verify axe 0 serious/critical.
- Expand Vitest coverage for reducers/hooks and Playwright coverage for mobile + desktop flows hitting `/play/:gameId`.
- Exit criteria: visually-hardened Play UI with live data, responsive layouts, and accessibility checks passing.

## Layer P5 – Live State Sync
**Goal:** Keep the client in lockstep with server turns.

- Publish Supabase Realtime events on `turns` inserts (DB trigger or service-layer publish).
- Create a React hook that subscribes to the channel, reconciles optimistic updates, and falls back to polling when offline.
- Handle disconnect/resubscribe flows with telemetry breadcrumbs.
- Document operational expectations and recovery paths in `docs/TEST_PLAN.md`.
- Exit criteria: client reflects server turn state within a single event latency; automated tests simulate disconnect/reconnect scenarios.

## Layer P6 – Observability & Safety
**Goal:** Make prompt/turn flow auditable and safe.

- Hash template versions, store prompt audits, and redact PII before dispatching to the AI wrapper.
- Add structured logging for turn failures, AI validation errors, and ledger anomalies.
- Expand Playwright axe sweeps for Game/Character Creation/Dashboard, ensuring zero serious/critical violations.
- Update documentation (`FEATURES`, `API_CONTRACT`, `TEST_PLAN`) with observability metrics and runbooks.
- Exit criteria: auditable prompt history, enforced PII guard, telemetry dashboards populated, accessibility guards verified.

## Layer P7 – Hardening & Rollout
**Goal:** Validate performance, resilience, and RLS before broad testing.

- Run load tests for spawn -> three-turn -> save loop; capture p95 goals per layer requirements.
- Simulate AI failures, stale idempotency keys, and DB restarts; ensure graceful recovery.
- Review Supabase RLS/policies for new tables/triggers; update `docs/MIGRATION_PLAN.md` if schema evolved.
- Complete regression suites (Vitest + Playwright headless single-run) under CI env vars (`CI=1`, `PWDEBUG=0`, etc.).
- Exit criteria: green regression suite, documented rollback plan, signed-off QA report for tester-ready release.

---

## Cross-Layer Checklist
- Zod validation on all new inputs/outputs; strict TypeScript (no `any`).
- Update key docs (`FEATURES`, `UX_FLOW`, `API_CONTRACT`, `TEST_PLAN`, `MIGRATION_PLAN` when schema changes).
- Maintain ledger integrity for every stone delta (grant/spend/purchase/restore).
- Ensure mobile-first design (375–812 px) and axe compliance on each layer increment.
- No remote ops (push/deploy); atomic commits per agent guidelines.

