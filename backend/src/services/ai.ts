import { configService } from '../config/index.js';
import { promptsService } from './prompts.service.js';
import { OpenAIService } from './openai.service.js';
import { PromptWrapper, type GameStateData } from '../prompts/wrapper.js';
import { PromptAssembler } from '../prompts/assembler.js';
import { DatabasePromptService } from './db-prompt.service.js';
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
  private promptAssembler: PromptAssembler;
  private databasePromptService: DatabasePromptService | null = null;
  private gameConfigService: GameConfigService;

  constructor(databasePromptService?: DatabasePromptService) {
    this.promptWrapper = new PromptWrapper();
    this.promptAssembler = new PromptAssembler();
    this.databasePromptService = databasePromptService || null;
    this.gameConfigService = GameConfigService.getInstance();
    
    // Initialize OpenAI service lazily when first needed
    this.initializeOpenAIService();
  }

  private initializeOpenAIService(): void {
    try {
      this.openaiService = new OpenAIService();
      console.log('[AI_SERVICE] OpenAI service initialized successfully');
    } catch (error) {
      console.error('[AI_SERVICE] OpenAI service initialization failed:', error instanceof Error ? error.message : String(error));
      console.error('[AI_SERVICE] To fix this issue:');
      console.error('[AI_SERVICE] 1. Set OPENAI_API_KEY environment variable');
      console.error('[AI_SERVICE] 2. Create a .env file with: OPENAI_API_KEY=your_actual_api_key');
      console.error('[AI_SERVICE] 3. Or set it in your deployment environment');
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
  ): Promise<{response: string, debug?: any, promptData?: any, promptMetadata?: any, model?: string, tokenCount?: number, promptId?: string}> {
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
          debug: includeDebug ? testResponse.debug : undefined,
          promptData: null,
          promptMetadata: {
            sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
            tokenCount: 0,
            assembledAt: new Date().toISOString(),
            testMode: true
          },
          model: 'test-mode',
          tokenCount: 0,
          promptId: 'test-prompt-' + Date.now()
        };
      }

      // Build prompt using the new wrapper system
      const prompt = await this.buildWrappedPrompt(gameContext, optionId, choices);
      
      // Comprehensive prompt validation before sending to AI
      const validationResult = this.validatePromptCompleteness(prompt, gameContext);
      if (!validationResult.valid) {
        console.error(`[AI_SERVICE] CRITICAL: Prompt validation failed - ${validationResult.error}`);
        console.error(`[AI_SERVICE] Validation details:`, validationResult.details);
        throw new Error(`Prompt validation failed: ${validationResult.error}`);
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
        
        // Validate critical response fields
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('AI response is not a valid JSON object');
        }
        
        // Check for empty or invalid narrative
        if (!parsed.txt || typeof parsed.txt !== 'string' || parsed.txt.trim().length === 0) {
          throw new Error('AI response has empty or invalid narrative');
        }
        
        // Check for minimum narrative length (prevent very short responses)
        if (parsed.txt.trim().length < 10) {
          throw new Error('AI response narrative is too short');
        }
        
        // Check for required fields
        if (!parsed.scn || typeof parsed.scn !== 'string') {
          throw new Error('AI response missing required scene field');
        }
        
        if (includeDebug) {
          debugInfo.aiResponseRaw = response.content;
          debugInfo.processingTime = processingTime;
          debugInfo.tokenCount = response.usage?.total_tokens;
        }
        
        return {
          response: JSON.stringify(parsed),
          debug: includeDebug ? debugInfo : undefined,
          promptData: prompt,
          promptMetadata: {
            sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
            tokenCount: response.usage?.prompt_tokens || 0,
            assembledAt: new Date().toISOString(),
            length: prompt.length
          },
          model: 'gpt-4o-mini',
          tokenCount: response.usage?.total_tokens || 0,
          promptId: 'prompt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
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
            debug: includeDebug ? debugInfo : undefined,
            promptData: prompt,
            promptMetadata: {
              sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
              tokenCount: response.usage?.prompt_tokens || 0,
              assembledAt: new Date().toISOString(),
              length: prompt.length,
              repairAttempted: true
            },
            model: 'gpt-4o-mini',
            tokenCount: response.usage?.total_tokens || 0,
            promptId: 'prompt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          };
        } catch (repairError) {
          console.error('[AI_SERVICE] JSON repair failed:', repairError);
          throw new Error('Failed to parse or repair AI response');
        }
      }
    } catch (error) {
      console.error('[AI_SERVICE] Error generating turn response:', error);
      
      // Check if this is an OpenAI API key issue
      if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
        console.error('[AI_SERVICE] CRITICAL: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
        throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
      }
      
      // For any other error, throw it to prevent charging the user for failed AI responses
      console.error('[AI_SERVICE] CRITICAL: AI service failed - not charging user for failed response');
      throw new Error(`AI service failed: ${error instanceof Error ? error.message : String(error)}`);
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
    const expectedPattern = /Begin the adventure ".+" from its starting scene "\w+"/;
    
    if (!expectedPattern.test(playerInput)) {
      return {
        valid: false,
        error: `Invalid first turn input format. Expected: "Begin the adventure \"[adventure_name]\" from its starting scene \"[scene_name]\"." Got: "${playerInput}"`
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
   * Comprehensive prompt validation to ensure all required sections are present and valid
   */
  private validatePromptCompleteness(prompt: string, gameContext: any): { valid: boolean; error?: string; details?: any } {
    const validationDetails: any = {
      promptLength: prompt.length,
      sections: {},
      issues: []
    };

    // Check basic prompt requirements
    if (!prompt || prompt.length < 100) {
      validationDetails.issues.push(`Prompt too short: ${prompt.length} characters`);
      return { valid: false, error: 'Prompt too short', details: validationDetails };
    }

    // Define required sections and their validation rules
    const requiredSections = [
      { name: 'CORE', pattern: /=== CORE_BEGIN ===([\s\S]*?)=== CORE_END ===/ },
      { name: 'WORLD', pattern: /=== WORLD_BEGIN ===([\s\S]*?)=== WORLD_END ===/ },
      { name: 'ADVENTURE', pattern: /=== ADVENTURE_BEGIN ===([\s\S]*?)=== ADVENTURE_END ===/ },
      { name: 'PLAYER', pattern: /=== PLAYER_BEGIN ===([\s\S]*?)=== PLAYER_END ===/ },
      { name: 'RNG', pattern: /=== RNG_BEGIN ===([\s\S]*?)=== RNG_END ===/ },
      { name: 'INPUT', pattern: /=== INPUT_BEGIN ===([\s\S]*?)=== INPUT_END ===/ }
    ];

    // Validate each required section
    for (const section of requiredSections) {
      const match = prompt.match(section.pattern);
      if (!match) {
        validationDetails.issues.push(`Missing required section: ${section.name}`);
        validationDetails.sections[section.name] = { present: false, content: null };
        continue;
      }

      const content = match[1].trim();
      validationDetails.sections[section.name] = { present: true, content, length: content.length };

      // Section-specific validation
      if (section.name === 'CORE') {
        if (!content || content === '{}') {
          validationDetails.issues.push(`CORE section is empty`);
        }
      } else if (section.name === 'WORLD') {
        if (!content || content === '{}' || content.includes('"world":{}')) {
          validationDetails.issues.push(`WORLD section is empty`);
        }
      } else if (section.name === 'ADVENTURE') {
        if (!content || content === '{}' || content.includes('"adventure":{}')) {
          validationDetails.issues.push(`ADVENTURE section is empty`);
        }
      } else if (section.name === 'PLAYER') {
        if (!content || content === '{}' || content.includes('"player":{}')) {
          validationDetails.issues.push(`PLAYER section is empty`);
        }
      } else if (section.name === 'RNG') {
        if (!content || content === '{}') {
          validationDetails.issues.push(`RNG section is empty`);
        }
      } else if (section.name === 'INPUT') {
        if (!content || content.trim() === '') {
          validationDetails.issues.push(`INPUT section is empty`);
        }
      }
    }

    // Check for AI prompt file content (should not be just basic JSON)
    const hasAIPromptContent = this.checkForAIPromptContent(prompt);
    if (!hasAIPromptContent) {
      validationDetails.issues.push(`No AI prompt file content detected - prompt appears to be missing template data`);
    }

    // Check for minimum content requirements
    const minContentLength = 500; // Minimum expected content length
    if (prompt.length < minContentLength) {
      validationDetails.issues.push(`Prompt content too minimal (${prompt.length} chars, expected ${minContentLength}+)`);
    }

    const isValid = validationDetails.issues.length === 0;
    return {
      valid: isValid,
      error: isValid ? undefined : validationDetails.issues.join('; '),
      details: validationDetails
    };
  }

  /**
   * Check if prompt contains AI prompt file content (not just basic JSON)
   */
  private checkForAIPromptContent(prompt: string): boolean {
    // Look for signs of AI prompt file content - be more specific to avoid false positives
    const aiContentIndicators = [
      'You are the runtime engine',
      'Return ONE JSON object (AWF)',
      'TIME_ADVANCE (ticks ≥ 1)',
      'essence alignment affects behavior',
      'NPCs may act on their own',
      'Limit 2 ambient + 1 NPC↔NPC beat per turn',
      '60-tick bands (Dawn→Mid-Day→Evening→Mid-Night→Dawn)',
      'avoid real-world units'
    ];

    const foundIndicators = aiContentIndicators.filter(indicator => 
      prompt.toLowerCase().includes(indicator.toLowerCase())
    );

    // If we find at least 4 AI content indicators, we likely have proper prompt content
    return foundIndicators.length >= 4;
  }

  /**
   * Build prompt using database assembly or filesystem-based prompt assembly
   */
  private async buildWrappedPrompt(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}>
  ): Promise<string> {
    // Try database assembly first if available
    if (this.databasePromptService) {
      console.log(`[AI_SERVICE] Using database assembly for prompt`);
      return await this.buildDatabasePrompt(gameContext, optionId, choices);
    }

    // Fallback to filesystem-based assembly
    console.log(`[AI_SERVICE] Using filesystem-based assembly for prompt`);
    return await this.buildFilesystemPrompt(gameContext, optionId, choices);
  }

  /**
   * Build prompt using database assembly
   */
  private async buildDatabasePrompt(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}>
  ): Promise<string> {
    // Build context for database assembly
    const context = await this.buildDatabasePromptContext(gameContext, optionId, choices);
    
    // Use database prompt service
    const result = await this.databasePromptService!.assemblePrompt(context);
    
    // Validate that we got proper AI prompt content
    if (!result.prompt || result.prompt.length < 500) {
      console.error(`[AI_SERVICE] CRITICAL: Database prompt assembler returned insufficient content (${result.prompt?.length || 0} chars)`);
      throw new Error(`Database prompt assembler failed - content too minimal`);
    }

    console.log(`[AI_SERVICE] Database assembly completed with ${result.metadata.totalSegments} segments`);
    return result.prompt;
  }

  /**
   * Build prompt using filesystem-based assembly (legacy)
   */
  private async buildFilesystemPrompt(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}>
  ): Promise<string> {
    // Initialize the prompt assembler for the world
    await this.promptAssembler.initialize(gameContext.world_id);
    
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
      console.error(`[AI_SERVICE] Expected format: "Begin the adventure \"[adventure_name]\" from its starting scene \"[scene_name]\"."`);
      throw new Error(`HARD STOP - Invalid prompt input: ${validation.error}`);
    }
    
    console.log(`[AI_SERVICE] Input validation passed for turn ${gameContext.turn_index}:`, {
      playerInput,
      isFirstTurn,
      adventureName,
      startingScene
    });

    // Build context for prompt assembly using the proper assembler
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
        hash: 'assembler-v1',
      },
    };

    // Use the proper prompt assembler to load AI prompt files
    const result = await this.promptAssembler.assemblePrompt(context);
    
    // Validate that we got proper AI prompt content
    if (!result.prompt || result.prompt.length < 500) {
      console.error(`[AI_SERVICE] CRITICAL: Prompt assembler returned insufficient content (${result.prompt?.length || 0} chars)`);
      throw new Error(`Prompt assembler failed to load AI prompt files - content too minimal`);
    }

    return result.prompt;
  }

  /**
   * Build database prompt context
   */
  private async buildDatabasePromptContext(
    gameContext: any,
    optionId: string,
    choices: Array<{id: string, label: string}>
  ): Promise<any> {
    // Resolve player input to text
    const isFirstTurn = gameContext.turn_index === 0;
    const startingScene = gameContext.current_scene;
    
    // Map scene to adventure name using the same logic as prompts service
    const adventureName = await this.mapSceneToAdventure(gameContext.world_id, startingScene);
    
    // Load adventure start data for first turn
    let adventureStartData = null;
    if (isFirstTurn) {
      try {
        adventureStartData = await this.loadAdventureStartData(gameContext.world_id, adventureName);
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
    
    // Validate input section for first turn
    const validation = this.validateInputSection(playerInput, isFirstTurn);
    if (!validation.valid) {
      console.error(`[AI_SERVICE] HARD STOP - Input validation failed: ${validation.error}`);
      throw new Error(`HARD STOP - Invalid prompt input: ${validation.error}`);
    }

    // Build context for database assembly
    return {
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
        hash: 'database-v1',
      },
    };
  }
}

// Create database prompt service instance
const databasePromptService = new DatabasePromptService();

export const aiService = new AIService(databasePromptService);
