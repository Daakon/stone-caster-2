import { createHash } from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { configService } from '../config/index.js';
import { PromptAssembler } from '../prompts/assembler.js';
import { debugService } from './debug.service.js';
import { getTemplatesForWorld, PromptTemplateMissingError } from '../prompting/templateRegistry.js';
import { ServiceError } from '../utils/serviceError.js';
import { ApiErrorCode } from '@shared';
import type { Character, WorldTemplate, Prompt } from '@shared';
import type { PromptContext, PromptAssemblyResult, PromptAuditEntry } from '../prompts/schemas.js';

export interface GameContext {
  id: string;
  world_id: string;
  character_id?: string;
  state_snapshot: any;
  turn_index: number;
}

export class PromptsService {
  private assembler: PromptAssembler;

  constructor() {
    this.assembler = new PromptAssembler();
  }

  /**
   * Create the initial AI prompt for a new game (before first turn)
   * @param game - Game context with state and metadata
   * @returns Formatted prompt string for game initialization
   */
  async createInitialPrompt(game: GameContext): Promise<string> {
    try {
      // Get prompt schema version from config
      const aiConfig = configService.getAi();
      const schemaVersion = aiConfig.promptSchemaVersion || '1.0.0';

      // Load templates using the new registry
      const bundle = await getTemplatesForWorld(game.world_id);
      
      // Load world template for context (still needed for metadata)
      const worldTemplate = await this.loadWorldTemplate(game.world_id);
      if (!worldTemplate) {
        throw new Error(`World template not found: ${game.world_id}`);
      }

      // Load character if specified
      let character: Character | null = null;
      if (game.character_id) {
        character = await this.loadCharacter(game.character_id);
      }

      // Build prompt context for initial game state
      const promptContext = this.buildInitialPromptContext(game, worldTemplate, character, schemaVersion);
      
      // Assemble prompt from bundle
      const result = await this.assemblePromptFromBundle(bundle, promptContext);
      
      // Log to debug service
      const promptId = debugService.logPrompt(
        game.id,
        0, // Initial prompt is turn 0
        worldTemplate.name,
        character?.name,
        result
      );
      
      // Log audit information
      console.log('Initial prompt assembled:', {
        promptId,
        templateCount: result.metadata.totalSegments,
        tokenCount: result.audit.tokenCount,
        world: result.audit.contextSummary.world,
        turn: result.audit.contextSummary.turnIndex,
      });
      
      return result.prompt;
    } catch (error) {
      if (error instanceof PromptTemplateMissingError) {
        throw new ServiceError(422, {
          code: ApiErrorCode.PROMPT_TEMPLATE_MISSING,
          message: `No templates available for world '${error.world}'.`,
          details: { world: error.world }
        });
      }
      if (error instanceof ServiceError) {
        throw error; // Re-throw ServiceError as-is
      }
      console.error('Error creating initial prompt:', error);
      throw new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: `Failed to create initial prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { originalError: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Build a prompt for AI generation based on game context
   * @param game - Game context with state and metadata
   * @param optionId - The option/action the player chose
   * @returns Formatted prompt string (server-only, never sent to client)
   */
  async buildPrompt(game: GameContext, optionId: string): Promise<string> {
    try {
      // Get prompt schema version from config
      const aiConfig = configService.getAi();
      const schemaVersion = aiConfig.promptSchemaVersion || '1.0.0';

      // Load templates using the new registry
      const bundle = await getTemplatesForWorld(game.world_id);
      
      // Load world template for context (still needed for metadata)
      const worldTemplate = await this.loadWorldTemplate(game.world_id);
      if (!worldTemplate) {
        throw new Error(`World template not found: ${game.world_id}`);
      }

      // Load character if specified
      let character: Character | null = null;
      if (game.character_id) {
        character = await this.loadCharacter(game.character_id);
      }

      // Build prompt context
      const promptContext = this.buildPromptContext(game, worldTemplate, character, optionId, schemaVersion);
      
      // Assemble prompt from bundle
      const result = await this.assemblePromptFromBundle(bundle, promptContext);
      
      // Log to debug service
      const promptId = debugService.logPrompt(
        game.id,
        game.turn_index,
        worldTemplate.name,
        character?.name,
        result
      );
      
      // Log audit information
      console.log('Prompt assembled:', {
        promptId,
        templateCount: result.metadata.totalSegments,
        tokenCount: result.audit.tokenCount,
        world: result.audit.contextSummary.world,
        turn: result.audit.contextSummary.turnIndex,
      });
      
      return result.prompt;
    } catch (error) {
      if (error instanceof PromptTemplateMissingError) {
        throw new ServiceError(422, {
          code: ApiErrorCode.PROMPT_TEMPLATE_MISSING,
          message: `No templates available for world '${error.world}'.`,
          details: { world: error.world }
        });
      }
      if (error instanceof ServiceError) {
        throw error; // Re-throw ServiceError as-is
      }
      console.error('Error building prompt:', error);
      throw new ServiceError(500, {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: `Failed to build prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { originalError: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  /**
   * Build initial prompt context for game initialization
   */
  private buildInitialPromptContext(
    game: GameContext,
    worldTemplate: WorldTemplate,
    character: Character | null,
    schemaVersion: string
  ): PromptContext {
    return {
      character: character ? {
        name: character.name,
        level: character.level,
        race: character.race,
        class: character.class,
        skills: character.skills ? Object.fromEntries(character.skills.map(skill => [skill, 1])) : undefined,
        inventory: character.inventory?.map(item => item.name) || [],
        relationships: character.worldData?.relationships || {},
        stats: character.attributes || {},
        flags: character.worldData?.flags || {},
      } : undefined,
      
      game: {
        id: game.id,
        turn_index: 0, // Initial prompt is always turn 0
        summary: this.generateInitialGameSummary(game),
        current_scene: 'opening', // Default opening scene
        state_snapshot: game.state_snapshot,
        option_id: 'game_start', // Special option ID for initial prompt
      },
      
      world: {
        name: worldTemplate.name,
        setting: worldTemplate.setting,
        genre: worldTemplate.genre,
        themes: worldTemplate.themes,
        rules: worldTemplate.rules,
        mechanics: worldTemplate.rules, // Use rules as mechanics for now
        lore: worldTemplate.description, // Use description as lore for now
        logic: worldTemplate.rules, // Use rules as logic for now
      },
      
      adventure: game.state_snapshot?.adventure ? {
        name: game.state_snapshot.adventure.name,
        scenes: game.state_snapshot.adventure.scenes,
        objectives: game.state_snapshot.adventure.objectives,
        npcs: game.state_snapshot.adventure.npcs,
        places: game.state_snapshot.adventure.places,
        triggers: game.state_snapshot.adventure.triggers,
      } : undefined,
      
      runtime: {
        ticks: 0, // Initial state
        presence: 'present',
        ledgers: {
          'game.turns': 0,
          'game.scenes_visited': ['opening'],
          'game.actions_taken': [],
        },
        flags: {
          'game.initialized': true,
          'game.world': game.world_id,
          'game.starting_scene': 'opening',
        },
        last_acts: [],
        style_hint: 'neutral',
      },
      
      system: {
        schema_version: schemaVersion,
        prompt_version: '2.0.0',
        load_order: [],
        hash: '',
      },
    };
  }

  /**
   * Build prompt context from game data
   */
  private buildPromptContext(
    game: GameContext,
    worldTemplate: WorldTemplate,
    character: Character | null,
    optionId: string,
    schemaVersion: string
  ): PromptContext {
    return {
      character: character ? {
        name: character.name,
        level: character.level,
        race: character.race,
        class: character.class,
        skills: character.skills ? Object.fromEntries(character.skills.map(skill => [skill, 1])) : undefined,
        inventory: character.inventory?.map(item => item.name) || [],
        relationships: character.worldData?.relationships || {},
        stats: character.attributes || {},
        flags: character.worldData?.flags || {},
      } : undefined,
      
      game: {
        id: game.id,
        turn_index: game.turn_index,
        summary: this.generateGameSummary(game),
        current_scene: game.state_snapshot?.current_scene,
        state_snapshot: game.state_snapshot,
        option_id: optionId,
      },
      
      world: {
        name: worldTemplate.name,
        setting: worldTemplate.setting,
        genre: worldTemplate.genre,
        themes: worldTemplate.themes,
        rules: worldTemplate.rules,
        mechanics: worldTemplate.rules, // Use rules as mechanics for now
        lore: worldTemplate.description, // Use description as lore for now
        logic: worldTemplate.rules, // Use rules as logic for now
      },
      
      adventure: game.state_snapshot?.adventure ? {
        name: game.state_snapshot.adventure.name,
        scenes: game.state_snapshot.adventure.scenes,
        objectives: game.state_snapshot.adventure.objectives,
        npcs: game.state_snapshot.adventure.npcs,
        places: game.state_snapshot.adventure.places,
        triggers: game.state_snapshot.adventure.triggers,
      } : undefined,
      
      runtime: {
        ticks: game.turn_index,
        presence: game.state_snapshot?.presence,
        ledgers: game.state_snapshot?.ledgers,
        flags: game.state_snapshot?.flags,
        last_acts: game.state_snapshot?.last_acts,
        style_hint: game.state_snapshot?.style_hint,
      },
      
      system: {
        schema_version: schemaVersion,
        prompt_version: '2.0.0',
        load_order: [],
        hash: '',
      },
    };
  }

  /**
   * Generate a brief game summary
   */
  private generateGameSummary(game: GameContext): string {
    const turnInfo = `Turn ${game.turn_index + 1}`;
    const worldInfo = `World: ${game.world_id}`;
    const characterInfo = game.character_id ? `Character: ${game.character_id}` : 'Guest Player';
    
    return `${turnInfo} | ${worldInfo} | ${characterInfo}`;
  }

  /**
   * Generate initial game summary for game start
   */
  private generateInitialGameSummary(game: GameContext): string {
    const worldInfo = `World: ${game.world_id}`;
    const characterInfo = game.character_id ? `Character: ${game.character_id}` : 'Guest Player';
    
    return `Game Start | ${worldInfo} | ${characterInfo}`;
  }

  private async loadWorldTemplate(worldSlug: string): Promise<WorldTemplate | null> {
    try {
      // Use ContentService to load world data by slug
      const { ContentService } = await import('./content.service.js');
      const worldData = await ContentService.getWorldBySlug(worldSlug);
      
      if (!worldData) {
        console.error(`World not found: ${worldSlug}`);
        return null;
      }

      // Convert ContentService world data to WorldTemplate format
      const worldTemplate: WorldTemplate = {
        id: worldData.slug, // Use slug as ID for compatibility
        name: worldData.name || worldData.slug,
        title: worldData.name || worldData.slug,
        tagline: worldData.description || '',
        description: worldData.description || '',
        genre: 'fantasy', // Default genre
        setting: worldData.description || '',
        themes: worldData.tags || [],
        availableRaces: ['Human', 'Elf', 'Dwarf'], // Default races
        availableClasses: ['Fighter', 'Mage', 'Rogue'], // Default classes
        startingPrompt: `Welcome to ${worldData.name || worldData.slug}! ${worldData.description || ''}`,
        rules: {
          allowMagic: true,
          allowTechnology: false,
          difficultyLevel: 'medium',
          combatSystem: 'd20',
        },
        isPublic: true,
        createdBy: undefined,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      return worldTemplate;
    } catch (error) {
      console.error('Unexpected error loading world template:', error);
      return null;
    }
  }

  private async loadCharacter(characterId: string): Promise<Character | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (error) {
        console.error('Error loading character:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error loading character:', error);
      return null;
    }
  }

  /**
   * Assemble prompt from template bundle
   */
  private async assemblePromptFromBundle(
    bundle: import('../prompting/templateRegistry.js').TemplateBundle,
    context: PromptContext
  ): Promise<PromptAssemblyResult> {
    // Create a simple prompt assembly from the bundle
    const segments: string[] = [];
    const templateIds: string[] = [];
    
    // Add core templates
    if (bundle.core.system) {
      segments.push(bundle.core.system);
      templateIds.push('core-system');
    }
    if (bundle.core.tools) {
      segments.push(bundle.core.tools);
      templateIds.push('core-tools');
    }
    if (bundle.core.formatting) {
      segments.push(bundle.core.formatting);
      templateIds.push('core-formatting');
    }
    if (bundle.core.safety) {
      segments.push(bundle.core.safety);
      templateIds.push('core-safety');
    }
    
    // Add world templates
    if (bundle.world.lore) {
      segments.push(bundle.world.lore);
      templateIds.push('world-lore');
    }
    if (bundle.world.logic) {
      segments.push(bundle.world.logic);
      templateIds.push('world-logic');
    }
    if (bundle.world.style) {
      segments.push(bundle.world.style);
      templateIds.push('world-style');
    }
    
    // Add adventure templates if available
    if (bundle.adventures) {
      for (const [slug, content] of Object.entries(bundle.adventures)) {
        segments.push(content);
        templateIds.push(`adventure-${slug}`);
      }
    }
    
    // Create the final prompt
    const prompt = this.createFinalPrompt(segments, context);
    
    // Create audit entry
    const audit: PromptAuditEntry = {
      templateIds,
      version: '1.0.0',
      hash: this.createHash(segments.join('|')),
      contextSummary: {
        world: context.world.name,
        adventure: context.adventure?.name || 'None',
        character: context.character?.name || 'Guest',
        turnIndex: context.game.turn_index,
      },
      tokenCount: this.estimateTokenCount(prompt),
      assembledAt: new Date().toISOString(),
    };

    return {
      prompt,
      audit,
      metadata: {
        totalSegments: segments.length,
        totalVariables: this.countVariables(context),
        loadOrder: templateIds,
        warnings: undefined,
      },
    };
  }

  /**
   * Create the final prompt from assembled segments
   */
  private createFinalPrompt(segments: string[], context: PromptContext): string {
    const header = this.createPromptHeader(context);
    const body = segments.join('\n\n');
    const footer = this.createPromptFooter(context);
    
    return `${header}\n\n${body}\n\n${footer}`.trim();
  }

  /**
   * Create prompt header with context summary
   */
  private createPromptHeader(context: PromptContext): string {
    const characterInfo = context.character 
      ? `${context.character.name} (Level ${context.character.level} ${context.character.race} ${context.character.class})`
      : 'Guest Player';
    
    return `# RPG Storyteller AI System

## Current Context
- **World**: ${context.world.name}
- **Player**: ${characterInfo}
- **Adventure**: ${context.adventure?.name || 'None'}
- **Scene**: ${context.game.current_scene || 'Unknown'}
- **Turn**: ${context.game.turn_index + 1}
- **Schema Version**: ${context.system.schema_version}

## Instructions
You are an AI Game Master operating within the RPG Storyteller system. Follow the rules and guidelines below to generate appropriate responses.`;
  }

  /**
   * Create prompt footer with output requirements
   */
  private createPromptFooter(context: PromptContext): string {
    return `## Output Requirements

Return a single JSON object in AWF v1 format with the following structure:

\`\`\`json
{
  "scn": {
    "id": "scene_id",
    "ph": "scene_phase"
  },
  "txt": "Narrative text describing what happens",
  "choices": [
    {
      "id": "choice_id",
      "label": "Choice text"
    }
  ],
  "acts": [
    {
      "eid": "action_id",
      "t": "ACTION_TYPE",
      "payload": {}
    }
  ],
  "val": {
    "ok": true,
    "errors": [],
    "repairs": []
  }
}
\`\`\`

Remember: Keep responses immersive, consistent with the world's tone, and appropriate for the character's level and situation.`;
  }

  /**
   * Create a hash from a string
   */
  private createHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate token count for a prompt (public method for use by other services)
   */
  calculateTokenCount(prompt: string): number {
    return this.estimateTokenCount(prompt);
  }

  /**
   * Count variables in context object
   */
  private countVariables(context: PromptContext): number {
    // Simple count of non-undefined values
    let count = 0;
    if (context.character) count++;
    if (context.game) count++;
    if (context.world) count++;
    if (context.adventure) count++;
    if (context.runtime) count++;
    if (context.system) count++;
    return count;
  }


  /**
   * Validate that a prompt response matches the expected schema
   * @param response - The AI response to validate
   * @param schemaVersion - The schema version to validate against
   * @returns True if valid, false otherwise
   */
  validateResponse(response: any, schemaVersion: string = '1.0.0'): boolean {
    try {
      if (schemaVersion.startsWith('1.0')) {
        return this.validateV1Response(response);
      }

      return this.validateV1Response(response);
    } catch (error) {
      console.error('Error validating response:', error);
      return false;
    }
  }

  private validateV1Response(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Check required fields
    const requiredFields = ['narrative', 'emotion'];
    for (const field of requiredFields) {
      if (!(field in response) || typeof response[field] !== 'string') {
        return false;
      }
    }

    // Validate emotion enum
    const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited'];
    if (!validEmotions.includes(response.emotion)) {
      return false;
    }

    // Validate optional arrays
    if (response.npcResponses && !Array.isArray(response.npcResponses)) {
      return false;
    }

    if (response.suggestedActions && !Array.isArray(response.suggestedActions)) {
      return false;
    }

    // Validate worldStateChanges
    if (response.worldStateChanges && typeof response.worldStateChanges !== 'object') {
      return false;
    }

    return true;
  }

  // Admin CRUD operations for versioned prompt management

  /**
   * Get all prompts with optional filters
   */
  static async getAllPrompts(filters?: {
    scope?: 'world' | 'scenario' | 'adventure' | 'quest';
    slug?: string;
    active?: boolean;
  }): Promise<Prompt[]> {
    try {
      let query = supabaseAdmin.from('prompts').select('*').order('created_at', { ascending: false });

      if (filters?.scope) {
        query = query.eq('scope', filters.scope);
      }
      if (filters?.slug) {
        query = query.eq('slug', filters.slug);
      }
      if (filters?.active !== undefined) {
        query = query.eq('active', filters.active);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching prompts:', error);
      throw error;
    }
  }

  /**
   * Create a new prompt version (auto-increments version, sets active)
   */
  static async createPrompt(input: {
    slug: string;
    scope: 'world' | 'scenario' | 'adventure' | 'quest';
    content: string;
    metadata?: Record<string, unknown>;
    active?: boolean;
    createdBy?: string;
  }): Promise<Prompt> {
    try {
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .insert({
          slug: input.slug,
          scope: input.scope,
          content: input.content,
          metadata: input.metadata || {},
          active: input.active || false,
          created_by: input.createdBy,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  }

  /**
   * Update prompt metadata (e.g., active flag)
   */
  static async updatePrompt(
    id: string,
    updates: {
      content?: string;
      metadata?: Record<string, unknown>;
      active?: boolean;
    }
  ): Promise<Prompt> {
    try {
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error(`Prompt not found: ${id}`);
      }

      return data;
    } catch (error) {
      console.error(`Error updating prompt ${id}:`, error);
      throw error;
    }
  }

  /**
   * Soft delete a prompt (deactivate)
   */
  static async deletePrompt(id: string): Promise<Prompt> {
    try {
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .update({ active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error(`Prompt not found: ${id}`);
      }

      return data;
    } catch (error) {
      console.error(`Error deleting prompt ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get the active prompt for a given slug and scope
   */
  static async getActivePrompt(
    slug: string,
    scope: 'world' | 'scenario' | 'adventure' | 'quest'
  ): Promise<Prompt | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('slug', slug)
        .eq('scope', scope)
        .eq('active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching active prompt for ${slug}/${scope}:`, error);
      throw error;
    }
  }

  /**
   * Get all versions of a prompt by slug and scope
   */
  static async getPromptVersions(
    slug: string,
    scope: 'world' | 'scenario' | 'adventure' | 'quest'
  ): Promise<Prompt[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('slug', slug)
        .eq('scope', scope)
        .order('version', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error fetching prompt versions for ${slug}/${scope}:`, error);
      throw error;
    }
  }

  /**
   * Create initial prompt for a new game with approval mechanism
   * @param gameId - Game ID
   * @param worldId - World ID
   * @param characterId - Character ID (optional)
   * @returns Object with prompt and approval status
   */
  async createInitialPromptWithApproval(
    gameId: string,
    worldId: string,
    characterId?: string
  ): Promise<{
    prompt: string;
    needsApproval: boolean;
    promptId: string;
    metadata: {
      worldId: string;
      characterId?: string;
      turnIndex: number;
      tokenCount: number;
    };
  }> {
    try {
      // Build game context for initial prompt
      const gameContext: GameContext = {
        id: gameId,
        world_id: worldId,
        character_id: characterId,
        state_snapshot: {},
        turn_index: 0,
      };

      // Create the initial prompt
      const prompt = await this.createInitialPrompt(gameContext);
      
      // Get AI config to check if approval is required
      const aiConfig = configService.getAi();
      const needsApproval = aiConfig.requirePromptApproval || false;
      
      // Generate a unique prompt ID for tracking
      const promptId = `initial_${gameId}_${Date.now()}`;
      
      // Estimate token count (rough approximation)
      const tokenCount = Math.ceil(prompt.length / 4);
      
      return {
        prompt,
        needsApproval,
        promptId,
        metadata: {
          worldId,
          characterId,
          turnIndex: 0,
          tokenCount,
        },
      };
    } catch (error) {
      console.error('Error creating initial prompt with approval:', error);
      throw new Error(`Failed to create initial prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve a prompt for AI processing
   * @param promptId - Prompt ID to approve
   * @param approved - Whether the prompt is approved
   * @returns Success status
   */
  async approvePrompt(promptId: string, approved: boolean): Promise<{ success: boolean; message: string }> {
    try {
      // Log the approval decision
      console.log(`[PROMPTS] Prompt ${promptId} ${approved ? 'approved' : 'rejected'}`);
      
      // In a real implementation, this would update a database record
      // For now, we just log the decision
      
      return {
        success: true,
        message: `Prompt ${approved ? 'approved' : 'rejected'} successfully`,
      };
    } catch (error) {
      console.error('Error approving prompt:', error);
      return {
        success: false,
        message: 'Failed to process approval',
      };
    }
  }
}

export const promptsService = new PromptsService();
