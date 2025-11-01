# Refactor Plan — New Game + Prompt Assembly (Phase 0 Inventory)

## 1) Summary

- **Goal**: Reuse existing modules, refactor in place, remove legacy later.
- **No code changes in this phase**. This doc inventories what exists and proposes minimal-diff changes.

## 2) Current Entry Points (Routes)

| Method | Path | File | Handler | Notes (Auth/Zod/etc.) |
|---|---|---|---|---|
| POST | `/api/games` | `backend/src/routes/games.ts:67` | `router.post('/', optionalAuth, ...)` | Creates new game via `GamesService.spawn()`. Validates `CreateGameRequestSchema` (adventureSlug, optional characterId). Creates guest user if no auth. |
| GET | `/api/games/:id` | `backend/src/routes/games.ts:133` | `router.get('/:id', optionalAuth, ...)` | Fetches single game via `GamesService.getGameById()`. Validates `IdParamSchema`. |
| GET | `/api/games` | `backend/src/routes/games.ts:195` | `router.get('/', optionalAuth, ...)` | Lists user's games. Validates query params (limit, offset). |
| POST | `/api/games/:id/turn` | `backend/src/routes/games.ts:238` | `router.post('/:id/turn', optionalAuth, requireIdempotencyKey, ...)` | Executes turn via `turnsService.runBufferedTurn()`. Validates `IdParamSchema` + `GameTurnRequestSchema` (optionId, userInput, userInputType). |
| GET | `/api/games/:id/turns` | `backend/src/routes/games.ts:331` | `router.get('/:id/turns', optionalAuth, ...)` | Gets all turns via `GamesService.getGameTurns(gameId)`. Orders by `turn_number` ascending. |
| GET | `/api/games/:id/session-turns` | `backend/src/routes/games.ts:395` | `router.get('/:id/session-turns', optionalAuth, ...)` | Gets session turns with narrative data via `GamesService.getSessionTurns()` + `getInitializeNarrative()`. Validates with `SessionTurnsResponseSchema`. |
| POST | `/api/games/:id/auto-initialize` | `backend/src/routes/games.ts:479` | `router.post('/:id/auto-initialize', optionalAuth, ...)` | Auto-creates initial prompt for games with 0 turns. Calls `turnsService.runBufferedTurn()` with `optionId: 'game_start'`. |
| POST | `/api/games/:id/initial-prompt` | `backend/src/routes/games.ts:632` | `router.post('/:id/initial-prompt', optionalAuth, ...)` | Creates initial prompt with approval via `promptsService.createInitialPromptWithApproval()`. Only for games with 0 turns. |
| POST | `/api/games/:id/approve-prompt` | `backend/src/routes/games.ts:710` | `router.post('/:id/approve-prompt', optionalAuth, ...)` | Approves prompt via `promptsService.approvePrompt()`. Validates body with Zod (promptId, approved). |

## 3) Services / Orchestrators

| Service Function | File | Called By | Key Responsibilities | Reuse/Modify/Delete |
|---|---|---|---|---|
| `GamesService.spawn()` | `backend/src/services/games.service.ts:51` | `POST /api/games` route | Creates new game. Resolves adventure from `adventureSlug`. Validates character/world matching. Creates game record with entry_point_id, world_id, ruleset_id, world_slug. Sets turn_count=0. | **Reuse** - Already creates games correctly. May need to add entry_start_slug param. |
| `GamesService.getGameTurns()` | `backend/src/services/games.service.ts:533` | `GET /api/games/:id/turns` route | Loads all turns for a game. Orders by `turn_number` ascending. | **Modify** - Add pagination with `afterTurn` and `limit` params. |
| `GamesService.applyTurn()` | `backend/src/services/games.service.ts:414` | `turnsService.runBufferedTurn()` | Applies turn result to game. Checks for duplicate turn_number. Creates turn record with turn_number = currentGame.turn_count + 1. Updates game state_snapshot and turn_count. | **Reuse** - Already handles turn_number assignment. |
| `GamesService.getSessionTurns()` | `backend/src/services/games.service.ts:558` | `GET /api/games/:id/session-turns` route | Fetches session turns with narrative data. Orders by `sequence` ascending. | **Reuse** - Already handles session turn retrieval. |
| `TurnsService.runBufferedTurn()` | `backend/src/services/turns.service.ts:48` | `POST /api/games/:id/turn` route, auto-initialize | Main turn orchestration. Handles idempotency, wallet checks, AI generation, validation, turn application. Creates initial prompt if turn_count=0. | **Modify** - For new games, assemble intro prompt using DatabasePromptAssembler. |
| `TurnsService.createInitialAIPrompt()` | `backend/src/services/turns.service.ts:655` | `TurnsService.runBufferedTurn()` | Creates initial AI prompt for games with 0 turns. Uses `aiService.generateTurnResponse()` with `optionId: 'game_start'`. | **Modify** - Replace with DatabasePromptAssembler.assemblePrompt() for new game flow. |
| `PromptsService.buildPrompt()` | `backend/src/services/prompts.service.ts:103` | `TurnsService.buildPrompt()` (private, unused?) | Builds prompt using DatabasePromptAssembler. Takes GameContext (id, world_id, character_id, state_snapshot, turn_index) and optionId. | **Reuse** - Already uses DatabasePromptAssembler. |
| `PromptsService.createInitialPrompt()` | `backend/src/services/prompts.service.ts:50` | Not called? | Creates initial prompt using DatabasePromptAssembler. | **Reuse** - Can be used for new game flow. |
| `DatabasePromptAssembler.assemblePrompt()` | `backend/src/prompts/database-prompt-assembler.ts:58` | `PromptsService.buildPrompt()` | Assembles prompt from database segments. Takes DatabasePromptParams (worldSlug, adventureSlug, startingSceneId, includeEnhancements). Returns promptText + metadata + audit. | **Modify** - Add strict ordering: core → ruleset → world → scenario? → entry → npc. Add budget policy with drop order (scenario → npc, never drop core/ruleset/world). |

