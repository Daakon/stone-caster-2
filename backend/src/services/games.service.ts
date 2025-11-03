import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode, GameDTO, GameListDTO } from '@shared';
import type { TurnResponse } from '@shared';
import { ContentService } from './content.service.js';
import { CharactersService } from './characters.service.js';
import { WalletService } from './wallet.service.js';
import { LedgerService } from './ledger.service.js';
import { configService } from './config.service.js';
import {
  resolveAdventureByIdentifier,
  computeAdventureId,
} from '../utils/adventure-identity.js';
import { PerformanceTimer } from '../utils/timing.js';
import { rulesetCache, npcListCache } from '../utils/cache.js';

export interface Game {
  id: string;
  entry_point_id: string; // TEXT reference to entry_points.id (legacy: was adventure_id)
  entry_point_type: string; // Denormalized type from entry_points.type ('adventure', 'scenario', 'sandbox', 'quest')
  character_id?: string;
  user_id?: string;
  cookie_group_id?: string;
  world_slug: string;
  state_snapshot: any;
  turn_count: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  created_at: string;
  updated_at: string;
  last_played_at: string;
}

export interface SpawnRequest {
  adventureSlug: string;
  characterId?: string;
  ownerId: string;
  isGuest: boolean;
}

export interface SpawnRequestV3 {
  entry_point_id: string;
  world_id: string; // UUID
  entry_start_slug: string;
  scenario_slug?: string | null;
  ruleset_slug?: string;
  model?: string;
  characterId?: string;
  ownerId: string;
  isGuest: boolean;
  idempotency_key?: string; // Optional idempotency key
  req?: any; // Optional request object for test transaction access
  includeAssemblerMetadata?: boolean; // Optional flag to include assembler metadata for debug
}

export interface SpawnResult {
  success: boolean;
  game?: GameDTO;
  error?: ApiErrorCode;
  message?: string;
  existingGameId?: string;
}

export interface SpawnResultV3 {
  success: boolean;
  game_id?: string;
  first_turn?: {
    turn_number: number;
    role: string;
    content: string;
    meta: any;
    created_at: string;
  };
  error?: ApiErrorCode;
  message?: string;
  code?: string;
  assemblerMetadata?: {
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
    meta: any;
  };
}

