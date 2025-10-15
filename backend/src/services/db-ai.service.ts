import { configService } from '../config/index.js';
import { DatabasePromptService } from './db-prompt.service.js';
import { OpenAIService } from './openai.service.js';
import type { AIResponse } from '@shared';
import { GameConfigService } from './game-config.service.js';

const env = configService.getEnv();

/**
 * Database-backed AI service that replaces filesystem-based prompt loading
 * This service provides prompt assembly using database segments instead of filesystem files
 */
export class DatabaseAIService {
  private openaiService: OpenAIService | null = null;
  private promptService: DatabasePromptService;
  private gameConfigService: GameConfigService;

  constructor() {
    this.promptService = new DatabasePromptService();
    this.gameConfigService = GameConfigService.getInstance();
    
    // Initialize OpenAI service lazily when first needed
    this.initializeOpenAIService();
  }

  /**
   * Initialize OpenAI service
   */
  private initializeOpenAIService(): void {
    try {
      this.openaiService = new OpenAIService();
      console.log('[DB_AI_SERVICE] OpenAI service initialized');
    } catch (error) {
      console.error('[DB_AI_SERVICE] Failed to initialize OpenAI service:', error);
    }
  }

  /**
   * Assemble a prompt using database segments
   * This method can be used by existing AI services to get database-backed prompts
   */
  async assemblePrompt(context: any): Promise<{ prompt: string; metadata: any }> {
    console.log(`[DB_AI_SERVICE] Assembling prompt for world: ${context.world?.name || 'unknown'}`);

    try {
      // Assemble prompt using database segments
      const promptResult = await this.promptService.assemblePrompt(context);
      
      console.log(`[DB_AI_SERVICE] Assembled prompt with ${promptResult.metadata.totalSegments} segments, ${promptResult.audit.tokenCount} tokens`);
      
      return {
        prompt: promptResult.prompt,
        metadata: promptResult.metadata
      };
    } catch (error) {
      console.error('[DB_AI_SERVICE] Error assembling prompt:', error);
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
    return this.promptService.getPromptStats();
  }

  /**
   * Validate prompt dependencies
   */
  async validateDependencies(): Promise<Array<{
    prompt_id: string;
    missing_dependencies: string[];
  }>> {
    return this.promptService.validateDependencies();
  }

  /**
   * Clear prompt cache
   */
  clearCache(): void {
    this.promptService.clearCache();
  }
}