## 4) Prompt Assembly Code

| Module/Function | File | Inputs (world_id, scenario_slug, entry_start_slug, etc.) | Outputs (content, meta) | Token Budget Logic | Reuse/Modify/Delete |
|---|---|---|---|---|---|
| `DatabasePromptAssembler.assemblePrompt()` | `backend/src/prompts/database-prompt-assembler.ts:58` | `DatabasePromptParams`: worldSlug, adventureSlug, startingSceneId, includeEnhancements | `DatabasePromptResult`: promptText, metadata (totalSegments, totalVariables, loadOrder, warnings), audit (templateIds, version, hash, contextSummary, tokenCount, assembledAt) | Estimates token count (text.length / 4). No budget enforcement. | **Modify** - Add strict segment order. Add budget policy. Track included/dropped segments in metadata. |
| `DatabasePromptAssembler.getPromptSegments()` | `backend/src/prompts/database-prompt-assembler.ts:138` | `DatabasePromptParams` | Array of `PromptSegment[]` from `PromptRepository.getCachedPromptSegments()` | None | **Modify** - Enforce ordering: core → ruleset → world → scenario? → entry → npc. |
| `PromptRepository.getCachedPromptSegments()` | `backend/src/repositories/prompt.repository.ts:172` | `PromptContextParams`: world_slug, adventure_slug, include_start, scene_id, include_enhancements | Cached `PromptSegment[]` from RPC `prompt_segments_for_context` | None | **Reuse** - Already fetches segments. May need to adjust RPC for ordering. |
| `DatabasePromptAssembler.processSegment()` | `backend/src/prompts/database-prompt-assembler.ts:164` | `PromptSegment`, variable context map | Processed segment text with variables replaced | None | **Reuse** - Already processes segments. |
| `DatabasePromptAssembler.buildContextObject()` | `backend/src/prompts/database-prompt-assembler.ts:186` | `DatabasePromptParams` | Context map for variable replacement (world, adventure, scene fields, game state, player state, RNG) | None | **Reuse** - Already builds context. |

## 5) Data Access / Repos (turns, games, segments)

