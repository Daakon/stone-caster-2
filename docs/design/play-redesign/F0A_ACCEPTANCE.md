# F0a frozen play acceptance (local, 2026-09-28)

The active turn endpoint is `POST /api/games/:gameId/turn` in `active-game.controller.ts`. Its `GameTurnService` loads `chimera_game_states`, then `chimera_compiled_stories` by the session's `compiled_story_id`, then the immutable `chimera_content_blobs` row by `payload_blob_hash`. It also reads or writes `chimera_turns` and `ai_audit_logs`. `DirectorService`, `EngineService`, `Mas2Service`, and `StateService` make no source-content table queries. Turn instructions, actions, ruleset definitions, world, cast and lore come from the pinned compiled payload. A missing pin fails before any AI provider call.

The source lookup search found these **legacy assembler** hits. `entry-point-assembler-v3.ts` is called by `GamesService.spawn` and `TurnsService` (plus gated debug routes), not by the active Chimera turn endpoint. It still uses current data even when a prompt snapshot exists, and falls back to live prompts when the snapshot is absent. It must be retired or converted before either legacy path can be treated as frozen play.

| Location | Current source lookup |
| --- | --- |
| `entry-point-assembler-v3.ts:600` | `entry_points` |
| `entry-point-assembler-v3.ts:631` | `world_id_mapping` |
| `entry-point-assembler-v3.ts:643` | `worlds` |
| `entry-point-assembler-v3.ts:660` | `worlds_admin` |
| `entry-point-assembler-v3.ts:690`, `:703`, `:726` | `entry_point_rulesets` |
| `entry-point-assembler-v3.ts:744` | `rulesets` |
| `entry-point-assembler-v3.ts:790` | `entry_point_npcs` |
| `entry-point-assembler-v3.ts:803`, `:838` | `npcs` |
| `turns.service.ts:968`, `:1488` | `characters` during legacy state initialization and debug output |
| `turns.service.ts:1001`, `:1306` | `entry_points` during legacy state initialization and before invoking the assembler |

`/api/chimera/v3/game/:instanceId/turn` is a separate mounted route. Its service reads `chimera_instances_v3` and the instance's compiled-story ID via `CompiledStoriesRepository`; it has no current-source content lookup. `GamesService` and `TurnsService` are not mounted as the `/api/games/:gameId/turn` handler. The legacy assembler is still reachable from debug routes when those are enabled.

Local acceptance evidence:

- `npm run local:reset` applied both migrations, synced 142 source items, passed the F0a SQL acceptance checks, and reported a healthy local stack. The reset command calls `supabase db reset` without `--linked`; the checked local environment points only to loopback Supabase and Postgres ports.
- `frozen-play-slice.integration.test.ts` passed session → turn → source sync → recompile → original-session turn → new session. The original session retained its compiled ID, blob hash, interpreter/narrator prompts, and starting stamina. The new session used the new hash and stamina. The test restored the source item.
- The same integration test observed HTTP 410 from `/api/chimera/play/start`, HTTP 403 for an ordinary player creating a session, and HTTP 201 after that player was added to the local tester allowlist. The player and test sessions were cleaned up.
- `frozen-preconditions.test.ts` passed three zero-call AI checks: missing required starting value, foreign character, and missing session pin.
- `content-deployer-role.integration.test.ts` passed against the reset local database: the dedicated role could read its validation view and could not read game state; grants allowed only its content sync function.
- Backend and frontend production builds and `content:validate` passed. The latter reported 142 valid items and manifest hash `b049cfd9a41dbb7f13b120a2e61a974b28b8fdc7d4c5d09692b3d03203fdfb30`.

The pin migration raises if `chimera_game_states` contains rows without a `chimera_prelaunch_resets` marker. Session creation is checked in the init route and enforced again by the game-state insert trigger. The retired start endpoint has no frontend or e2e API caller; `/play/start/...` is a frontend page route and is distinct from `/api/chimera/play/start`.
