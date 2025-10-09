/**
 * Universal Adventure Service
 * 
 * Integrates the new adventure start system with existing AI and prompt services.
 * Provides backward compatibility while enabling AI-first narration.
 */

import { adventureStartService, type StartData, type AdventureStartError } from './adventure-start.service.js';
import { adventureInputParserService, type ParsedAdventureCommand } from './adventure-input-parser.service.js';

export interface UniversalAdventureContext {
  gameContext: any;
  optionId: string;
  choices: Array<{id: string, label: string}>;
  worldContext: any;
  playerContext: any;
  timeData: { band: string; ticks: number };
}

export interface UniversalAdventureResult {
  success: boolean;
  sceneId?: string;
  startData?: StartData;
  awf?: any;
  error?: AdventureStartError;
  needsAI: boolean;
}

export class UniversalAdventureService {
  /**
   * Process adventure start with universal system
   */
  async processAdventureStart(
    context: UniversalAdventureContext
  ): Promise<UniversalAdventureResult> {
    const { gameContext, optionId, choices } = context;
    const isFirstTurn = gameContext.turn_index === 0;

    // Parse the player input to understand the command
    const parsedCommand = adventureInputParserService.parseAdventureCommand(optionId);
    const validation = adventureInputParserService.validateParsedCommand(parsedCommand);

    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'ADVENTURE_START_UNRESOLVED',
          message: `Invalid command: ${validation.errors.join(', ')}`,
          availableAdventures: []
        },
        needsAI: false
      };
    }

    // Load and validate adventure data
    const adventure = await this.loadAdventureData(gameContext);
    if (!adventure) {
      return {
        success: false,
        error: {
          code: 'NO_ADVENTURE_PRESENT',
          message: 'No adventure available. Please load an adventure first.',
          availableAdventures: await this.getAvailableAdventures(gameContext.world_id)
        },
        needsAI: false
      };
    }

    // Validate adventure has required start structure
    let validatedAdventure;
    try {
      validatedAdventure = adventureStartService.validateAdventure(adventure);
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ADVENTURE_START_UNRESOLVED',
          message: `Invalid adventure format: ${error instanceof Error ? error.message : 'Unknown error'}`,
          availableAdventures: await this.getAvailableAdventures(gameContext.world_id)
        },
        needsAI: false
      };
    }

    // Resolve the starting scene
    const resolution = adventureStartService.resolveAdventureStart(
      validatedAdventure,
      parsedCommand.sceneId,
      await this.getAvailableAdventures(gameContext.world_id)
    );

    if ('code' in resolution) {
      return {
        success: false,
        error: resolution,
        needsAI: false
      };
    }

    const { sceneId, startData } = resolution;

    // For first turn, generate the AWF with AI-first narration
    if (isFirstTurn) {
      const sceneData = this.getSceneData(adventure, sceneId);
      const awf = adventureStartService.generateFirstTurnAWF(
        sceneId,
        startData,
        sceneData,
        context.worldContext,
        context.playerContext,
        context.timeData
      );

      return {
        success: true,
        sceneId,
        startData,
        awf,
        needsAI: true // AI will fill in the txt field
      };
    }

    // For subsequent turns, just return the resolved scene
    return {
      success: true,
      sceneId,
      startData,
      needsAI: true
    };
  }

  /**
   * Build AI context for first-turn narration
   */
  buildAIContextForFirstTurn(
    startData: StartData,
    sceneData: any,
    worldContext: any,
    playerContext: any,
    timeData: { band: string; ticks: number }
  ): any {
    return {
      // Scene context
      scene: {
        id: startData.scene,
        location: sceneData.location || 'unknown',
        description: sceneData.description || '',
        affordances: sceneData.affordances || [],
        type: sceneData.type || 'general'
      },
      
      // World context
      world: {
        name: worldContext.name || 'Unknown World',
        description: worldContext.description || '',
        tone: worldContext.tone || 'neutral',
        setting: worldContext.setting || 'fantasy'
      },
      
      // Player context
      player: {
        name: playerContext.name || 'Adventurer',
        background: playerContext.background || '',
        stats: playerContext.stats || {},
        personality: playerContext.personality || 'neutral'
      },
      
      // Start hints (soft guidance only)
      hints: startData.hints || [],
      
      // Time context
      time: {
        band: timeData.band,
        ticks: timeData.ticks,
        description: this.getTimeDescription(timeData.band)
      },
      
      // Policy for AI behavior
      policy: startData.policy,
      
      // Instructions for AI
      instructions: {
        style: 'ai_first',
        tone: 'immersive',
        length: '2-4 sentences',
        perspective: 'second person',
        focus: 'character immersion'
      }
    };
  }

  /**
   * Get time description for AI context
   */
  private getTimeDescription(band: string): string {
    const descriptions: Record<string, string> = {
      'dawn_to_mid_day': 'early morning light',
      'mid_day_to_evening': 'afternoon warmth',
      'evening_to_mid_night': 'evening shadows',
      'mid_night_to_dawn': 'night darkness'
    };
    return descriptions[band] || 'unknown time';
  }

  /**
   * Load adventure data from various sources
   */
  private async loadAdventureData(gameContext: any): Promise<any> {
    // Try to load from game context first
    if (gameContext.adventure) {
      return gameContext.adventure;
    }

    // Try to load from adventure ID
    if (gameContext.adventure_id) {
      // This would integrate with existing adventure loading logic
      return await this.loadAdventureById(gameContext.adventure_id);
    }

    // Try to load from world context
    if (gameContext.world_id) {
      return await this.loadDefaultAdventure(gameContext.world_id);
    }

    return null;
  }

  /**
   * Load adventure by ID (placeholder - integrate with existing system)
   */
  private async loadAdventureById(adventureId: string): Promise<any> {
    // This would integrate with the existing adventure loading system
    console.log(`[UNIVERSAL_ADVENTURE] Loading adventure by ID: ${adventureId}`);
    return null; // Placeholder
  }

  /**
   * Load default adventure for world (placeholder - integrate with existing system)
   */
  private async loadDefaultAdventure(worldId: string): Promise<any> {
    // This would integrate with the existing adventure loading system
    console.log(`[UNIVERSAL_ADVENTURE] Loading default adventure for world: ${worldId}`);
    return null; // Placeholder
  }

  /**
   * Get scene data from adventure
   */
  private getSceneData(adventure: any, sceneId: string): any {
    if (!adventure.scenes) {
      return { id: sceneId, type: 'general' };
    }

    const scene = adventure.scenes.find((s: any) => s.id === sceneId);
    return scene || { id: sceneId, type: 'general' };
  }

  /**
   * Get available adventures for error messages
   */
  private async getAvailableAdventures(worldId: string): Promise<string[]> {
    // This would integrate with existing adventure listing
    return []; // Placeholder
  }
}

export const universalAdventureService = new UniversalAdventureService();
