import { configService } from '../config/index.js';
import { promptsService } from './prompts.service.js';
import { OpenAIService } from './openai.service.js';
import { PromptWrapper, type GameStateData } from '../prompts/wrapper.js';
import type { AIResponse, StoryAction, GameSave, Character } from '@shared';

const env = configService.getEnv();

interface StoryContext {
  gameSave: GameSave;
  character: Character;
  action: StoryAction;
}

export class AIService {
  private openaiService: OpenAIService;
  private promptWrapper: PromptWrapper;

  constructor() {
    this.openaiService = new OpenAIService();
    this.promptWrapper = new PromptWrapper();
  }

  // Legacy methods removed - using new prompt wrapper system instead

  /**
   * Generate a turn response using the new prompt wrapper and OpenAI service
   */
  async generateTurnResponse(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}> = []
  ): Promise<string> {
    try {
      console.log('[AI_SERVICE] Starting turn response generation with new wrapper...');
      
      // Check if we're in test mode (no real AI API calls)
      const env = configService.getEnv();
      if (!env.openaiApiKey || env.openaiApiKey.includes('your_ope')) {
        console.log('[AI_SERVICE] Test mode: OpenAI API key not configured, returning test response');
        
        // Generate proper UUIDs for test choices
        const { v4: uuidv4 } = await import('uuid');
        const choice1Id = uuidv4();
        const choice2Id = uuidv4();
        const choice3Id = uuidv4();
        
        return JSON.stringify({
          scn: { id: 'test-scene', ph: 'active' },
          txt: 'The world seems to pause for a moment as reality stabilizes... This is a test response while the prompt engine is being validated.',
          choices: [
            { id: choice1Id, label: 'Look around' },
            { id: choice2Id, label: 'Continue forward' },
            { id: choice3Id, label: 'Check inventory' }
          ],
          acts: [],
          val: { ok: true, errors: [], repairs: [] }
        });
      }

      // Build prompt using the new wrapper system
      const prompt = await this.buildWrappedPrompt(gameContext, optionId, choices);
      
      // Generate response with OpenAI service
      const response = await this.openaiService.generateBufferedResponse(prompt);
      
      // Parse and validate response
      try {
        const parsed = this.openaiService.parseAIResponse(response.content);
        return JSON.stringify(parsed);
      } catch (parseError) {
        console.error('[AI_SERVICE] Failed to parse AI response, attempting repair...');
        
        // Attempt JSON repair
        try {
          const repaired = await this.openaiService.repairJSONResponse(response.content, prompt);
          return JSON.stringify(repaired);
        } catch (repairError) {
          console.error('[AI_SERVICE] JSON repair failed:', repairError);
          throw new Error('Failed to parse or repair AI response');
        }
      }
    } catch (error) {
      console.error('[AI_SERVICE] Error generating turn response:', error);
      
      // Generate proper UUIDs for fallback choices
      const { v4: uuidv4 } = await import('uuid');
      const choice1Id = uuidv4();
      const choice2Id = uuidv4();
      const choice3Id = uuidv4();
      
      // Return a fallback JSON response with AWF format
      return JSON.stringify({
        scn: { id: 'fallback-scene', ph: 'active' },
        txt: 'The world seems to pause for a moment as reality stabilizes...',
        choices: [
          { id: choice1Id, label: 'Look around' },
          { id: choice2Id, label: 'Continue forward' },
          { id: choice3Id, label: 'Check inventory' }
        ],
        acts: [],
        val: { ok: true, errors: [], repairs: [] }
      });
    }
  }

  /**
   * Build wrapped prompt using the new prompt wrapper system
   */
  private async buildWrappedPrompt(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}>
  ): Promise<string> {
    // Resolve player input to text
    const playerInput = this.promptWrapper.resolvePlayerInput(optionId, choices);
    
    // Generate game state data
    const rngData = this.promptWrapper.generateRNGData();
    const timeData = this.promptWrapper.generateTimeData(gameContext.turn_index || 0);
    const isFirstTurn = gameContext.turn_index === 0;
    
    const gameState: GameStateData = {
      time: timeData,
      rng: rngData,
      playerInput,
      isFirstTurn,
    };

    // Build context for prompt assembly
    const context = {
      game: {
        id: gameContext.id,
        turn_index: gameContext.turn_index || 0,
        summary: `Turn ${(gameContext.turn_index || 0) + 1} | World: ${gameContext.world_id} | Character: ${gameContext.character_id || 'Guest'}`,
        current_scene: gameContext.current_scene || 'unknown',
        state_snapshot: gameContext.state_snapshot,
        option_id: optionId,
      },
      world: {
        name: gameContext.world_id || 'unknown',
        setting: 'A world of magic and adventure',
        genre: 'fantasy',
        themes: ['magic', 'adventure', 'mystery'],
        rules: {},
        mechanics: {},
        lore: '',
        logic: {},
      },
      character: gameContext.character || {},
      adventure: gameContext.adventure || {},
      runtime: {
        ticks: gameContext.turn_index || 0,
        presence: 'present',
        ledgers: {},
        flags: {},
        last_acts: [],
        style_hint: 'neutral',
      },
      system: {
        schema_version: '1.0.0',
        prompt_version: '2.0.0',
        load_order: [],
        hash: 'wrapper-v1',
      },
    };

    // Assemble prompt using wrapper
    const result = await this.promptWrapper.assemblePrompt(
      context,
      gameState,
      { core: 'system' }, // Core data
      { world: context.world }, // World data
      { adventure: context.adventure }, // Adventure data
      { player: context.character } // Player data
    );

    return result.prompt;
  }
}

export const aiService = new AIService();
