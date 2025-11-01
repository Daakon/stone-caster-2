/**
 * PromptPreviewService - Service for previewing prompts without executing them
 * Supports both start (initial) and turn modes
 */

import { GamesService } from './games.service.js';
import { DatabasePromptAssembler } from '../prompts/database-prompt-assembler.js';
import { PromptRepository } from '../repositories/prompt.repository.js';
import { config } from '../config/index.js';
import { ApiErrorCode } from '@shared';
import type { AssemblePiece } from '../prompts/assembler-types.js';

export type PreviewMode = 'start' | 'turn';

export interface PromptPreviewInput {
  gameId: string;               // uuid
  mode: PreviewMode;            // "start" for autoinit, "turn" for later
  turnNumber?: number;          // required when mode="turn"
  playerMessage?: string;       // optional: simulate user message
  model?: string;               // override
  budgetTokens?: number;        // override
}

export interface PromptPreviewResult {
  ok: boolean;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  data?: {
    prompt: string;             // final assembled prompt text
    pieces: Array<{ scope: string; slug: string; version?: string; tokens: number }>;
    meta: {
      included: string[];
      dropped: string[];
      policy: string[];
      tokenEst: { input: number; budget: number; pct: number };
      model: string;
      worldId: string;
      rulesetSlug: string;
      scenarioSlug?: string | null;
      entryStartSlug?: string;
      phase: 'start' | 'turn';
    };
    context: {                  // helpful echo for debugging
      gameId: string;
      turnNumber?: number;
      playerMessage?: string;
    };
  };
}

export class PromptPreviewService {
  private gamesService: GamesService;
  private assembler: DatabasePromptAssembler;

  constructor() {
    this.gamesService = new GamesService();
    const promptRepository = new PromptRepository(
      config.supabase.url,
      config.supabase.serviceKey
    );
    this.assembler = new DatabasePromptAssembler(promptRepository);
  }

  /**
   * Preview a prompt for a given game
   */
  async preview(input: PromptPreviewInput): Promise<PromptPreviewResult> {
    try {
      // Validate input
      if (input.mode === 'turn' && !input.turnNumber) {
        return {
          ok: false,
          error: {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'turnNumber is required when mode="turn"',
          },
        };
      }

      // Load game to get context
      // Note: We load without ownership check for preview purposes
      // In production, this should still respect RLS or have a service role check
      const game = await this.gamesService.loadGame(input.gameId);
      
      if (!game) {
        return {
          ok: false,
          error: {
            code: ApiErrorCode.NOT_FOUND,
            message: `Game ${input.gameId} not found`,
          },
        };
      }

      // Extract game context for assembler
      let worldId: string;
      let entryStartSlug: string;
      let scenarioSlug: string | null | undefined;
      let rulesetSlug: string;

      if (game.entry_point_id) {
        const { supabaseAdmin } = await import('./supabase.js');
        const { data: entryPoint } = await supabaseAdmin
          .from('entry_points')
          .select('slug, world_id, entry_start_slug, scenario_slug, ruleset_slug')
          .eq('id', game.entry_point_id)
          .single();

        if (entryPoint) {
          worldId = entryPoint.world_id;
          entryStartSlug = entryPoint.entry_start_slug || entryPoint.slug;
          scenarioSlug = entryPoint.scenario_slug || null;
          rulesetSlug = entryPoint.ruleset_slug || 'default';
        } else {
          // Fallback to game state
          worldId = game.world_id || '';
          entryStartSlug = game.state_snapshot?.entry_start_slug || 'default-start';
          scenarioSlug = game.state_snapshot?.scenario_slug || null;
          rulesetSlug = game.state_snapshot?.ruleset_slug || 'default';
        }
      } else {
        // Legacy game - extract from state
        worldId = game.world_id || '';
        entryStartSlug = game.state_snapshot?.entry_start_slug || 'default-start';
        scenarioSlug = game.state_snapshot?.scenario_slug || null;
        rulesetSlug = game.state_snapshot?.ruleset_slug || 'default';
      }

      // Validate worldId
      if (!worldId) {
        return {
          ok: false,
          error: {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Game missing world_id - cannot assemble prompt',
          },
        };
      }

      // Validate entryStartSlug for start mode
      if (input.mode === 'start' && !entryStartSlug) {
        return {
          ok: false,
          error: {
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Game missing entry_start_slug - required for start mode',
          },
        };
      }

      // Resolve worldId if it's not a UUID
      if (!this.isValidUuid(worldId)) {
        const { supabaseAdmin } = await import('./supabase.js');
        const { data: worldMapping } = await supabaseAdmin
          .from('world_id_mapping')
          .select('uuid_id')
          .eq('text_id', worldId)
          .single();
        
        if (worldMapping) {
          worldId = worldMapping.uuid_id;
        } else {
          // Try to find world by slug
          const { data: world } = await supabaseAdmin
            .from('worlds')
            .select('id')
            .eq('slug', worldId)
            .single();
          
          if (world) {
            worldId = world.id;
          } else {
            return {
              ok: false,
              error: {
                code: ApiErrorCode.VALIDATION_FAILED,
                message: `Could not resolve world ID from slug: ${worldId}`,
              },
            };
          }
        }
      }

      // Use config defaults if not overridden
      const model = input.model || config.prompt.modelDefault;
      const budgetTokens = input.budgetTokens || config.prompt.tokenBudgetDefault;

      // Assemble prompt using V2 assembler
      const assembleResult = await this.assembler.assemblePromptV2({
        worldId,
        rulesetSlug: rulesetSlug || 'default',
        scenarioSlug: scenarioSlug || null,
        entryStartSlug: entryStartSlug || '',
        model,
        budgetTokens,
      });

      // Build response
      return {
        ok: true,
        data: {
          prompt: assembleResult.prompt,
          pieces: assembleResult.pieces.map(p => ({
            scope: p.scope,
            slug: p.slug,
            version: p.version,
            tokens: p.tokens,
          })),
          meta: {
            included: assembleResult.meta.included,
            dropped: assembleResult.meta.dropped,
            policy: assembleResult.meta.policy || [],
            tokenEst: assembleResult.meta.tokenEst,
            model: assembleResult.meta.model,
            worldId: assembleResult.meta.worldId,
            rulesetSlug: assembleResult.meta.rulesetSlug,
            scenarioSlug: assembleResult.meta.scenarioSlug,
            entryStartSlug: assembleResult.meta.entryStartSlug,
            phase: input.mode,
          },
          context: {
            gameId: input.gameId,
            turnNumber: input.turnNumber,
            playerMessage: input.playerMessage,
          },
        },
      };
    } catch (error) {
      console.error('[PROMPT_PREVIEW] Error previewing prompt:', error);
      return {
        ok: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Check if a string is a valid UUID
   */
  private isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}

