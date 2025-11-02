import { createHash } from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { configService } from '../config/index.js';
import { PromptWrapper } from '../prompts/wrapper.js';
import { debugService } from './debug.service.js';
import { ServiceError } from '../utils/serviceError.js';
import { ApiErrorCode } from '@shared';
import { PlayerV3Service } from './player-v3.service.js';
import { SCENE_IDS, ADVENTURE_IDS, WORLD_IDS, DEFAULT_VALUES } from '../constants/game-constants.js';
import { GameConfigService } from './game-config.service.js';
// Legacy imports removed - this service is deprecated
// Use EntryPointAssemblerV3 instead via GamesService.spawnV3() or TurnsService.buildPromptV2()
import type { Character, WorldTemplate, Prompt } from '@shared';
import type { PromptContext, PromptAssemblyResult, PromptAuditEntry } from '../prompts/schemas.js';

export interface GameContext {
  id: string;
  world_id: string;
  character_id?: string;
  state_snapshot: any;
  turn_index: number;
  current_scene?: string;
}

/**
 * Database-only prompts service that replaces all file-based prompt loading
 */
/**
 * @deprecated This service is deprecated. Use EntryPointAssemblerV3 via GamesService.spawnV3() instead.
 * This service will be removed in a future release.
 */
export class PromptsService {
  private promptWrapper: PromptWrapper;
  private gameConfigService: GameConfigService;

  constructor() {
    this.promptWrapper = new PromptWrapper();
    this.gameConfigService = GameConfigService.getInstance();
  }

