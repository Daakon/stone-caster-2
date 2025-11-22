// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Game Loop Orchestrator
 * Coordinates the full runtime loop: Input -> MAS1 -> Engine -> MAS2 -> State Update
 */

import type { GameState, Mas1ResponseDto, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { GameStateSchema } from '@shared/types/chimera-runtime';
import { Mas1Service } from './mas1.service.js';
import { EngineService } from './engine.service.js';
import { Mas2Service } from './mas2.service.js';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';

export interface CastStoneResult {
  mas1: Mas1ResponseDto;
  engine: EngineResultDto;
  mas2: Mas2ResponseDto;
  updatedState: GameState;
}

export class GameLoopService {
  private mas1: Mas1Service;
  private engine: EngineService;
  private mas2: Mas2Service;
  private storiesRepo: StoriesRepository;

  constructor(
    storiesRepo: StoriesRepository,
    mas1?: Mas1Service,
    engine?: EngineService,
    mas2?: Mas2Service
  ) {
    this.storiesRepo = storiesRepo;
    this.mas1 = mas1 || new Mas1Service();
    this.engine = engine || new EngineService();
    this.mas2 = mas2 || new Mas2Service();
  }

  /**
   * Execute the full game loop: cast a stone (process player input)
   * @param gameStateId - The game state ID
   * @param userText - Player's input text
   * @returns Composite result with all stage outputs and updated state
   */
  async castStone(gameStateId: string, userText: string): Promise<CastStoneResult> {
    // Step 1: Load GameState from DB
    const gameState = await this.storiesRepo.loadGameState(gameStateId);
    if (!gameState) {
      throw new Error(`Game state not found: ${gameStateId}`);
    }

    // Load compiled story to get actions_map
    const storyId = await this.getStoryIdFromGameState(gameStateId);
    if (!storyId) {
      throw new Error(`Story ID not found for game state: ${gameStateId}`);
    }

    const compiledStory = await this.storiesRepo.getCompiledStoryById(storyId);
    if (!compiledStory) {
      throw new Error(`Compiled story not found: ${storyId}`);
    }

    // Convert CompiledStory to the format we need
    const actionsMap = this.extractActionsMap(compiledStory);

    // Step 2: Call MAS1 (Interpreter)
    const mas1Result = await this.mas1.resolve(userText, gameState, actionsMap);

    // Step 3: Call Engine (Resolver)
    const engineResult = await this.engine.execute(mas1Result, gameState, actionsMap);

    // Step 4: Call MAS2 (Narrator)
    const mas2Result = await this.mas2.narrate(engineResult, gameState);

    // Step 5: State Reducer - Apply deltas
    const updatedState = this.applyStateUpdates(gameState, engineResult, mas2Result);

    // Step 6: Save updated state to DB
    await this.storiesRepo.updateGameState(gameStateId, updatedState);

    // Step 7: Return composite result
    return {
      mas1: mas1Result,
      engine: engineResult,
      mas2: mas2Result,
      updatedState,
    };
  }

  /**
   * Initialize a new game session from a compiled story
   * @param compiledStoryId - The compiled story ID
   * @param playerId - The player's user ID
   * @returns The new game state ID
   */
  async initializeSession(compiledStoryId: string, playerId: string): Promise<string> {
    const compiledStory = await this.storiesRepo.getCompiledStoryById(compiledStoryId);
    if (!compiledStory) {
      throw new Error(`Compiled story not found: ${compiledStoryId}`);
    }

    // Create initial game state from compiled story
    const initialState: GameState = {
      tier1_mechanical: this.createInitialTier1(compiledStory),
      tier0_narrative: this.createInitialTier0(compiledStory),
    };

    // Save to database
    const gameStateId = await this.storiesRepo.createGameState(
      compiledStoryId,
      initialState,
      playerId
    );

    return gameStateId;
  }

  /**
   * Extract actions_map from compiled story
   */
  private extractActionsMap(compiledStory: CompiledStory): Record<string, unknown> {
    // CompiledStory from shared/types has master_schema.actions_map
    if (compiledStory.master_schema?.actions_map) {
      // actions_map is Record<string, string> in the schema, but we need to parse it
      const actionsMap: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(compiledStory.master_schema.actions_map)) {
        try {
          // Try to parse as JSON if it's a string
          actionsMap[key] = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          // If not JSON, use as-is
          actionsMap[key] = value;
        }
      }
      return actionsMap;
    }
    return {};
  }

  /**
   * Apply state updates from engine and MAS2 results
   */
  private applyStateUpdates(
    currentState: GameState,
    engineResult: EngineResultDto,
    mas2Result: Mas2ResponseDto
  ): GameState {
    const updatedState: GameState = {
      tier1_mechanical: { ...currentState.tier1_mechanical },
      tier0_narrative: { ...currentState.tier0_narrative },
    };

    // Apply Tier 1 (Mechanical) deltas from Engine
    for (const [key, delta] of Object.entries(engineResult.numeric_deltas)) {
      const currentValue = updatedState.tier1_mechanical[key];
      const deltaNum = typeof delta === 'number' ? delta : 0;
      if (typeof currentValue === 'number') {
        updatedState.tier1_mechanical[key] = currentValue + deltaNum;
      } else {
        // Initialize if doesn't exist
        updatedState.tier1_mechanical[key] = deltaNum;
      }
    }

    // Apply Tier 0 (Narrative) mutations from MAS2
    for (const [key, value] of Object.entries(mas2Result.tier0_mutations)) {
      updatedState.tier0_narrative[key] = value;
    }

    return GameStateSchema.parse(updatedState);
  }

  /**
   * Get story ID from game state record
   */
  private async getStoryIdFromGameState(gameStateId: string): Promise<string | null> {
    return this.storiesRepo.getStoryIdFromGameState(gameStateId);
  }

  /**
   * Create initial Tier 1 state from compiled story
   */
  private createInitialTier1(compiledStory: CompiledStory): Record<string, unknown> {
    // Use initial_state from compiled story
    const initialState = compiledStory.initial_state || {};
    
    // Ensure it's a proper object
    if (typeof initialState === 'object' && initialState !== null) {
      return { ...initialState } as Record<string, unknown>;
    }
    
    return {};
  }

  /**
   * Create initial Tier 0 state from compiled story
   */
  private createInitialTier0(compiledStory: CompiledStory): Record<string, unknown> {
    return {
      memories: [],
      relationships: {},
    };
  }
}

