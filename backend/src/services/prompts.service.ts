import { supabaseAdmin } from './supabase.js';
import { configService } from '../config/index.js';
import type { Character, WorldTemplate, Prompt } from 'shared';

export interface GameContext {
  id: string;
  world_id: string;
  character_id?: string;
  state_snapshot: any;
  turn_index: number;
}

export class PromptsService {
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

      // Build the prompt based on schema version
      return this.buildPromptByVersion(schemaVersion, {
        game,
        worldTemplate,
        character,
        optionId,
      });
    } catch (error) {
      console.error('Error building prompt:', error);
      throw new Error(`Failed to build prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadWorldTemplate(worldId: string): Promise<WorldTemplate | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('world_templates')
        .select('*')
        .eq('id', worldId)
        .single();

      if (error) {
        console.error('Error loading world template:', error);
        return null;
      }

      return data;
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

  private buildPromptByVersion(
    version: string,
    context: {
      game: GameContext;
      worldTemplate: WorldTemplate;
      character: Character | null;
      optionId: string;
    }
  ): string {
    const { game, worldTemplate, character, optionId } = context;

    // Version 1.0.0 prompt format
    if (version.startsWith('1.0')) {
      return this.buildV1Prompt(game, worldTemplate, character, optionId);
    }

    // Default to latest version
    return this.buildV1Prompt(game, worldTemplate, character, optionId);
  }

  private buildV1Prompt(
    game: GameContext,
    worldTemplate: WorldTemplate,
    character: Character | null,
    optionId: string
  ): string {
    const characterInfo = character
      ? `${character.name} (Level ${character.level} ${character.race} ${character.class})`
      : 'Guest Player';

    const worldRules = worldTemplate.rules;
    const currentState = game.state_snapshot || {};
    const turnNumber = game.turn_index + 1;

    return `You are an AI Game Master for "${worldTemplate.name}", a ${worldTemplate.genre} role-playing game.

WORLD CONTEXT:
- Setting: ${worldTemplate.setting}
- Genre: ${worldTemplate.genre}
- Themes: ${worldTemplate.themes.join(', ')}
- Rules: ${JSON.stringify(worldRules)}

CHARACTER CONTEXT:
- Player: ${characterInfo}
- Current Scene: ${currentState.currentScene || 'Unknown'}
- Turn: ${turnNumber}

GAME STATE:
${JSON.stringify(currentState, null, 2)}

PLAYER ACTION:
The player has chosen option ID: ${optionId}

INSTRUCTIONS:
1. Generate a narrative response that advances the story
2. Consider the world's themes, rules, and current state
3. Make NPCs react believably based on their personalities
4. Update the world state appropriately
5. Provide 2-3 suggested next actions

RESPONSE FORMAT (JSON):
{
  "narrative": "string - the story text describing what happens",
  "emotion": "neutral|happy|sad|angry|fearful|surprised|excited",
  "npcResponses": [
    {
      "npcId": "string",
      "response": "string - what the NPC says/does",
      "emotion": "string"
    }
  ],
  "worldStateChanges": {
    "key": "value - updates to world state"
  },
  "suggestedActions": [
    "string - suggested player actions"
  ]
}

Remember: Keep responses immersive, consistent with the world's tone, and appropriate for the character's level and situation.`;
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
}

export const promptsService = new PromptsService();