export class GamesService {
  /**
   * Spawn a new game for a character and adventure
   * @param request - Spawn request parameters
   * @returns Spawn result with success status and game data
   */
  async spawn(request: SpawnRequest): Promise<SpawnResult> {
    const { adventureSlug, characterId, ownerId, isGuest } = request;

    try {
      // Resolve adventure metadata from deterministic content mapping
      const adventure = await resolveAdventureByIdentifier(adventureSlug);

      if (!adventure) {
        return {
          success: false,
          error: ApiErrorCode.NOT_FOUND,
          message: 'Adventure not found',
        };
      }

      const adventureWorldId = adventure.worldId; // UUID
      
      // Fetch entry_point to get its type
      let entryPointType: string = 'adventure'; // default fallback
      if (adventure.id) {
        const { data: entryPoint } = await supabaseAdmin
          .from('entry_points')
          .select('type')
          .eq('id', adventure.id)
          .single();
        
        if (entryPoint?.type) {
          entryPointType = entryPoint.type;
        }
      }
      
      // Fetch primary ruleset from entry_point_rulesets junction table
      // Get the first one ordered by sort_order (primary ruleset)
      let rulesetId: string | undefined;
      if (adventure.id) {
        const { data: rulesets } = await supabaseAdmin
          .from('entry_point_rulesets')
          .select('ruleset_id')
          .eq('entry_point_id', adventure.id)
          .order('sort_order', { ascending: true })
          .limit(1);
        
        if (rulesets && rulesets.length > 0) {
          rulesetId = rulesets[0].ruleset_id;
        }
      }
      
      // If ruleset_id is still missing, we can't create the game
      if (!rulesetId) {
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: `Entry point '${adventure.id}' does not have any associated rulesets in entry_point_rulesets table`,
        };
      }
      
      // Resolve worldSlug from worldId (for games table)
      // First try to get from adventure, then from character, then resolve from world_id_mapping
      let worldSlug: string | undefined = adventure.worldSlug;
      
      // If character is specified, validate it exists and is available
      let character: any = null;
      if (characterId) {
        character = await CharactersService.getCharacterById(characterId, ownerId, isGuest);
        if (!character) {
          return {
            success: false,
            error: ApiErrorCode.NOT_FOUND,
            message: 'Character not found',
          };
        }

        // Check character is not already active in another game
        if (character.activeGameId) {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: 'Character is already active in another game',
            existingGameId: character.activeGameId,
          };
        }

        // Use character's worldSlug if adventure doesn't have it
        if (!worldSlug && character.worldSlug) {
          worldSlug = character.worldSlug;
        }

        // Check character and adventure are from the same world (UUID comparison)
        console.log('[WORLD_VALIDATION]', {
          character: {
            id: character.id,
            worldId: character.worldId,
            worldSlug: character.worldSlug,
          },
          adventure: {
            id: adventure.id,
            slug: adventure.slug,
            worldId: adventureWorldId,
            worldSlug: adventure.worldSlug,
          },
        });
        
        if (character.worldId !== adventureWorldId) {
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: `Character and adventure must be from the same world (char.worldId="${character.worldId}", adv.worldId="${adventureWorldId}")`,
          };
        }
      }
      
      // If still no worldSlug, resolve from world_id_mapping
      if (!worldSlug && adventureWorldId) {
        const { data: worldMapping } = await supabaseAdmin
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', adventureWorldId)
          .single();
        
        if (worldMapping) {
          worldSlug = worldMapping.text_id;
        }
      }
      
      // Fallback to 'unknown' if we still don't have it
      if (!worldSlug) {
        console.warn('[GAME_SPAWN] Could not resolve worldSlug for worldId:', adventureWorldId);
        worldSlug = 'unknown';
      }

      // For guest users, ensure they have a cookie group
      if (isGuest) {
        await this.ensureGuestCookieGroup(ownerId);
      }

      // Check for starter stones grant (if enabled and first spawn)
      await this.handleStarterStonesGrant(ownerId, isGuest);

      // Create new game
      const newGame = {
        entry_point_id: adventure.id, // entry_points.id is TEXT (e.g., 'test-entry-point-1')
        entry_point_type: entryPointType, // Denormalized type from entry_points.type
        world_id: adventureWorldId, // UUID reference to world_id_mapping.uuid_id
        ruleset_id: rulesetId, // Ruleset ID from entry_points.ruleset_id
        character_id: characterId || null,
        world_slug: worldSlug, // TEXT slug for display/filtering (denormalized)
        state_snapshot: {
          metadata: {
            adventureSlug: adventure.slug,
            adventureTitle: adventure.title,
            adventureId: adventure.id,
          },
        },
        turn_count: 0,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_played_at: new Date().toISOString(),
        // Set owner based on user type
        ...(isGuest ? { cookie_group_id: ownerId } : { user_id: ownerId })
      };

      const { data: createdGame, error: createError } = await supabaseAdmin
        .from('games')
        .insert(newGame)
        .select('*')
        .single();

      if (createError) {
        console.error('Error creating game:', createError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to create game',
        };
      }

      // Update character to mark it as active in this game
      if (characterId) {
        const { error: updateError } = await supabaseAdmin
          .from('characters')
          .update({
            active_game_id: createdGame.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', characterId);

        if (updateError) {
          console.error('Error updating character active game:', updateError);
          // Don't fail the spawn, just log the error
        }
      }

      // Convert to DTO
      const gameDTO = await this.mapGameToDTO(createdGame);

      return {
        success: true,
        game: gameDTO,
      };
    } catch (error) {
      console.error('Unexpected error in spawn:', error);
      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      };
    }
  }

  /**
   * Phase 3: Spawn a new game with prompt assembly and first turn
   * @param request - Phase 3 spawn request parameters
   * @returns Spawn result with game_id and first_turn
   */
  async spawnV3(request: SpawnRequestV3): Promise<SpawnResultV3> {
    const timer = new PerformanceTimer();
    timer.start('totalMs');
    
    const {
      entry_point_id,
      world_id,
      entry_start_slug,
      scenario_slug,
      ruleset_slug,
      model,
      characterId,
      ownerId,
      isGuest,
      idempotency_key,
    } = request;

    try {
      // Check idempotency if key provided (game-scope: key + operation only, no game_id yet)
      // In test mode, use transaction client; otherwise use Supabase
      const { getTestTxClient } = await import('../middleware/testTx.js');
      const txClient = request.req ? getTestTxClient(request.req) : null;
      
      if (idempotency_key) {
        let existingIdempotency: any = null;
        
        if (txClient) {
          // Test mode: query within transaction
          const result = await txClient.query(
            'SELECT response_data FROM idempotency_keys WHERE key = $1 AND operation = $2 AND game_id IS NULL AND status = $3',
            [idempotency_key, 'game_spawn', 'completed']
          );
          existingIdempotency = result.rows[0] || null;
        } else {
          // Production: use Supabase
          const { data } = await supabaseAdmin
            .from('idempotency_keys')
            .select('response_data')
            .eq('key', idempotency_key)
            .eq('operation', 'game_spawn')
            .is('game_id', null)
            .eq('status', 'completed')
            .single();
          existingIdempotency = data;
        }

        if (existingIdempotency?.response_data) {
          // Return cached response (idempotent - same request returns same result)
          const cachedResult: SpawnResultV3 = {
            success: true,
            game_id: existingIdempotency.response_data.game_id,
            first_turn: existingIdempotency.response_data.first_turn,
          };
          // Note: cached responses don't include assembler metadata
          return cachedResult;
        }
      }

      // 1. Validate entry point
      const { data: entryPoint, error: entryPointError } = await supabaseAdmin
        .from('entry_points')
        .select('id, slug, type, world_id')
        .eq('id', entry_point_id)
        .eq('lifecycle', 'active')
        .single();

      if (entryPointError || !entryPoint) {
        return {
          success: false,
          error: ApiErrorCode.NOT_FOUND,
          message: `Entry point '${entry_point_id}' not found or inactive`,
          code: 'ENTRY_START_NOT_FOUND', // Using standardized code
        };
      }

      // Validate world_id matches entry point's world_id
      // Note: entry_points.world_id is text, but we're comparing with UUID
      // We need to resolve the entry point's world_id to UUID for comparison
      let entryPointWorldId: string | null = null;
      if (entryPoint.world_id) {
        // entry_points.world_id might be text or UUID depending on schema
        // Check if it's a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(entryPoint.world_id)) {
          entryPointWorldId = entryPoint.world_id;
        } else {
          // It's a text slug, resolve to UUID
          const { data: worldMapping } = await supabaseAdmin
            .from('world_id_mapping')
            .select('uuid_id')
            .eq('text_id', entryPoint.world_id)
            .single();
          entryPointWorldId = worldMapping?.uuid_id || null;
        }
      }

      if (entryPointWorldId && entryPointWorldId !== world_id) {
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: `Entry point world_id mismatch. Expected ${entryPointWorldId}, got ${world_id}`,
          code: 'WORLD_ID_MISMATCH',
        };
      }

      // 2. Resolve ruleset (from entry_point_rulesets or use provided/default)
      timer.start('resolveContextMs');
      
      let rulesetId: string | undefined = ruleset_slug;
      let resolvedRulesetSlug: string = ruleset_slug || 'default';

      if (!ruleset_slug) {
        // Check cache first
        const cacheKey = `ruleset:${entry_point_id}`;
        const cachedSlug = rulesetCache.get(cacheKey);
        
        if (cachedSlug) {
          resolvedRulesetSlug = cachedSlug;
          // Still need to resolve rulesetId from slug
          const { data: ruleset } = await supabaseAdmin
            .from('rulesets')
            .select('id, slug')
            .eq('slug', cachedSlug)
            .eq('status', 'active')
            .limit(1)
            .single();
          if (ruleset) {
            rulesetId = ruleset.id;
          }
        } else {
          // Fetch primary ruleset from entry_point_rulesets junction table
          const { data: rulesets } = await supabaseAdmin
            .from('entry_point_rulesets')
            .select('rulesets:ruleset_id (id, slug)')
            .eq('entry_point_id', entry_point_id)
            .order('sort_order', { ascending: true })
            .limit(1);

          if (rulesets && rulesets.length > 0) {
            const primaryRuleset = (rulesets[0] as any).rulesets;
            if (primaryRuleset) {
              rulesetId = primaryRuleset.id;
              resolvedRulesetSlug = primaryRuleset.slug || primaryRuleset.id || 'default';
              rulesetCache.set(cacheKey, resolvedRulesetSlug);
            }
          }

          // If still no ruleset, try to find a default ruleset by slug
          if (!rulesetId) {
            const { data: defaultRuleset } = await supabaseAdmin
              .from('rulesets')
              .select('id, slug')
              .eq('slug', 'default')
              .eq('status', 'active')
              .limit(1)
              .single();
            if (defaultRuleset) {
              rulesetId = defaultRuleset.id;
              resolvedRulesetSlug = defaultRuleset.slug || 'default';
              rulesetCache.set(cacheKey, resolvedRulesetSlug);
            }
          }
        }
      } else {
        // Validate provided ruleset_slug exists
        const { data: ruleset } = await supabaseAdmin
          .from('rulesets')
          .select('id, slug')
          .or(`id.eq.${ruleset_slug},slug.eq.${ruleset_slug}`)
          .eq('status', 'active')
          .limit(1)
          .single();

        if (!ruleset) {
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: `Ruleset '${ruleset_slug}' not found or inactive`,
            code: 'RULESET_NOT_FOUND',
          };
        }
        rulesetId = ruleset.id;
        resolvedRulesetSlug = ruleset.slug || ruleset.id;
      }

      if (!rulesetId) {
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: `No ruleset found for entry point '${entry_point_id}'`,
          code: 'RULESET_NOT_FOUND',
        };
      }

      // 3. Validate entry point exists and is active (entry_start_slug validation done by v3 assembler)
      // Note: scenario_slug is no longer used in v3 (removed from scope order)

      // 4. Validate character if provided
      let character: any = null;
      if (characterId) {
        character = await CharactersService.getCharacterById(characterId, ownerId, isGuest);
        if (!character) {
          return {
            success: false,
            error: ApiErrorCode.NOT_FOUND,
            message: 'Character not found',
            code: 'CHARACTER_NOT_FOUND',
          };
        }

        // Check character is not already active
        if (character.activeGameId) {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: 'Character is already active in another game',
            code: 'CHARACTER_ALREADY_ACTIVE',
          };
        }

        // Validate character world matches
        if (character.worldId !== world_id) {
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: `Character and entry point must be from the same world`,
            code: 'WORLD_MISMATCH',
          };
        }
      }

      // 6. Resolve worldSlug from worldId
      const { data: worldMapping } = await supabaseAdmin
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', world_id)
        .single();

      if (!worldMapping) {
        return {
          success: false,
          error: ApiErrorCode.VALIDATION_FAILED,
          message: `World UUID '${world_id}' not found in world_id_mapping`,
          code: 'WORLD_NOT_FOUND',
        };
      }

      const worldSlug = worldMapping.text_id;

      // 7. For guest users, ensure they have a cookie group
      if (isGuest) {
        await this.ensureGuestCookieGroup(ownerId);
      }

      // 8. Check for starter stones grant
      await this.handleStarterStonesGrant(ownerId, isGuest);

      timer.end('resolveContextMs');
      
      // 9. Assemble prompt using v3 entry-point assembler
      timer.start('assemblerMs');
      
      const { EntryPointAssemblerV3, EntryPointAssemblerError } = await import('../prompts/entry-point-assembler-v3.js');
      const { config: appConfig } = await import('../config/index.js');
      const { MetricsService } = await import('./metrics.service.js');

      const assembler = new EntryPointAssemblerV3();

      // Use config for model and budget
      const budgetTokens = appConfig.prompt.tokenBudgetDefault;

      let assembleResult;
      try {
        assembleResult = await assembler.assemble({
          entryPointId: entry_point_id,
          entryStartSlug: entry_start_slug,
          model: model || appConfig.prompt.modelDefault,
          budgetTokens,
        });
      } catch (error) {
        if (error instanceof EntryPointAssemblerError) {
          // Map assembler errors to API error codes
          let apiCode = ApiErrorCode.VALIDATION_FAILED;
          if (error.code === 'ENTRY_POINT_NOT_FOUND') {
            apiCode = ApiErrorCode.NOT_FOUND;
          } else if (error.code === 'WORLD_NOT_ACTIVE') {
            apiCode = ApiErrorCode.VALIDATION_FAILED;
          } else if (error.code === 'RULESET_NOT_ALLOWED') {
            apiCode = ApiErrorCode.VALIDATION_FAILED;
          }
          
          return {
            success: false,
            error: apiCode,
            message: error.message,
            code: error.code,
          };
        }
        throw error; // Re-throw unexpected errors
      }
      
      timer.end('assemblerMs');

      // Increment v3 usage metric for game creation
      MetricsService.increment('prompt_v3_used_total', {
        phase: 'start',
        policy: (assembleResult.meta.policy || []).join(','),
      });

      // 10. Atomic transaction: insert game and first turn via stored procedure
      timer.start('persistMs');
      // Using stored procedure ensures true atomicity with automatic rollback on error
      // In test mode, execute via transaction client to ensure rollback
      // Reuse txClient already declared at line 313 (don't redeclare)
      let transactionResult: any;
      let transactionError: any;
      
      if (txClient) {
        // Test mode: execute stored procedure via transaction client
        // Set statement timeout to prevent stuck procedures from pinning the transaction
        try {
          await txClient.query('SET LOCAL statement_timeout = 10000'); // 10s timeout
          
          const result = await txClient.query(
            `SELECT * FROM spawn_game_v3_atomic(
              $1::text, $2::text, $3::uuid, $4::text, $5::uuid,
              $6::text, $7::jsonb, $8::uuid, $9::uuid,
              $10::text, $11::text, $12::jsonb
            )`,
            [
              entry_point_id,
              entryPoint.type,
              world_id,
              rulesetId,
              characterId || null,
              worldSlug,
              JSON.stringify({
                metadata: {
                  entryPointId: entry_point_id,
                  entryPointSlug: entryPoint.slug,
                  entryStartSlug: entry_start_slug,
                  scenarioSlug: scenario_slug || null,
                  rulesetSlug: resolvedRulesetSlug,
                },
              }),
              isGuest ? null : ownerId,
              isGuest ? ownerId : null,
              'narrator',
              assembleResult.prompt,
              JSON.stringify({
                ...assembleResult.meta,
                pieces: assembleResult.pieces,
              }),
            ]
          );
          
          transactionResult = result.rows[0];
          transactionError = null;
        } catch (err: any) {
          transactionError = err;
          transactionResult = null;
        }
      } else {
        // Production mode: use Supabase RPC
        const rpcResult = await supabaseAdmin.rpc(
          'spawn_game_v3_atomic',
          {
            p_entry_point_id: entry_point_id,
            p_entry_point_type: entryPoint.type,
            p_world_id: world_id,
            p_ruleset_id: rulesetId,
            p_character_id: characterId || null,
            p_world_slug: worldSlug,
            p_state_snapshot: {
              metadata: {
                entryPointId: entry_point_id,
                entryPointSlug: entryPoint.slug,
                entryStartSlug: entry_start_slug,
                scenarioSlug: scenario_slug || null,
                rulesetSlug: resolvedRulesetSlug,
              },
            },
            p_user_id: isGuest ? null : ownerId,
            p_cookie_group_id: isGuest ? ownerId : null,
            p_turn_role: 'narrator',
            p_turn_content: assembleResult.prompt,
            p_turn_meta: {
              ...assembleResult.meta,
              pieces: assembleResult.pieces,
              version: 'v3',
              source: 'entry-point',
            },
          }
        );
        
        // Extract result from RPC response
        transactionResult = rpcResult.data || null;
        transactionError = rpcResult.error || null;
      }

      if (transactionError) {
        console.error('[SPAWN_V3] Transaction error:', transactionError);
        
        // Map transaction error codes
        if (transactionError.code === '23505' || transactionResult?.error_code === 'DB_CONFLICT') {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: transactionResult?.error_message || 'Game creation conflict (unique constraint violation)',
            code: 'DB_CONFLICT',
          };
        }

        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: transactionResult?.error_message || transactionError.message || 'Failed to create game',
          code: transactionResult?.error_code || 'INTERNAL_ERROR',
        };
      }

      // Check for errors from stored procedure
      if (transactionResult?.error_code) {
        // Handle FK violations
        if (transactionResult.error_code === 'FK_VIOLATION') {
          return {
            success: false,
            error: ApiErrorCode.VALIDATION_FAILED,
            message: transactionResult.error_message || 'Foreign key violation',
            code: 'WORLD_NOT_FOUND', // Or other FK-related codes
          };
        }

        // Map DB_CONFLICT to CONFLICT HTTP status
        if (transactionResult.error_code === 'DB_CONFLICT') {
          return {
            success: false,
            error: ApiErrorCode.CONFLICT,
            message: transactionResult.error_message || 'Database conflict',
            code: 'DB_CONFLICT',
          };
        }

        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: transactionResult.error_message || 'Failed to create game',
          code: transactionResult.error_code,
        };
      }

      timer.end('persistMs');
      
      // Success: extract results
      const createdGameId = transactionResult?.game_id;
      const createdTurnNumber = transactionResult?.turn_number || 1;

      if (!createdGameId) {
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Game was not created',
          code: 'GAME_CREATE_ERROR',
        };
      }

      // Fetch the created turn to get full metadata
      // In test mode, use transaction client; otherwise use Supabase
      let createdTurn: any;
      let fetchTurnError: any = null;
      
      if (txClient) {
        // Test mode: query within transaction
        try {
          const result = await txClient.query(
            'SELECT turn_number, role, content, meta, created_at FROM turns WHERE game_id = $1 AND turn_number = $2',
            [createdGameId, createdTurnNumber]
          );
          createdTurn = result.rows[0] || null;
        } catch (err: any) {
          fetchTurnError = err;
          createdTurn = null;
        }
      } else {
        // Production: use Supabase
        const { data, error } = await supabaseAdmin
          .from('turns')
          .select('turn_number, role, content, meta, created_at')
          .eq('game_id', createdGameId)
          .eq('turn_number', createdTurnNumber)
          .single();
        createdTurn = data;
        fetchTurnError = error;
      }

      if (fetchTurnError || !createdTurn) {
        // This should not happen, but handle gracefully
        console.error('[SPAWN_V3] Error fetching created turn:', fetchTurnError);
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Game created but failed to fetch turn details',
          code: 'TURN_FETCH_ERROR',
        };
      }

      // 11. Update character to mark it as active
      if (characterId) {
        const { error: updateError } = await supabaseAdmin
          .from('characters')
          .update({
            active_game_id: createdGameId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', characterId);

        if (updateError) {
          console.error('[SPAWN_V3] Error updating character active game:', updateError);
          // Don't fail the spawn, just log the error
        }
      }

      // 12. Store idempotency record if key provided
      const responseData = {
        game_id: createdGameId,
        first_turn: {
          turn_number: createdTurn.turn_number || 1,
          role: createdTurn.role,
          content: createdTurn.content,
          meta: createdTurn.meta,
          created_at: createdTurn.created_at,
        },
      };

      if (idempotency_key) {
        const { IdempotencyService } = await import('./idempotency.service.js');
        const requestHash = IdempotencyService.createRequestHash({
          entry_point_id,
          world_id,
          entry_start_slug,
          scenario_slug,
          ruleset_slug,
          model,
          characterId,
        });

        try {
          // In test mode, use transaction client for idempotency write
          // Winner-takes-all: if duplicate key exists in production, return cached result
          if (txClient) {
            // Check production (outside transaction) for existing key
            const prodCheck = await supabaseAdmin
              .from('idempotency_keys')
              .select('response_data')
              .eq('key', idempotency_key)
              .eq('operation', 'game_spawn')
              .is('game_id', null)
              .eq('status', 'completed')
              .single();
            
            if (prodCheck.data?.response_data) {
              // Winner-takes-all: return cached production result (do not write new row)
              return {
                success: true,
                game_id: prodCheck.data.response_data.game_id,
                first_turn: prodCheck.data.response_data.first_turn,
              };
            }
            
            // No production record; write within test transaction (will rollback)
            await txClient.query(
              `INSERT INTO idempotency_keys (key, owner_id, game_id, operation, request_hash, response_data, status, completed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                idempotency_key,
                ownerId,
                createdGameId,
                'game_spawn',
                requestHash,
                JSON.stringify(responseData),
                'completed',
                new Date().toISOString(),
              ]
            );
          } else {
            // Production: use Supabase client
            await supabaseAdmin
              .from('idempotency_keys')
              .insert({
                key: idempotency_key,
                owner_id: ownerId,
                game_id: createdGameId,
                operation: 'game_spawn',
                request_hash: requestHash,
                response_data: responseData,
                status: 'completed',
                completed_at: new Date().toISOString(),
              });
          }
        } catch (idempotencyError: any) {
          // If idempotency insert fails, log but don't fail (operation succeeded)
          console.warn('[SPAWN_V3] Failed to store idempotency record:', idempotencyError);
        }
      }

      // 13. Structured logging
      const { isTestTxActive } = await import('../middleware/testTx.js');
      const testTxActive = request.req ? isTestTxActive(request.req) : false;
      
      console.log('[SPAWN_V3]', {
        event: 'game.spawned',
        gameId: createdGameId,
        worldId: world_id,
        rulesetSlug: resolvedRulesetSlug,
        scenarioSlug: scenario_slug || null,
        entryStartSlug: entry_start_slug,
        firstTurn: createdTurn.turn_number || 1,
        tokenPct: assembleResult.meta.tokenEst.pct,
        policy: assembleResult.meta.policy || [],
        idempotent: !!idempotency_key,
        testTx: testTxActive,
      });

      const result: SpawnResultV3 = {
        success: true,
        game_id: createdGameId,
        first_turn: {
          turn_number: createdTurn.turn_number || 1,
          role: createdTurn.role,
          content: createdTurn.content,
          meta: createdTurn.meta,
          created_at: createdTurn.created_at,
        },
      };

      timer.end('totalMs');
      
      const timings = {
        resolveContextMs: timer.getDuration('resolveContextMs') || 0,
        assemblerMs: timer.getDuration('assemblerMs') || 0,
        aiMs: 0, // Not tracked in spawn (no AI call)
        persistMs: timer.getDuration('persistMs') || 0,
        totalMs: timer.getDuration('totalMs') || 0,
      };
      
      // Record metrics
      const { metricsCollector, checkSLOViolations } = await import('../utils/metrics.js');
      const totalMs = timings.totalMs;
      metricsCollector.recordHistogram('v3_spawn_ms', totalMs);
      metricsCollector.recordHistogram('v3_assembler_ms', timings.assemblerMs);
      
      // Check SLO violations
      const spawnPercentiles = metricsCollector.getHistogramPercentiles('v3_spawn_ms');
      if (spawnPercentiles) {
        checkSLOViolations('v3_spawn_ms', spawnPercentiles.p95, appConfig.slo.spawnP95Ms);
      }
      
      // Include assembler metadata if requested (for debug)
      if (request.includeAssemblerMetadata) {
        result.assemblerMetadata = {
          prompt: assembleResult.prompt,
          pieces: assembleResult.pieces,
          meta: {
            ...assembleResult.meta,
            timings,
          },
        };
      }

      // Write prompt trace (if enabled and user is admin)
      if (ownerId && result.assemblerMetadata) {
        try {
          const { supabaseAdmin } = await import('./supabase.js');
          const { data: profile } = await supabaseAdmin
            .from('user_profiles')
            .select('role')
            .eq('auth_user_id', ownerId)
            .single();
          
          const userRole = profile?.role || null;
          
          if (userRole === 'admin') {
            const { writePromptTrace } = await import('./prompt-trace.service.js');
            // Get turn ID from turns table
            const { data: turnData } = await supabaseAdmin
              .from('turns')
              .select('id')
              .eq('game_id', result.game_id)
              .eq('turn_number', result.first_turn?.turn_number || 1)
              .single();
            
            const turnId = turnData?.id || result.game_id;
            await writePromptTrace({
              gameId: result.game_id!,
              turnId: turnId || result.game_id!,
              turnNumber: result.first_turn?.turn_number || 1,
              phase: 'start',
              assembler: result.assemblerMetadata,
              timings: {
                assembleMs: undefined, // Not tracked in spawnV3 currently
                aiMs: undefined,
                totalMs: undefined,
              },
            });
          }
        } catch (error) {
          // Fail silently - tracing must not break spawn
          console.error('[GAMES_SERVICE] Failed to write prompt trace:', error);
        }
      }

      return result;
    } catch (error: any) {
      console.error('[SPAWN_V3] Unexpected error:', error);
      
      // Check for EntryPointAssemblerError (v3 assembler)
      const { EntryPointAssemblerError } = await import('../prompts/entry-point-assembler-v3.js');
      if (error instanceof EntryPointAssemblerError) {
        return {
          success: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: error.message,
          code: 'PROMPT_ASSEMBLY_ERROR',
        };
      }

      return {
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get a single game by ID with proper ownership validation
   * @param gameId - Game ID
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   * @returns Game DTO or null if not found
   */
  async getGameById(
    gameId: string,
    ownerId: string,
    isGuest: boolean,
    guestCookieId?: string
  ): Promise<GameDTO | null> {
    try {
      // First, fetch the game to check ownership
      // Handle legacy games where both owner_user_id and cookie_group_id are null
      let query = supabaseAdmin
        .from('games')
        .select(`
          *,
          characters:characters!games_character_id_fkey(id, name, world_data, level, current_health, max_health, race, class)
        `)
        .eq('id', gameId);

      const { data: gameData, error: fetchError } = await query.single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // Game doesn't exist
          console.warn('[GAMES_SERVICE] Game not found:', { gameId, errorCode: fetchError.code });
          return null;
        }
        console.error('[GAMES_SERVICE] Error fetching game:', { gameId, error: fetchError.message });
        return null;
      }

      // Check ownership - allow access if:
      // 1. Ownership matches (user_id or cookie_group_id)
      // 2. Both ownership fields are null (legacy game - allow access with warning)
      const hasUserId = gameData.user_id !== null && gameData.user_id !== undefined;
      const hasCookieGroupId = gameData.cookie_group_id !== null && gameData.cookie_group_id !== undefined;
      const isLegacyGame = !hasUserId && !hasCookieGroupId;

      if (isLegacyGame) {
        // Legacy game with no ownership - allow access but log warning
        console.warn('[GAMES_SERVICE] Accessing legacy game with null ownership:', {
          gameId,
          requestingOwnerId: ownerId,
          requestingIsGuest: isGuest,
          note: 'Legacy game access allowed',
        });
        return await this.mapGameToDTO(gameData);
      }

      // Check ownership for non-legacy games
      let ownershipMatches = false;
      if (isGuest) {
        // Guest: check cookie_group_id matches
        // Also allow if game has user_id but no cookie_group_id (legacy authenticated game)
        // This handles games created before cookie_group tracking was added
        ownershipMatches = gameData.cookie_group_id === ownerId ||
                          (!gameData.cookie_group_id && !!gameData.user_id);
        
        if (!gameData.cookie_group_id && !!gameData.user_id) {
          console.warn('[GAMES_SERVICE] Allowing guest access to authenticated game (legacy):', {
            gameId,
            gameUserId: gameData.user_id,
            guestCookieId: ownerId,
            note: 'Game created before cookie_group tracking',
          });
        }
      } else {
        // Authenticated user: check user_id or cookie_group_id (for linked accounts)
        ownershipMatches = gameData.user_id === ownerId || 
                          (guestCookieId && gameData.cookie_group_id === guestCookieId) ||
                          gameData.cookie_group_id === ownerId;
      }

      if (!ownershipMatches) {
        console.warn('[GAMES_SERVICE] Ownership mismatch:', {
          gameId,
          dbUserId: gameData.user_id,
          dbCookieGroupId: gameData.cookie_group_id,
          requestingOwnerId: ownerId,
          requestingGuestCookieId: guestCookieId,
          requestingIsGuest: isGuest,
        });
        return null;
      }

      // Ownership verified - return the game
      return await this.mapGameToDTO(gameData);
    } catch (error) {
      console.error('Unexpected error in getGameById:', error);
      return null;
    }
  }

  /**
   * Get games list for a user
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   * @param limit - Maximum number of games to return
   * @param offset - Number of games to skip
   * @returns Array of GameListDTO
   */
  async getGames(
    ownerId: string,
    isGuest: boolean,
    limit: number = 20,
    offset: number = 0,
    guestCookieId?: string
  ): Promise<GameListDTO[]> {
    try {
      let query = supabaseAdmin
        .from('games')
        .select(`
          id,
          turn_count,
          status,
          last_played_at,
          world_slug,
          state_snapshot,
          characters:characters!games_character_id_fkey(name)
        `)
        .order('last_played_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by owner - for linked users, check both user_id and cookie_group_id
      if (isGuest) {
        query = query.eq('cookie_group_id', ownerId);
      } else if (guestCookieId && guestCookieId !== ownerId) {
        query = query.or(`user_id.eq.${ownerId},cookie_group_id.eq.${guestCookieId}`);
      } else {
        query = query.or(`user_id.eq.${ownerId},cookie_group_id.eq.${ownerId}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching games:', error);
        return [];
      }

      const rows = data ?? [];
      const mapped = await Promise.all(
        rows.map((row: any) => this.mapGameToListDTO(row))
      );
      return mapped;
    } catch (error) {
      console.error('Unexpected error in getGames:', error);
      return [];
    }
  }

  /**
   * Load a game by ID (internal method)
   * @param gameId - Game ID
   * @returns Game object or null if not found
   */
  async loadGame(gameId: string): Promise<Game | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        console.error('Error loading game:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error in loadGame:', error);
      return null;
    }
  }

  /**
   * Check if a string is a valid UUID
   * @param str - String to check
   * @returns True if valid UUID
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Apply a turn result to a game
   * @param gameId - Game ID
   * @param turnResult - Turn result from AI
   * @param optionId - Selected option ID
   * @param turnData - Comprehensive turn data for recording
   * @returns Turn record with ID and metadata
   */
  async applyTurn(
    gameId: string, 
    turnResult: TurnResponse, 
    optionId: string, 
    turnData?: {
      userInput?: string;
      userInputType?: 'choice' | 'text' | 'action';
      promptData?: any;
      promptMetadata?: any;
      aiResponseMetadata?: any;
      processingTimeMs?: number;
    }
  ): Promise<any> {
    try {
      // Load current game state
      const currentGame = await this.loadGame(gameId);
      if (!currentGame) {
        throw new Error('Game not found for turn application');
      }

      // Check if a turn already exists for this game and turn number
      const nextTurnNumber = currentGame.turn_count + 1;
      const { data: existingTurn } = await supabaseAdmin
        .from('turns')
        .select('*')
        .eq('game_id', gameId)
        .eq('turn_number', nextTurnNumber)
        .single();

      if (existingTurn) {
        console.log(`[GAMES_SERVICE] Turn ${nextTurnNumber} already exists for game ${gameId}, returning existing turn`);
        return existingTurn;
      }

      // Create turn record
      // Generate a UUID for option_id if it's not already a valid UUID
      let optionIdUuid = optionId;
      if (optionId && !this.isValidUuid(optionId)) {
        // For non-UUID optionIds like "game_start", generate a UUID
        optionIdUuid = crypto.randomUUID();
        console.log(`[GAMES_SERVICE] Generated UUID for optionId "${optionId}": ${optionIdUuid}`);
      }
      
      // Determine if this is an initialization turn
      const isInitialization = nextTurnNumber === 1;
      
      // Extract narrative summary from turn result
      const narrativeSummary = turnResult.narrative || 'Narrative not available';
      
      // Phase 4.2: Extract V2 assembler metadata if present
      const promptMeta = turnData?.promptMetadata;
      const v2Meta = promptMeta?.meta || null;
      const v2Pieces = promptMeta?.pieces || null;

      // Build turn record - use 'content' column (jsonb) for AI response data
      // The turns table uses 'content' (jsonb) not 'ai_response'
      const turnRecord: any = {
        game_id: gameId,
        turn_number: nextTurnNumber,
        role: 'narrator', // AI-generated turn
        content: turnResult, // Store the full turn result in content (jsonb)
        meta: v2Meta ? {
          included: v2Meta.included || [],
          dropped: v2Meta.dropped || [],
          policy: v2Meta.policy || [],
          tokenEst: v2Meta.tokenEst || {},
          model: v2Meta.model,
          worldId: v2Meta.worldId,
          rulesetSlug: v2Meta.rulesetSlug,
          scenarioSlug: v2Meta.scenarioSlug,
          entryStartSlug: v2Meta.entryStartSlug,
          pieces: v2Pieces || [],
          // Store additional metadata for backward compatibility
          userInput: turnData?.userInput || null,
          userInputType: turnData?.userInputType || 'choice',
          promptData: turnData?.promptData || null,
          promptMetadata: turnData?.promptMetadata || null,
          aiResponseMetadata: turnData?.aiResponseMetadata || null,
          processingTimeMs: turnData?.processingTimeMs || null,
          narrativeSummary: narrativeSummary,
          isInitialization: isInitialization,
        } : {
          // Minimal meta if no v2Meta
          userInput: turnData?.userInput || null,
          userInputType: turnData?.userInputType || 'choice',
          narrativeSummary: narrativeSummary,
          isInitialization: isInitialization,
        },
        created_at: new Date().toISOString(),
      };

      // Add optional fields if they exist as separate columns (check via Supabase schema)
      // These may not exist in all environments, so we'll only include if we can safely verify
      // For now, store everything in meta to be safe

      const { data: createdTurn, error: turnError } = await supabaseAdmin
        .from('turns')
        .insert(turnRecord)
        .select('*')
        .single();

      if (turnError) {
        console.error('Error creating turn record:', turnError);
        throw new Error(`Failed to create turn record: ${turnError.message}`);
      }

      // Only update game state if we created a new turn
      const newState = {
        ...currentGame.state_snapshot,
        ...turnResult.worldStateChanges,
      };

      const newTurnIndex = currentGame.turn_count + 1;
      const serverSummary = this.generateServerSummary(turnResult);

      const { error: updateError } = await supabaseAdmin
        .from('games')
        .update({
          state_snapshot: newState,
          turn_count: newTurnIndex,
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      if (updateError) {
        console.error('Error updating game state:', updateError);
        throw new Error(`Failed to update game state: ${updateError.message}`);
      }

      return createdTurn;
    } catch (error) {
      console.error('Unexpected error in applyTurn:', error);
      throw error;
    }
  }

  /**
   * Get turns for a game with pagination
   * @param gameId - Game ID
   * @param options - Pagination options
   * @returns Paginated turn records with cursor
   */
  async getGameTurns(
    gameId: string,
    options?: {
      afterTurn?: number;
      limit?: number;
    }
  ): Promise<{
    turns: any[];
    next?: { afterTurn: number };
  }> {
    try {
      const limit = options?.limit ?? 20;
      const afterTurn = options?.afterTurn;

      let query = supabaseAdmin
        .from('turns')
        .select('*')
        .eq('game_id', gameId)
        .order('turn_number', { ascending: true })
        .limit(limit + 1); // Fetch one extra to determine if there's a next page

      // Add cursor filter if provided
      if (afterTurn !== undefined && afterTurn > 0) {
        query = query.gt('turn_number', afterTurn);
      }

      const { data: turns, error } = await query;

      if (error) {
        console.error('Error loading game turns:', error);
        throw new Error(`Failed to load game turns: ${error.message}`);
      }

      const allTurns = turns || [];
      
      // Check if there's a next page
      const hasMore = allTurns.length > limit;
      const turnsToReturn = hasMore ? allTurns.slice(0, limit) : allTurns;
      
      // Build response with cursor
      const lastTurnNumber = turnsToReturn.length > 0
        ? turnsToReturn[turnsToReturn.length - 1].turn_number
        : undefined;

      const result: {
        turns: any[];
        next?: { afterTurn: number };
      } = {
        turns: turnsToReturn,
      };

      // Only include next cursor if there are more turns
      if (hasMore && lastTurnNumber !== undefined) {
        result.next = { afterTurn: lastTurnNumber };
      }

      // Log pagination details
      console.log('[GAMES_SERVICE] getGameTurns pagination:', {
        gameId,
        afterTurn: afterTurn ?? null,
        limit,
        returned: turnsToReturn.length,
        lastTurn: lastTurnNumber ?? null,
        hasMore,
      });

      return result;
    } catch (error) {
      console.error('Unexpected error in getGameTurns:', error);
      throw error;
    }
  }

  /**
   * Fetch turns for a game session including initialize narrative
   * @param gameId - Game ID
   * @returns Array of turns with narrative data
   */
  async getSessionTurns(gameId: string): Promise<any[]> {
    try {
      // Select turns with content (jsonb) - the turns table uses 'content' not 'ai_response'
      const { data: turns, error } = await supabaseAdmin
        .from('turns')
        .select(`
          id,
          game_id,
          turn_number,
          role,
          content,
          meta,
          created_at
        `)
        .eq('game_id', gameId)
        .order('turn_number', { ascending: true });
      
      if (error) {
        throw new Error(`Failed to fetch session turns: ${error.message}`);
      }
      
      // Map content.narrative to narrative_summary for compatibility
      const mappedTurns = (turns || []).map((turn: any) => ({
        id: turn.id,
        session_id: gameId, // For compatibility
        sequence: turn.turn_number, // For compatibility
        turn_number: turn.turn_number,
        user_prompt: turn.meta?.userInput || null,
        narrative_summary: turn.content?.narrative || turn.meta?.narrativeSummary || null,
        ai_response: turn.content, // Store content as ai_response for backward compatibility
        is_initialization: turn.meta?.isInitialization || (turn.turn_number === 1),
        created_at: turn.created_at,
      }));

      return mappedTurns;
    } catch (error) {
      console.error('Unexpected error in getSessionTurns:', error);
      throw error;
    }
  }

  /**
   * Get initialize narrative for a game session
   * @param gameId - Game ID
   * @returns Initialize narrative or null
   */
  async getInitializeNarrative(gameId: string): Promise<string | null> {
    try {
      // Get the first turn (turn_number = 1) which should be the initialization turn
      const { data: turn, error } = await supabaseAdmin
        .from('turns')
        .select('content, meta')
        .eq('game_id', gameId)
        .eq('turn_number', 1)
        .single();

      if (error || !turn) {
        // If no turn found, return null
        if (error?.code === 'PGRST116') {
          // No rows found - this is OK
          return null;
        }
        console.error('Error fetching initialize narrative:', error);
        return null;
      }

      // Extract narrative from content JSONB or meta
      if (turn.content && typeof turn.content === 'object') {
        return (turn.content as any).narrative || null;
      }
      
      // Fallback to meta.narrativeSummary
      if (turn.meta && typeof turn.meta === 'object') {
        return (turn.meta as any).narrativeSummary || null;
      }
      
      return null;
    } catch (error) {
      console.error('Unexpected error in getInitializeNarrative:', error);
      return null;
    }
  }

  /**
   * Ensure guest user has a cookie group
   * @param cookieId - Cookie ID for the guest user
   */
  private async ensureGuestCookieGroup(cookieId: string): Promise<void> {
    try {
      // Check if the cookie group itself exists in cookie_groups table
      const { data: existingGroup, error: groupError } = await supabaseAdmin
        .from('cookie_groups')
        .select('id')
        .eq('id', cookieId)
        .single();

      if (existingGroup && !groupError) {
        console.log(`Cookie group ${cookieId} already exists`);
        return; // Cookie group exists
      }

      // Cookie group doesn't exist - create it manually
      console.log(`Creating cookie group for guest user ${cookieId}`);
      
      // First, create the cookie group
      const { data: newGroup, error: groupCreateError } = await supabaseAdmin
        .from('cookie_groups')
        .insert({
          id: cookieId,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (groupCreateError) {
        // If it's a duplicate key error, that's okay - the group already exists
        if (groupCreateError.code === '23505' && groupCreateError.message.includes('duplicate key')) {
          console.log(`Cookie group already exists for guest user ${cookieId} (duplicate key)`);
          return;
        }
        
        console.error('Error creating cookie group:', groupCreateError);
        throw new Error(`Failed to create cookie group: ${groupCreateError.message}`);
      }

      // Then, create the cookie group member
      const { error: memberCreateError } = await supabaseAdmin
        .from('cookie_group_members')
        .insert({
          cookie_id: cookieId,
          group_id: cookieId,
          device_label: 'Guest Device',
          created_at: new Date().toISOString(),
        });

      if (memberCreateError) {
        // If it's a duplicate key error, that's okay - the member already exists
        if (memberCreateError.code === '23505' && memberCreateError.message.includes('duplicate key')) {
          console.log(`Cookie group member already exists for guest user ${cookieId}`);
          return;
        }
        
        console.error('Error creating cookie group member:', memberCreateError);
        throw new Error(`Failed to create cookie group member: ${memberCreateError.message}`);
      }

      console.log(`Created cookie group and member for guest user ${cookieId}`);
    } catch (error) {
      console.error('Error ensuring guest cookie group:', error);
      throw error;
    }
  }

  /**
   * Handle starter stones grant for first-time spawners
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param isGuest - Whether the owner is a guest
   */
  private async handleStarterStonesGrant(ownerId: string, isGuest: boolean): Promise<void> {
    try {
      // Check if starter stones are enabled in config
      const pricingConfig = configService.getPricing();
      
      if (pricingConfig.guestStarterCastingStones <= 0) {
        return; // Starter stones disabled
      }

      // Check if this is the first spawn for this owner
      const existingGames = await this.getGames(ownerId, isGuest, 1, 0);
      if (existingGames.length > 0) {
        return; // Not the first spawn
      }

      // Check current wallet balance
      const wallet = await WalletService.getWallet(ownerId, isGuest);
      if (wallet.castingStones >= pricingConfig.guestStarterCastingStones) {
        return; // Already has sufficient stones
      }

      // Grant starter stones
      const grantAmount = pricingConfig.guestStarterCastingStones - wallet.castingStones;
      await WalletService.addCastingStones(ownerId, isGuest, grantAmount, 'STARTER', {
        reason: 'First spawn starter grant',
        grantAmount,
        isFirstSpawn: true
      });

      console.log(`Granted ${grantAmount} starter stones to ${isGuest ? 'guest' : 'user'} ${ownerId}`);
    } catch (error) {
      console.error('Error handling starter stones grant:', error);
      // Don't fail the spawn if starter grant fails
    }
  }

  /**
   * Extract the most reliable adventure identifier from a database row.
   */
  private extractAdventureReference(dbRow: any): string | undefined {
    const rawSnapshot = dbRow.state_snapshot;
    let snapshot: any = rawSnapshot;

    if (typeof rawSnapshot === 'string') {
      try {
        snapshot = JSON.parse(rawSnapshot);
      } catch {
        snapshot = undefined;
      }
    }

    const metadataSlug = snapshot?.metadata?.adventureSlug;
    if (typeof metadataSlug === 'string' && metadataSlug.trim().length > 0) {
      return metadataSlug;
    }

    const metadataId = snapshot?.metadata?.adventureId;
    if (typeof metadataId === 'string' && metadataId.trim().length > 0) {
      return metadataId;
    }

    const embeddedSlug = snapshot?.adventure?.slug ?? snapshot?.adventureSlug;
    if (typeof embeddedSlug === 'string' && embeddedSlug.trim().length > 0) {
      return embeddedSlug;
    }

    if (typeof dbRow.adventure_id === 'string' && dbRow.adventure_id.trim().length > 0) {
      return dbRow.adventure_id;
    }

    return undefined;
  }

  /**
   * Map database game row to GameDTO
   * @param dbRow - Database row with joined data
   * @returns GameDTO
   */
  private async mapGameToDTO(dbRow: any): Promise<GameDTO> {
    const adventureReference = this.extractAdventureReference(dbRow);
    const resolvedAdventure = adventureReference
      ? await resolveAdventureByIdentifier(adventureReference)
      : null;

    const adventureId =
      resolvedAdventure?.id ??
      (typeof dbRow.adventure_id === 'string' && dbRow.adventure_id.length > 0
        ? dbRow.adventure_id
        : adventureReference
          ? computeAdventureId(adventureReference)
          : computeAdventureId('unknown'));

    const worldSlug =
      resolvedAdventure?.worldSlug ??
      (typeof dbRow.world_slug === 'string' ? dbRow.world_slug : undefined);

    const world = worldSlug ? await ContentService.getWorldBySlug(worldSlug) : null;
    const worldName = world?.name ?? world?.title ?? worldSlug ?? 'Unknown World';

    return {
      id: dbRow.id,
      adventureId,
      adventureTitle:
        resolvedAdventure?.title ??
        dbRow.state_snapshot?.metadata?.adventureTitle ??
        'Unknown Adventure',
      adventureDescription: resolvedAdventure?.description,
      characterId: dbRow.character_id ?? undefined,
      characterName: dbRow.characters?.name ?? undefined,
      worldSlug: worldSlug ?? 'unknown',
      worldName,
      turnCount: dbRow.turn_count,
      status: dbRow.status,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      lastPlayedAt: dbRow.last_played_at,
    };
  }

  /**
   * Map database game row to GameListDTO
   * @param dbRow - Database row with joined data
   * @returns GameListDTO
   */
  private async mapGameToListDTO(dbRow: any): Promise<GameListDTO> {
    const adventureReference = this.extractAdventureReference(dbRow);
    const resolvedAdventure = adventureReference
      ? await resolveAdventureByIdentifier(adventureReference)
      : null;

    const worldSlug =
      resolvedAdventure?.worldSlug ??
      (typeof dbRow.world_slug === 'string' ? dbRow.world_slug : undefined);
    const world = worldSlug ? await ContentService.getWorldBySlug(worldSlug) : null;
    const worldName = world?.name ?? world?.title ?? worldSlug ?? 'Unknown World';

    return {
      id: dbRow.id,
      adventureTitle:
        resolvedAdventure?.title ??
        dbRow.state_snapshot?.metadata?.adventureTitle ??
        'Unknown Adventure',
      characterName: dbRow.characters?.name ?? undefined,
      worldName,
      turnCount: dbRow.turn_count,
      status: dbRow.status,
      lastPlayedAt: dbRow.last_played_at,
    };
  }

  /**
   * Generate a server summary from turn result
   * @param turnResult - Turn result from AI
   * @returns Server summary string
   */
  private generateServerSummary(turnResult: TurnResponse): string {
    const summary = turnResult.narrative.substring(0, 100);
    return summary.length < turnResult.narrative.length ? `${summary}...` : summary;
  }

  /**
   * End a game and free up the character
   * @param gameId - Game ID
   * @returns Success status
   */
  async endGame(gameId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const game = await this.loadGame(gameId);
      if (!game) {
        return {
          success: false,
          error: 'Game not found',
        };
      }

      // Update game status
      const { error: gameError } = await supabaseAdmin
        .from('games')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      if (gameError) {
        console.error('Error updating game status:', gameError);
        return {
          success: false,
          error: 'Failed to update game status',
        };
      }

      // Free up character if it exists
      if (game.character_id) {
        const { error: characterError } = await supabaseAdmin
          .from('characters')
          .update({
            active_game_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', game.character_id);

        if (characterError) {
          console.error('Error freeing character:', characterError);
          // Don't fail the operation, just log
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in endGame:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }
}

export const gamesService = new GamesService();
