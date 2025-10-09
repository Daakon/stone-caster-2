import { configService } from '../config/index.js';
import { promptsService } from './prompts.service.js';
import { OpenAIService } from './openai.service.js';
import { PromptWrapper, type GameStateData } from '../prompts/wrapper.js';
import type { AIResponse, StoryAction, GameSave, Character } from '@shared';
import { SCENE_IDS, ADVENTURE_IDS, WORLD_IDS } from '../constants/game-constants.js';
import { GameConfigService } from './game-config.service.js';

const env = configService.getEnv();

interface StoryContext {
  gameSave: GameSave;
  character: Character;
  action: StoryAction;
}

export class AIService {
  private openaiService: OpenAIService | null = null;
  private promptWrapper: PromptWrapper;
  private gameConfigService: GameConfigService;

  constructor() {
    this.promptWrapper = new PromptWrapper();
    this.gameConfigService = GameConfigService.getInstance();
    
    // Initialize OpenAI service lazily when first needed
    this.initializeOpenAIService();
  }

  private initializeOpenAIService(): void {
    try {
      this.openaiService = new OpenAIService();
    } catch (error) {
      console.warn('OpenAI service not available:', error instanceof Error ? error.message : String(error));
      this.openaiService = null;
    }
  }

  private getOpenAIService(): OpenAIService {
    if (!this.openaiService) {
      this.initializeOpenAIService();
      if (!this.openaiService) {
        throw new Error('OpenAI service not available. Check OPENAI_API_KEY environment variable.');
      }
    }
    return this.openaiService;
  }

  // Legacy methods removed - using new prompt wrapper system instead