| Concern | File(s) | SQL/Query Summary | Known Assumptions (ordering, joins) | Reuse/Modify/Delete |
|---|---|---|---|---|
| turns.read | `backend/src/services/games.service.ts:533` | `SELECT * FROM turns WHERE game_id = $1 ORDER BY turn_number ASC` | Assumes `turn_number` column exists. Orders by turn_number ascending. | **Modify** - Add pagination: `WHERE turn_number > $2 ORDER BY turn_number ASC LIMIT $3` for afterTurn support. |
| turns.write | `backend/src/services/games.service.ts:414` | `INSERT INTO turns (game_id, option_id, ai_response, turn_number, ...) VALUES (...)`. Checks `SELECT * FROM turns WHERE game_id = $1 AND turn_number = $2` before insert. | Assumes `turn_number` is set to `game.turn_count + 1`. Checks for duplicate turn_number before insert. | **Modify** - Add unique constraint check. Ensure turn_number=1 for first turn. |
| games | `backend/src/services/games.service.ts:373` | `SELECT * FROM games WHERE id = $1`. Also joins characters. | Uses `entry_point_id` (TEXT), `world_id` (UUID), `world_slug` (TEXT), `turn_count` (INT). | **Reuse** - Already handles game CRUD. |
| entry_points | `backend/src/utils/adventure-identity.ts:76` | `SELECT id, slug, title, description, synopsis, world_id, tags FROM entry_points WHERE (id = $1 OR slug = $1) AND lifecycle = 'active'` | Assumes entry_points.id is TEXT (not UUID). `world_id` is UUID FK to `world_id_mapping.uuid_id`. | **Reuse** - Already resolves entry points. |
| segments (core/ruleset/world/scenario/entry/npc) | `backend/src/repositories/prompt.repository.ts:44` | RPC: `prompt_segments_for_context(p_world_slug, p_adventure_slug, p_include_start, p_scene_id, p_include_enhancements)`. Returns segments with layer, scope, ref_id, sort_order. | Assumes segments are ordered by sort_order from RPC. Scope values: 'core', 'ruleset', 'world', 'entry', 'entry_start', 'npc', 'game_state', 'player', 'rng', 'input'. | **Modify** - Ensure RPC returns segments in strict order: core → ruleset → world → scenario? → entry → npc. May need to adjust RPC or post-process ordering. |

## 6) DB & Migrations (What Exists)

- **Tables found relevant to flow**:

  - `turns`: columns = `id` (bigserial), `game_id` (uuid FK), `idx` (int, legacy?), `role` (text: 'system'|'narrator'|'player'), `prompt_meta` (jsonb), `content` (jsonb), `costs` (jsonb), `created_at` (timestamptz). **NOTE**: Code references `turn_number` column, but migrations show `idx`. Need to verify actual schema.
  
  - `games`: columns = `id` (uuid), `entry_point_id` (text FK), `entry_point_type` (text), `world_id` (uuid FK to world_id_mapping), `ruleset_id` (text FK), `owner_user_id` (uuid, nullable), `state` (jsonb, named `state_snapshot` in code), `turn_count` (int), `status` (text), `created_at`, `updated_at`. Also has `world_slug` (TEXT, denormalized), `character_id` (uuid FK, nullable), `user_id` (uuid, nullable), `cookie_group_id` (uuid, nullable) based on code usage.
  
  - `entry_points` (or equivalent): columns = `id` (text PK), `slug` (text UNIQUE), `type` (text: 'adventure'|'scenario'|'sandbox'|'quest'), `world_id` (text FK to worlds.id), `ruleset_id` (text FK), `title`, `subtitle`, `description`, `synopsis`, `status`, `visibility`, `content_rating`, `tags` (text[]), `content` (jsonb), `i18n` (jsonb), `search_text` (tsvector), `sort_weight`, `popularity_score`, `created_at`, `updated_at`.
  
  - segment tables: `prompt_segments` with columns = `id` (bigserial), `scope` (text: 'core'|'ruleset'|'world'|'entry'|'entry_start'|'npc'|...), `ref_id` (text, nullable), `version` (text), `active` (boolean), `content` (text), `metadata` (jsonb), `created_at`, `updated_at`.

- **Gaps** (Phase 1 will address):

  - `turns.turn_number` [exists? **YES** (code uses it)]. Code at `games.service.ts:440,467,539` and `games.ts:540,542` references `turn_number`. Migrations show `idx` instead. Need migration to add/rename column and ensure unique constraint.
  
  - Unique `(game_id, turn_number)` [exists? **PARTIAL**]. Migration shows `CREATE UNIQUE INDEX idx_turns_game_idx ON turns (game_id, idx)`, but code uses `turn_number`. Need migration to ensure unique constraint on `(game_id, turn_number)`.
  
  - Indexes `(game_id, turn_number asc/desc)` [exists? **NO**]. Migration only has unique index on `(game_id, idx)`. Need index on `(game_id, turn_number)` for pagination.

- **Existing migrations touching these tables**:

  - `db/migrations/20250130000000_core_schema.sql`: Creates `games`, `turns`, `entry_points`, `prompt_segments` tables. Turns table uses `idx` column, not `turn_number`.
  - `supabase/migrations/20250201_fix_games_world_id_fkey.sql`: Fixes `games.world_id` to be UUID and reference `world_id_mapping`.
  - `db/migrations/20250201_entry_rulesets.sql`: Adds `entry_point_rulesets` junction table.