  /**
   * Create the initial AI prompt for a new game using database-only assembly
   * @param game - Game context with state and metadata
   * @returns Formatted prompt string for game initialization
   */
  async createInitialPrompt(game: GameContext): Promise<string> {
    throw new ServiceError(500, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'This method is deprecated. Use GamesService.spawnV3() with EntryPointAssemblerV3 instead.'
    });
  }

  /**
   * @deprecated Use DatabasePromptAssembler.assemblePromptV2() instead. This method will be removed after legacy prompts sunset.
   * Build a prompt for AI generation using database-only assembly
   * @param game - Game context with state and metadata
   * @param optionId - The option/action the player chose
   * @returns Formatted prompt string (server-only, never sent to client)
   */
  async buildPrompt(game: GameContext, optionId: string): Promise<string> {
    throw new ServiceError(500, {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'This method is deprecated. Use TurnsService.buildPromptV2() with EntryPointAssemblerV3 instead.'
    });
  }

  /**
   * Extract adventure slug from game context
   */
  private extractAdventureSlug(game: GameContext): string {
    // Try to extract from state snapshot
    const snapshot = game.state_snapshot as Record<string, unknown> | undefined;
    if (snapshot?.adventureSlug) {
      return String(snapshot.adventureSlug);
    }
    if (snapshot?.adventure_slug) {
      return String(snapshot.adventure_slug);
    }
    
    // Default to a standard adventure slug based on world
    return `adv.${game.world_id.toLowerCase()}.start.v3`;
  }

  /**
   * Extract starting scene ID from game context
   */
  private extractStartingSceneId(game: GameContext): string {
    // Try to extract from state snapshot
    const snapshot = game.state_snapshot as Record<string, unknown> | undefined;
    if (snapshot?.currentScene) {
      return String(snapshot.currentScene);
    }
    if (snapshot?.current_scene) {
      return String(snapshot.current_scene);
    }
    if (game.current_scene) {
      return game.current_scene;
    }
    
    // Default to a standard starting scene
    return 'forest_meet';
  }

  /**
   * Build PromptContext for database assembly
   * @param game - Game context with state and metadata
   * @param optionId - The option/action the player chose
   * @returns PromptContext for database assembly
   */
  private async buildDatabasePromptContext(game: GameContext, optionId: string): Promise<PromptContext> {
    // Load world template for context
    const worldTemplate = await this.loadWorldTemplate(game.world_id);
    if (!worldTemplate) {
      throw new Error(`World template not found: ${game.world_id}`);
    }

    // Load character if specified
    let character: Character | null = null;
    if (game.character_id) {
      character = await this.loadCharacter(game.character_id);
    }

    // Get prompt schema version from config
    const aiConfig = configService.getAi();
    const schemaVersion = aiConfig.promptSchemaVersion || '1.0.0';

    // Build prompt context for database assembly
    const promptContext = this.buildPromptContext(game, worldTemplate, character, optionId, schemaVersion);
    
    return promptContext;
  }

  /**
   * Build prompt context object
   */
  private buildPromptContext(
    game: GameContext,
    worldTemplate: WorldTemplate,
    character: Character | null,
    optionId: string,
    schemaVersion: string
  ): PromptContext {
    return {
      game: {
        id: game.id,
        turn_index: game.turn_index,
        summary: game.state_snapshot?.summary || '',
        current_scene: game.current_scene || 'forest_meet',
        state_snapshot: game.state_snapshot || {},
        option_id: optionId,
      },
      world: {
        name: worldTemplate.name,
        setting: worldTemplate.setting,
        genre: worldTemplate.genre,
        themes: worldTemplate.themes,
        rules: worldTemplate.rules || '',
        mechanics: worldTemplate.rules || '',
        lore: worldTemplate.description || '',
        logic: worldTemplate.rules || '',
      },
      character: character ? {
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        backstory: character.backstory,
        skills: {},
        inventory: [],
        relationships: {},
        goals: {
          short_term: [],
          long_term: []
        },
        flags: {},
        reputation: {},
      } : undefined,
      adventure: {
        name: this.extractAdventureSlug(game),
      },
      runtime: {
        ticks: game.state_snapshot?.ticks || 0,
        presence: game.state_snapshot?.presence || {},
        ledgers: game.state_snapshot?.ledgers || {},
        flags: game.state_snapshot?.flags || {},
        last_acts: game.state_snapshot?.last_acts || [],
        style_hint: game.state_snapshot?.style_hint || '',
      },
      system: {
        schema_version: schemaVersion,
        prompt_version: '1.0.0',
        load_order: [],
        hash: this.createHash(JSON.stringify(game.state_snapshot || {})),
      },
    };
  }

  /**
   * Load world template from database
   */
  private async loadWorldTemplate(worldSlug: string): Promise<WorldTemplate | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('worlds')
        .select('*')
        .eq('slug', worldSlug)
        .single();

      if (error) {
        console.error(`[PROMPTS_SERVICE] Error loading world template:`, error);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`[PROMPTS_SERVICE] Error loading world template:`, error);
      return null;
    }
  }

  /**
   * Load character from database
   */
  private async loadCharacter(characterId: string): Promise<Character | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (error) {
        console.error(`[PROMPTS_SERVICE] Error loading character:`, error);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`[PROMPTS_SERVICE] Error loading character:`, error);
      return null;
    }
  }

  /**
   * Create hash for context
   */
  private createHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Estimate token count for a text
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate token count (public method)
   */
  calculateTokenCount(prompt: string): number {
    return this.estimateTokenCount(prompt);
  }

  /**
   * @deprecated Use GamesService.spawnV3() with Phase 3 flow instead. This method will be removed after legacy prompts sunset (2025-12-31).
   * Compatibility adapter: creates initial prompt with approval mechanism (legacy flow).
   * Internally routes to new Phase 3 flow when LEGACY_PROMPTS_ENABLED=true.
   * This adapter will be deleted after sunset date.
   * 
   * @param gameId - Game ID
   * @param worldSlug - World slug (legacy format)
   * @param characterId - Optional character ID
   * @returns Legacy prompt result format
   */
  async createInitialPromptWithApproval(
    gameId: string,
    worldSlug: string,
    characterId?: string
  ): Promise<{ prompt: string; promptId: string }> {
    // Legacy compatibility adapter - routes to new Phase 3 flow if enabled
    // When LEGACY_PROMPTS_ENABLED=false, this method should not be called (route returns 410)
    const { config } = await import('../config/index.js');
    
    if (config.legacyPrompts.enabled) {
      // Try to map to new flow: get game to extract entry_point_id, world_id, entry_start_slug
      const { supabaseAdmin } = await import('./supabase.js');
      const { GamesService } = await import('./games.service.js');
      
      const gamesService = new GamesService();
      const game = await gamesService.getGameById(gameId, '', false, null);
      
      if (!game) {
        throw new Error('Game not found');
      }

      // Extract entry point info from game (legacy games may not have entry_point_id)
      let entryPointId: string | undefined;
      let entryStartSlug: string | undefined;
      
      if (game.entry_point_id) {
        entryPointId = game.entry_point_id;
      } else {
        // Fallback: try to find entry point by world slug
        const { data: entryPoint } = await supabaseAdmin
          .from('entry_points')
          .select('id, slug')
          .eq('world_id', game.world_id || worldSlug)
          .limit(1)
          .single();
        
        if (entryPoint) {
          entryPointId = entryPoint.id;
          entryStartSlug = entryPoint.slug;
        }
      }

      // If we can't map, fall back to old behavior (create prompt string only)
      if (!entryPointId || !entryStartSlug) {
        const gameContext: GameContext = {
          id: gameId,
          world_id: worldSlug,
          character_id: characterId,
          state_snapshot: game.state_snapshot || {},
          turn_index: 0,
        };
        
        const prompt = await this.createInitialPrompt(gameContext);
        const promptId = debugService.logPrompt(gameId, 0, worldSlug, characterId || 'Guest', {
          prompt,
          audit: {},
          metadata: {},
        });
        
        return { prompt, promptId };
      }

      // Route to new flow (compatibility adapter - this will be deleted after sunset)
      // Note: We can't fully replicate the approval flow, so we just create the first turn
      // Legacy clients should migrate to POST /api/games with Phase 3 format
      const gameContext: GameContext = {
        id: gameId,
        world_id: game.world_id || worldSlug,
        character_id: characterId,
        state_snapshot: game.state_snapshot || {},
        turn_index: 0,
      };
      
      const prompt = await this.createInitialPrompt(gameContext);
      const promptId = debugService.logPrompt(gameId, 0, worldSlug, characterId || 'Guest', {
        prompt,
        audit: {},
        metadata: {},
      });
      
      return { prompt, promptId };
    }
    
    // Should not reach here if legacy is disabled (route should return 410)
    throw new Error('Legacy prompts are disabled. Use POST /api/games with Phase 3 format.');
  }
}

// Export singleton instance (deprecated - methods throw errors)
export const promptsService = new PromptsService();