  /**
   * Generate a turn response using the new prompt wrapper and OpenAI service
   */
  async generateTurnResponse(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}> = [],
    includeDebug: boolean = false
  ): Promise<{response: string, debug?: any}> {
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
        
        const testResponse: any = {
          narrative: 'The world seems to pause for a moment as reality stabilizes... This is a test response while the prompt engine is being validated.',
          emotion: 'neutral',
          choices: [
            { id: choice1Id, label: 'Look around' },
            { id: choice2Id, label: 'Continue forward' },
            { id: choice3Id, label: 'Check inventory' }
          ]
        };
        
        if (includeDebug) {
          testResponse.debug = {
            promptState: { gameContext, optionId, choices },
            promptText: 'Test mode - no AI call made',
            aiResponseRaw: 'Test response',
            processingTime: 0,
            tokenCount: 0,
            testMode: true
          };
        }
        
        return {
          response: JSON.stringify(testResponse),
          debug: includeDebug ? testResponse.debug : undefined
        };
      }

      // Build prompt using the new wrapper system
      const prompt = await this.buildWrappedPrompt(gameContext, optionId, choices);
      
      // Validate prompt before sending to AI
      if (!prompt || prompt.length < 100) {
        console.error(`[AI_SERVICE] CRITICAL: Prompt too short (${prompt.length} characters), aborting AI call`);
        throw new Error(`Prompt too short: ${prompt.length} characters`);
      }
      
      // Check for truly empty data sections in the prompt
      if (prompt.includes('{"adventure":{}}') && prompt.includes('=== ADVENTURE_BEGIN ===')) {
        console.error(`[AI_SERVICE] CRITICAL: Adventure section is empty, aborting AI call`);
        console.error(`[AI_SERVICE] Adventure section content:`, prompt.match(/=== ADVENTURE_BEGIN ===[\s\S]*?=== ADVENTURE_END ===/)?.[0]);
        throw new Error(`Adventure section is empty - aborting AI call to prevent waste`);
      }
      
      if (prompt.includes('{"player":{}}') && prompt.includes('=== PLAYER_BEGIN ===')) {
        console.error(`[AI_SERVICE] CRITICAL: Player section is empty, aborting AI call`);
        console.error(`[AI_SERVICE] Player section content:`, prompt.match(/=== PLAYER_BEGIN ===[\s\S]*?=== PLAYER_END ===/)?.[0]);
        throw new Error(`Player section is empty - aborting AI call to prevent waste`);
      }
      
      // Log the full prompt for debugging
      console.log(`[AI_SERVICE] Full prompt being sent to AI (${prompt.length} characters):`);
      console.log('='.repeat(80));
      console.log(prompt);
      console.log('='.repeat(80));
      
      // Capture debug information if requested
      const debugInfo: any = {};
      if (includeDebug) {
        debugInfo.promptState = {
          gameContext,
          optionId,
          choices,
          timestamp: new Date().toISOString(),
        };
        debugInfo.promptText = prompt;
      }
      
      const startTime = Date.now();
      
      // Generate response with OpenAI service
      const openaiService = this.getOpenAIService();
      const response = await openaiService.generateBufferedResponse(prompt);
      
      const processingTime = Date.now() - startTime;
      
      // Parse and validate response
      try {
        const parsed = openaiService.parseAIResponse(response.content);
        
        if (includeDebug) {
          debugInfo.aiResponseRaw = response.content;
          debugInfo.processingTime = processingTime;
          debugInfo.tokenCount = response.usage?.total_tokens;
        }
        
        return {
          response: JSON.stringify(parsed),
          debug: includeDebug ? debugInfo : undefined
        };
      } catch (parseError) {
        console.error('[AI_SERVICE] Failed to parse AI response, attempting repair...');
        
        // Attempt JSON repair
        try {
          const repaired = await openaiService.repairJSONResponse(response.content, prompt);
          
          if (includeDebug) {
            debugInfo.aiResponseRaw = response.content;
            debugInfo.processingTime = processingTime;
            debugInfo.tokenCount = response.usage?.total_tokens;
            debugInfo.repairAttempted = true;
          }
          
          return {
            response: JSON.stringify(repaired),
            debug: includeDebug ? debugInfo : undefined
          };
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
      
      // Return a fallback JSON response with TurnResponseSchema format
      const fallbackResponse: any = {
        narrative: 'The world seems to pause for a moment as reality stabilizes...',
        emotion: 'neutral',
        choices: [
          { id: choice1Id, label: 'Look around' },
          { id: choice2Id, label: 'Continue forward' },
          { id: choice3Id, label: 'Check inventory' }
        ]
      };
      
      if (includeDebug) {
        fallbackResponse.debug = {
          promptState: { gameContext, optionId, choices },
          promptText: 'Fallback response - no AI call made',
          aiResponseRaw: 'Fallback response',
          processingTime: 0,
          tokenCount: 0,
          fallback: true,
          error: error instanceof Error ? error.message : String(error)
        };
      }
      
      return {
        response: JSON.stringify(fallbackResponse),
        debug: includeDebug ? fallbackResponse.debug : undefined
      };
    }
  }

  /**
   * Validate that the input section contains proper adventure information for first turn
   */
  private validateInputSection(playerInput: string, isFirstTurn: boolean): { valid: boolean; error?: string } {
    if (!isFirstTurn) {
      return { valid: true };
    }

    // For first turn, must contain proper adventure format
    const expectedPattern = /Begin the adventure "adventure_[^"]+" from its starting scene "\w+"/;
    
    if (!expectedPattern.test(playerInput)) {
      return {
        valid: false,
        error: `Invalid first turn input format. Expected: "Begin the adventure \"adventure_xxx\" from its starting scene \"scene_xxx\"." Got: "${playerInput}"`
      };
    }

    return { valid: true };
  }

  /**
   * Load adventure start JSON data for initial prompts
   * @param worldId - World ID
   * @param adventureName - Adventure name
   * @returns Adventure start data or null if not found
   */
  private async loadAdventureStartData(worldId: string, adventureName: string): Promise<any | null> {
    console.log(`[AI_SERVICE] Loading adventure start data for world: ${worldId}, adventure: ${adventureName}`);
    
    try {
      // Handle different adventure ID formats - map to actual directory name
      let adventurePath = adventureName;
      if (adventureName === ADVENTURE_IDS.WHISPERCROSS) {
        adventurePath = 'whispercross'; // Map to actual directory name
      }
      
      // Try to load from the file-based template system first
      const possiblePaths = [
        `backend/AI API Prompts/worlds/${worldId}/adventures/${adventurePath}/adventure.start.prompt.json`,
        `backend/AI API Prompts/worlds/${worldId}/adventures/${adventurePath}/adventure.prompt.json`,
        `AI API Prompts/worlds/${worldId}/adventures/${adventurePath}/adventure.start.prompt.json`,
        `AI API Prompts/worlds/${worldId}/adventures/${adventurePath}/adventure.prompt.json`,
      ];

      for (const path of possiblePaths) {
        try {
          const { readFileSync } = await import('fs');
          const { join } = await import('path');
          const fullPath = join(process.cwd(), path);
          console.log(`[AI_SERVICE] Attempting to load from: ${fullPath}`);
          const content = readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(content);
          console.log(`[AI_SERVICE] Successfully loaded adventure start data from ${path}`);
          return data;
        } catch (error) {
          console.log(`[AI_SERVICE] Failed to load from ${path}: ${error}`);
          // Continue to next path
        }
      }

      console.log(`[AI_SERVICE] No adventure start data found for ${worldId}/${adventureName}`);
      return null;
    } catch (error) {
      console.error(`[AI_SERVICE] Error loading adventure start data: ${error}`);
      return null;
    }
  }

  /**
   * Map scene names to adventure names using dynamic configuration
   */
  private async mapSceneToAdventure(worldId: string, sceneId: string): Promise<string> {
    try {
      // Try to get adventure from actual configuration
      const adventureId = await this.gameConfigService.getAdventureForScene(worldId as any, sceneId);
      if (adventureId) {
        return adventureId;
      }
    } catch (error) {
      console.warn(`[AI_SERVICE] Could not load dynamic mapping for ${worldId}:${sceneId}:`, error);
    }

    // Fallback to hardcoded mapping for now
    const worldAdventureMap: Record<string, Record<string, string>> = {
      [WORLD_IDS.MYSTIKA]: {
        [SCENE_IDS.DEFAULT_START]: ADVENTURE_IDS.WHISPERCROSS,
        'whispercross': ADVENTURE_IDS.WHISPERCROSS,
        'outer_paths_meet_kiera_01': ADVENTURE_IDS.WHISPERCROSS
      }
    };

    const worldMap = worldAdventureMap[worldId];
    if (worldMap && worldMap[sceneId]) {
      return worldMap[sceneId];
    }

    // Default to the scene ID if no mapping exists
    return sceneId;
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
    const isFirstTurn = gameContext.turn_index === 0;
    const startingScene = gameContext.current_scene;
    
    // Map scene to adventure name using the same logic as prompts service
    const adventureName = await this.mapSceneToAdventure(gameContext.world_id, startingScene);
    
    // Debug logging to see what we're getting
    console.log(`[AI_SERVICE] Building prompt for turn ${gameContext.turn_index}:`, {
      isFirstTurn,
      adventureName,
      startingScene,
      worldId: gameContext.world_id,
      adventureObject: gameContext.adventure
    });
    
    // Load adventure start data for first turn
    let adventureStartData = null;
    if (isFirstTurn) {
      try {
        adventureStartData = await this.loadAdventureStartData(gameContext.world_id, adventureName);
        console.log(`[AI_SERVICE] Loaded adventure start data:`, {
          hasData: !!adventureStartData,
          start: adventureStartData?.start,
          title: adventureStartData?.title
        });
      } catch (error) {
        console.warn(`[AI_SERVICE] Could not load adventure start data: ${error}`);
      }
    }
    
    const playerInput = this.promptWrapper.resolvePlayerInput(
      optionId, 
      choices, 
      isFirstTurn, 
      adventureName, 
      startingScene,
      adventureStartData
    );
    
    // HARD STOP: Validate input section for first turn
    const validation = this.validateInputSection(playerInput, isFirstTurn);
    if (!validation.valid) {
      console.error(`[AI_SERVICE] HARD STOP - Input validation failed: ${validation.error}`);
      console.error(`[AI_SERVICE] Generated playerInput: "${playerInput}"`);
      console.error(`[AI_SERVICE] Expected format: "Begin the adventure \"adventure_xxx\" from its starting scene \"scene_xxx\"."`);
      throw new Error(`HARD STOP - Invalid prompt input: ${validation.error}`);
    }
    
    console.log(`[AI_SERVICE] Input validation passed for turn ${gameContext.turn_index}:`, {
      playerInput,
      isFirstTurn,
      adventureName,
      startingScene
    });
    
    // Generate game state data
    const rngData = this.promptWrapper.generateRNGData();
    const timeData = this.promptWrapper.generateTimeData(gameContext.turn_index || 0);
    
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