## 7) Validators (Zod) & DTOs

| Purpose | File | Current Fields | Missing Fields | Action (reuse/extend) |
|---|---|---|---|---|
| Create Game body | `shared/src/types/api.ts:103` | `CreateGameRequestSchema`: adventureSlug (string), characterId (uuid, optional) | Needs: `entry_start_slug` (optional), `scenario_slug` (optional) | **Extend** - Add optional entry_start_slug and scenario_slug fields. |
| Turns list query | `backend/src/routes/games.ts:331` | None (no query params validated) | Needs: `afterTurn` (number, optional), `limit` (number, optional, default 20, max 100) | **Add** - Create `GetTurnsQuerySchema` with afterTurn and limit. |
| Game Turn request | `shared/src/types/api.ts:108` | `GameTurnRequestSchema`: optionId (uuid), userInput (string, optional), userInputType (enum, optional) | None | **Reuse** - Already handles turn requests. |
| Session Turn response | `shared/src/types/api.ts:172` | `SessionTurnSchema`: id, session_id, sequence, user_prompt, narrative_summary, is_initialization, created_at, turn_number | None | **Reuse** - Already includes turn_number. |

## 8) Observability / Debug Utilities

- **Logging modules**: 
  - `backend/src/services/debug.service.ts`: In-memory debug service that logs prompts, AI responses, and state changes. Stores last 50 entries per category. Provides `logPrompt()`, `logAiResponse()`, `logStateChanges()`, `getGameDebugData()`, `getTurnDebugData()`. Singleton pattern.
  
- **Any "debug prompt" routes**: 
  - `backend/src/routes/debug.ts`: Routes at `/api/debug/stats`, `/api/debug/game/:gameId`, `/api/debug/game/:gameId/turn/:turnIndex`, `/api/debug/prompts`, `/api/debug/responses`, `/api/debug/state-changes`, `/api/debug/clear`, `/api/debug/game-state/:gameId`. All return JSON with debug data from `debugService`.

- **Where `meta` (segment list, tokens) is recorded today**: 
  - In `DatabasePromptAssembler.assemblePrompt()` result: `metadata` includes `totalSegments`, `totalVariables`, `loadOrder`, `warnings`.
  - In `audit` object: `templateIds`, `version`, `hash`, `contextSummary`, `tokenCount`, `assembledAt`.
  - In `debugService.logPrompt()`: Stores full `result.audit` and `result.metadata` for each prompt.
  - In turn records: `prompt_metadata` field (jsonb) stores metadata in `games.service.ts:479`.
  - **Missing**: Explicit tracking of included/dropped segments due to budget. Need to add to metadata.

## 9) Legacy/Dead Code Candidates

| File/Dir | Why Legacy | Replace With | Delete in Phase |
|---|---|---|---|
| `backend/src/services/prompts.service.ts:buildPrompt()` | Uses DatabasePromptAssembler but may have unused legacy logic. | `DatabasePromptAssembler.assemblePrompt()` | Phase 4 (if unused) |
| `backend/src/services/prompts.service.ts:createInitialPromptWithApproval()` | Approval mechanism may be legacy. | Direct `DatabasePromptAssembler` assembly on game creation. | Phase 4 (if approval not needed) |
| `backend/src/services/turns.service.ts:buildPrompt()` (private) | Unused private method. | Remove. | Phase 4 |
| Any file-based prompt loading (if exists) | DB-only mode is enforced. | `DatabasePromptAssembler` uses only DB segments. | Already removed? |

## 10) Proposed Minimal-Diff Changes (by Phase)

- **Phase 1:** ✅ **COMPLETED** - Added `turn_number` migration (renames `idx` if exists, backfills, adds constraints/indexes); refactored `getGameTurns()` to support pagination with `afterTurn` and `limit`; added Zod schema validation; added unit and integration tests; added structured logging.

- **Phase 2:** ✅ **COMPLETED** - Refactored `DatabasePromptAssembler.assemblePrompt()` in-place with strict segment ordering (core → ruleset → world → scenario? → entry → npc); added budget policy with warn threshold (90%) and drop logic (scenario → npc, never core/ruleset/world); enhanced metadata tracking (included/dropped/policy/tokenEst); implemented NPC deduplication; added comprehensive unit tests with fixtures.

