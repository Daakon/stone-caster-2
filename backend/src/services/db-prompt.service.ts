import { createClient } from '@supabase/supabase-js';
import { PromptRepository } from '../repositories/prompt.repository.js';
import { DatabasePromptAssembler } from '../prompts/db-assembler.js';
import type { PromptContext, PromptAssemblyResult } from '../prompts/schemas.js';

/**
 * Database-backed prompt service that replaces filesystem-based loading
 */
export class DatabasePromptService {
  private promptRepository: PromptRepository;
  private promptAssembler: DatabasePromptAssembler;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    }

    this.promptRepository = new PromptRepository(supabaseUrl, supabaseKey);
    this.promptAssembler = new DatabasePromptAssembler(this.promptRepository);
  }

  /**
   * Assemble a complete prompt for the given context
   */
  async assemblePrompt(context: PromptContext): Promise<PromptAssemblyResult> {
    console.log(`[DB_PROMPT_SERVICE] Assembling prompt for world: ${context.world.name}`);
    
    try {
      // Validate context
      const validation = this.promptAssembler.validateContext(context);
      if (!validation.valid) {
        throw new Error(`Invalid context: missing ${validation.missing.join(', ')}`);
      }

      // Assemble prompt using database segments
      const result = await this.promptAssembler.assemblePrompt(context);
      
      console.log(`[DB_PROMPT_SERVICE] Successfully assembled prompt with ${result.metadata.totalSegments} segments`);
      return result;
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error assembling prompt:', error);
      throw error;
    }
  }

  /**
   * Get core system prompts
   */
  async getCorePrompts(): Promise<any[]> {
    try {
      const segments = await this.promptRepository.getCorePrompts();
      return segments.map(segment => ({
        id: segment.id,
        layer: segment.layer,
        content: segment.content,
        metadata: segment.metadata,
      }));
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error getting core prompts:', error);
      throw error;
    }
  }

  /**
   * Get world-specific prompts
   */
  async getWorldPrompts(worldSlug: string): Promise<any[]> {
    try {
      const segments = await this.promptRepository.getWorldPrompts(worldSlug);
      return segments.map(segment => ({
        id: segment.id,
        layer: segment.layer,
        content: segment.content,
        metadata: segment.metadata,
      }));
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error getting world prompts:', error);
      throw error;
    }
  }

  /**
   * Get adventure-specific prompts
   */
  async getAdventurePrompts(worldSlug: string, adventureSlug: string, includeStart: boolean = true): Promise<any[]> {
    try {
      const segments = await this.promptRepository.getAdventurePrompts(worldSlug, adventureSlug, includeStart);
      return segments.map(segment => ({
        id: segment.id,
        layer: segment.layer,
        content: segment.content,
        metadata: segment.metadata,
      }));
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error getting adventure prompts:', error);
      throw error;
    }
  }

  /**
   * Get prompt statistics
   */
  async getPromptStats(): Promise<{
    total_prompts: number;
    active_prompts: number;
    locked_prompts: number;
    layers_count: Record<string, number>;
    worlds_count: number;
  }> {
    try {
      return await this.promptRepository.getPromptStats();
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error getting prompt stats:', error);
      throw error;
    }
  }

  /**
   * Validate prompt dependencies
   */
  async validateDependencies(): Promise<Array<{
    prompt_id: string;
    missing_dependencies: string[];
  }>> {
    try {
      return await this.promptRepository.validateDependencies();
    } catch (error) {
      console.error('[DB_PROMPT_SERVICE] Error validating dependencies:', error);
      throw error;
    }
  }

  /**
   * Clear prompt cache
   */
  clearCache(): void {
    this.promptRepository.clearCache();
  }
}
