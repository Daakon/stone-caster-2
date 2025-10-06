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

## Layer P2 - Prompt Assembly Pipeline ✅ COMPLETED
**Goal:** Build an auditable, low-token-cost prompt system that can stitch world, adventure, scenario, and player context before hitting the AI.

### Deliverables ✅
- ✅ `backend/src/prompts/manifest.ts` - Master catalog that maps prompt scopes to file exports with schema versions, hashes, and allowlisted variables
- ✅ `backend/src/prompts/loader.ts` - Generic loader that dynamically reads JSON/MD files from GPT Prompts directory
- ✅ `backend/src/prompts/assembler.ts` - PromptAssembler service that composes manifest entries with runtime data
- ✅ `backend/src/prompts/schemas.ts` - Zod schemas for template metadata and assembled payloads
- ✅ `backend/src/prompts/variables.ts` - Variable allowlist and validation system

### Implementation Details ✅
1. ✅ **Generic File Loading**: System dynamically reads JSON/MD files from `GPT Prompts/` directory structure
2. ✅ **Load Order Management**: Templates loaded in strict order (Foundation → Core Systems → Engine → AI Behavior → Data Management → Performance → Content → Enhancement)
3. ✅ **Variable Allowlist**: Canonical variable surface defined with validation (`character.name`, `game.summary`, `world.rules`, etc.)
4. ✅ **Context Assembly**: Runtime context built from game state, character data, world template, and adventure info
5. ✅ **Audit Trail**: Complete audit logging with template IDs, versions, hashes, and context summaries
6. ✅ **Token Estimation**: Rough token counting for cost monitoring
7. ✅ **World-Specific Loading**: Automatically loads world-specific templates based on game context
8. ✅ **Error Handling**: Graceful handling of missing templates and validation failures

### Architecture
```
Game Context → PromptAssembler → PromptLoader → GPT Prompts/
     ↓              ↓                ↓              ↓
Character      Manifest         File System    JSON/MD Files
World          Templates        Load Order     Dynamic Content
Adventure      Validation       Variables      World-Specific
Runtime        Assembly         Audit Trail    Core Systems
```

### Key Features
- **Dynamic Loading**: No hardcoded world-specific files - reads actual GPT Prompts directory
- **Load Order Enforcement**: Templates loaded in strict authority hierarchy
- **Variable Validation**: Only allowlisted variables can be used in templates
- **Audit Logging**: Complete traceability of prompt assembly process
- **Token Management**: Estimation and monitoring of prompt size
- **World Agnostic**: Works with any world by loading appropriate templates
- **Debug System**: Real-time debug panel for viewing prompts, AI responses, and state changes
- **Game State Management**: Initial game state creation and action-based state updates

### Debug System ✅
- ✅ **Debug Service**: Real-time logging of prompts, AI responses, and state changes
- ✅ **Debug API**: REST endpoints for accessing debug data
- ✅ **Debug Panel**: Frontend component for viewing debug information
- ✅ **Game State Service**: Initial game state creation and action-based updates
- ✅ **Database Schema**: Game states table with proper indexing and RLS

### Exit Criteria ✅
- ✅ Prompt manifest with hashes, schema versions, and variable allowlists
- ✅ PromptAssembler returns deterministic strings using server-side data
- ✅ Unit tests covering happy and invalid paths
- ✅ Documentation reflects the pipeline architecture
- ✅ System ready for future Supabase registry (metadata and hashing explicit)
- ✅ Debug system for monitoring prompt assembly and AI responses
- ✅ Game state management for initial states and action-based updates

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