- **Phase 3:** ✅ **COMPLETED** - Created `GamesService.spawnV3()` that validates entry_point, world_id, entry_start_slug, ruleset, scenario; calls `DatabasePromptAssembler.assemblePromptV2()` to build intro prompt; inserts game and first turn (role='narrator', turn_number=1 via DB trigger) with complete metadata including included/dropped segments and pieces; updated `CreateGameRequestSchema` to require entry_point_id, world_id, entry_start_slug with optional scenario_slug, ruleset_slug, model; updated POST `/api/games` route to support Phase 3 format with backward compatibility.

- **Phase 4:** ✅ **COMPLETED** - Removed legacy prompt paths; added feature-flagged dev debug routes (`GET /api/dev/debug/prompt-assembly`, `GET /api/dev/debug/game/:gameId/turns`); implemented deprecation headers and telemetry; migrated ongoing turns to V2 assembler; added metrics counters.

- **Phase 4.1:** ✅ **COMPLETED** - Implemented deprecation bridge with feature flags (`LEGACY_PROMPTS_ENABLED=false` default); added deprecation headers and telemetry on legacy routes; compatibility adapter; code-level deprecation annotations; security/PII hardening on dev routes; rate limiting.

- **Phase 4.2:** ✅ **COMPLETED** - Migrated ongoing turns to V2 assembler; standardized error envelope and logging; removed deprecated methods; implemented metrics counters (`prompt_v2_used_total`, `legacy_prompt_used_total`).

- **Phase 5:** ✅ **COMPLETED** - Updated frontend to use V3 create-game API and turns pagination; surfaced prompt policy results in UI; added idempotent create requests and prod-safe test runs support.

- **Phase 5.1:** ✅ **COMPLETED** - Normalized turns API contract; added UX polish (loading/empty/error states); idempotency retry UX; accessibility improvements; dev toggle guards.

- **Phase 6:** ✅ **COMPLETED** - Playwright E2E tests wired; backend test helpers; k6 load scripts; Lighthouse + a11y smoke tests; observability checks.

- **Phase 6.1:** ✅ **COMPLETED** - Turns API normalization guard (defensive adapter with unit test); a11y announcements in TurnsList; k6 smoke defaults (configurable via env with error checks).

- **Phase 7:** ✅ **COMPLETED** - Created operational documentation (SLOs, dashboards, alerts, runbooks, security, config, deprecations); extended metrics service with histogram support; created release checklist and canary health script.

- **Phase 8:** ✅ **COMPLETED** - Added `POST /api/games/:id/send-turn` endpoint (V2 assembler, validation, rate limiting, idempotency); frontend composer with optimistic updates; Quickstart button; E2E test (`playable-loop.spec.ts`); structured logging (`turn.in`, `turn.out`).

## 11) Acceptance Criteria (Phases 1–4)

- Deterministic turn order via `turn_number` and unique `(game_id, turn_number)` constraint. ✅ `GET /api/games/:id/turns` returns turns ordered by `turn_number` ascending. ✅ Pagination with `afterTurn` and `limit` works correctly.

- Assembler always includes core/ruleset/world; budget drop order: scenario → npc; never drop core/ruleset/world. ✅ Metadata includes `includedSegments` and `droppedSegments` arrays. ✅ Token count tracked in audit.

- New game inserts first narrator/system turn with `turn_number=1`; meta includes included/dropped segments. ✅ **COMPLETED** - `POST /api/games` with Phase 3 format (entry_point_id, world_id, entry_start_slug) now creates game and inserts first turn with `turn_number=1` (via DB trigger), `role='narrator'`, complete assembler metadata (included/dropped/policy/tokenEst), and pieces array in deterministic order.

- `GET /api/games/:id/turns` pages by `afterTurn` and orders by `turn_number`. ✅ Query param `?afterTurn=5&limit=20` returns turns 6-25 ordered ascending.

## 12) Open Questions / Risks

- **Schema discrepancy**: ✅ **RESOLVED** - Phase 1 migration normalizes `turns.idx` to `turns.turn_number` with backfill and constraints.

- **Entry point vs scenario**: Current code uses `adventureSlug` which resolves to `entry_points`. Need to clarify if `scenario_slug` is a separate concept or part of entry_point. Check if scenarios are a subtype of entry_points or separate table.

- **Segment ordering**: RPC `prompt_segments_for_context` returns segments with `sort_order`. Need to verify this matches strict order requirement (core → ruleset → world → scenario? → entry → npc) or add post-processing.

- **Token budget enforcement**: Current code estimates tokens but doesn't enforce budget. Need to determine max token budget and implement dropping logic (scenario → npc, never core/ruleset/world).

- **First turn creation**: Should first turn be created automatically on game spawn, or only when first turn is executed? Current code creates it lazily on first turn execution. May want to change to create on spawn.

