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
import { DatabasePromptService } from './db-prompt.service.js';
import { DatabasePromptAssembler, DatabasePromptError, DatabasePromptParams } from '../prompts/database-prompt-assembler.js';
import { initializeRuntimeGuards } from '../prompts/runtime-guards.js';
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
export class PromptsService {
  private promptWrapper: PromptWrapper;
  private gameConfigService: GameConfigService;
  private databasePromptService: DatabasePromptService;
  private databasePromptAssembler: DatabasePromptAssembler;

  constructor(databasePromptService: DatabasePromptService) {
    // Initialize runtime guards for DB-only mode
    initializeRuntimeGuards();
    
    this.promptWrapper = new PromptWrapper();
    this.gameConfigService = GameConfigService.getInstance();
    this.databasePromptService = databasePromptService;
    this.databasePromptAssembler = new DatabasePromptAssembler(databasePromptService['promptRepository']);
  }

  /**
   * Create the initial AI prompt for a new game using database-only assembly
   * @param game - Game context with state and metadata
   * @returns Formatted prompt string for game initialization
   */
  async createInitialPrompt(game: GameContext): Promise<string> {
    try {
      console.log(`[PROMPTS_SERVICE] Using database-only assembly for initial prompt`);
      
      // Build database prompt parameters
      const params: DatabasePromptParams = {
        worldSlug: game.world_id.toLowerCase(),
        adventureSlug: this.extractAdventureSlug(game),
        startingSceneId: this.extractStartingSceneId(game),
        includeEnhancements: true,
      };
      
      // Assemble prompt using database-only assembler
      const result = await this.databasePromptAssembler.assemblePrompt(params);
      
      // Log to debug service
      const promptId = debugService.logPrompt(
        game.id,
        0, // Initial prompt is turn 0
        game.world_id,
        game.character_id || 'Guest',
        {
          prompt: result.promptText,
          audit: result.audit,
          metadata: result.metadata,
        }
      );
      
      console.log(`[PROMPTS_SERVICE] Created initial prompt using database-only assembly with ${result.metadata.totalSegments} segments`);
      return result.promptText;
    } catch (error) {
      console.error('[PROMPTS_SERVICE] Error creating initial prompt:', error);
      
      if (error instanceof DatabasePromptError) {
        throw new ServiceError(
          ApiErrorCode.INTERNAL_SERVER_ERROR,
          `Database prompt error: ${error.message}`,
          { code: error.code, context: error.context }
        );
      }
      
      throw new ServiceError(
        ApiErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to create initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build a prompt for AI generation using database-only assembly
   * @param game - Game context with state and metadata
   * @param optionId - The option/action the player chose
   * @returns Formatted prompt string (server-only, never sent to client)
   */
  async buildPrompt(game: GameContext, optionId: string): Promise<string> {
    try {
      console.log(`[PROMPTS_SERVICE] Building prompt for game ${game.id}, turn ${game.turn_index}, optionId: ${optionId}`);
      
      // Build database prompt parameters
      const params: DatabasePromptParams = {
        worldSlug: game.world_id.toLowerCase(),
        adventureSlug: this.extractAdventureSlug(game),
        startingSceneId: this.extractStartingSceneId(game),
        includeEnhancements: true,
      };
      
      // Assemble prompt using database-only assembler
      const result = await this.databasePromptAssembler.assemblePrompt(params);
      
      // Log to debug service
      const promptId = debugService.logPrompt(
        game.id,
        game.turn_index,
        game.world_id,
        game.character_id || 'Guest',
        {
          prompt: result.promptText,
          audit: result.audit,
          metadata: result.metadata,
        }
      );
      
      console.log(`[PROMPTS_SERVICE] Created prompt using database-only assembly with ${result.metadata.totalSegments} segments`);
      return result.promptText;
    } catch (error) {
      console.error('[PROMPTS_SERVICE] Error building prompt:', error);
      
      if (error instanceof DatabasePromptError) {
        throw new ServiceError(
          ApiErrorCode.INTERNAL_SERVER_ERROR,
          `Database prompt error: ${error.message}`,
          { code: error.code, context: error.context }
        );
      }
      
      throw new ServiceError(
        ApiErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to build prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
        rules: worldTemplate.rules,
        mechanics: worldTemplate.mechanics,
        lore: worldTemplate.lore,
        logic: worldTemplate.logic,
      },
      character: character ? {
        name: character.name,
        role: character.role,
        race: character.race,
        class: character.class,
        level: character.level,
        essence: character.essence,
        age: character.age,
        build: character.build,
        eyes: character.eyes,
        traits: character.traits,
        backstory: character.backstory,
        motivation: character.motivation,
        skills: character.skills,
        stats: character.stats,
        inventory: character.inventory,
        relationships: character.relationships,
        goals: character.goals,
        flags: character.flags,
        reputation: character.reputation,
      } : undefined,
      adventure: {
        name: this.extractAdventureSlug(game),
        slug: this.extractAdventureSlug(game),
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
}
