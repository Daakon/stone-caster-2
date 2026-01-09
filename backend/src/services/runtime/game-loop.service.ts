// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Game Loop Orchestrator
 * Coordinates the full runtime loop: Input -> MAS1 -> Engine -> MAS2 -> State Update
 */

import type { GameState, Mas1Intent, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { GameStateSchema } from '@shared/types/chimera-runtime';
import { Mas1Service } from './mas1.service.js';
import { EngineService } from './engine.service.js';
import { Mas2Service } from './mas2.service.js';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';

export interface CastStoneResult {
  mas1: Mas1Intent[];
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

    // Step 2: Call MAS1 (Interpreter) - Returns array of intents
    const mas1Intents = await this.mas1.resolve(userText, gameState, actionsMap);
    console.log(`[GameLoop] MAS1 returned ${mas1Intents.length} intent(s)`);

    // Step 3: Execute each intent sequentially, aggregating results
    let currentState = gameState;
    const aggregatedDeltas: Record<string, number> = {};
    const resolutionSummaries: string[] = [];
    let allSuccess = true;

    for (let i = 0; i < mas1Intents.length; i++) {
      const intent = mas1Intents[i];
      console.log(`[GameLoop] Processing intent ${i + 1}/${mas1Intents.length}: ${intent.trigger_id}`);

      // Execute this intent against current state
      const engineResult = await this.engine.execute(intent, currentState, actionsMap);

      // Aggregate results
      allSuccess = allSuccess && engineResult.success;
      resolutionSummaries.push(engineResult.outcome_summary);
      
      // Merge numeric deltas
      for (const [path, delta] of Object.entries(engineResult.numeric_deltas)) {
        aggregatedDeltas[path] = (aggregatedDeltas[path] || 0) + delta;
      }

      // CRITICAL: Apply state changes immediately so subsequent actions see updated state
      currentState = this.applyStateUpdates(currentState, engineResult, {
        ripple_narrative: '',
        tier0_mutations: {},
      });

      // Check for early failure/gating (e.g., "Collapsed" status stops further actions)
      if (!engineResult.success && this.shouldStopExecution(engineResult)) {
        console.log(`[GameLoop] Early termination: Action ${i + 1} failed with gating condition`);
        break;
      }
    }

    // Step 4: Create aggregated engine result for MAS2
    const aggregatedEngineResult: EngineResultDto = {
      success: allSuccess,
      outcome_summary: resolutionSummaries.join(' AND '),
      numeric_deltas: aggregatedDeltas,
    };

    // Step 5: Call MAS2 (Narrator) with aggregated results
    const mas2Result = await this.mas2.narrate(
      aggregatedEngineResult,
      currentState,
      mas1Intents[0]?.trigger_id || 'unknown'
    );

    // Step 6: Final state update with MAS2 mutations
    const updatedState = this.applyStateUpdates(currentState, aggregatedEngineResult, mas2Result);

    // Step 7: Save updated state to DB
    await this.storiesRepo.updateGameState(gameStateId, updatedState);

    // Step 8: Return composite result
    return {
      mas1: mas1Intents,
      engine: aggregatedEngineResult,
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
   * NEW: Reads from config_mechanics.runtime.actions (specialized column)
   */
  private extractActionsMap(compiledStory: CompiledStory): Record<string, unknown> {
    // NEW ARCHITECTURE: Read from config_mechanics (specialized column for Engine)
    const storyAny = compiledStory as any;
    if (storyAny.config_mechanics?.runtime?.actions) {
      const actions = storyAny.config_mechanics.runtime.actions;
      console.log("[GameLoopService] 🚀 Switched to 'config_mechanics'. Actions loaded:", Object.keys(actions));
      return actions as Record<string, unknown>;
    }
    
    // FALLBACK: Legacy support for old compiled stories (reads from config_engine)
    if (compiledStory.config_engine && typeof compiledStory.config_engine === 'object') {
      const configEngine = compiledStory.config_engine as any;
      if (configEngine.runtime?.actions) {
        console.warn("[GameLoopService] ⚠️ Using legacy config_engine (fallback). Consider recompiling story.");
        return configEngine.runtime.actions as Record<string, unknown>;
      }
    }
    
    // FALLBACK: Old master_schema format
    if (compiledStory.master_schema?.actions_map) {
      console.warn("[GameLoopService] ⚠️ Using legacy master_schema.actions_map (fallback). Consider recompiling story.");
      const actionsMap: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(compiledStory.master_schema.actions_map)) {
        try {
          actionsMap[key] = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          actionsMap[key] = value;
        }
      }
      return actionsMap;
    }
    
    console.warn("[GameLoopService] ⚠️ No actions found in compiled story!");
    return {};
  }

  /**
   * Apply state updates from engine and MAS2 results
   * Supports deep path updates (e.g., "entities.enemy.stats.hp")
   */
  private applyStateUpdates(
    currentState: GameState,
    engineResult: EngineResultDto,
    mas2Result: Mas2ResponseDto
  ): GameState {
    // Deep clone to avoid mutations
    const updatedState: GameState = {
      tier1_mechanical: JSON.parse(JSON.stringify(currentState.tier1_mechanical)),
      tier0_narrative: JSON.parse(JSON.stringify(currentState.tier0_narrative)),
    };

    // Apply Tier 1 (Mechanical) deltas from Engine
    // Support deep paths like "entities.enemy.stats.hp"
    for (const [path, delta] of Object.entries(engineResult.numeric_deltas)) {
      const deltaNum = typeof delta === 'number' ? delta : 0;
      
      if (path.includes('.')) {
        // Deep path update (e.g., "entities.enemy.stats.hp")
        this.setDeepValue(updatedState.tier1_mechanical, path, deltaNum);
      } else {
        // Simple path update
        const currentValue = updatedState.tier1_mechanical[path];
        if (typeof currentValue === 'number') {
          updatedState.tier1_mechanical[path] = currentValue + deltaNum;
        } else {
          // Initialize if doesn't exist
          updatedState.tier1_mechanical[path] = deltaNum;
        }
      }
    }

    // Apply Tier 0 (Narrative) mutations from MAS2
    for (const [key, value] of Object.entries(mas2Result.tier0_mutations)) {
      updatedState.tier0_narrative[key] = value;
    }

    return GameStateSchema.parse(updatedState);
  }

  /**
   * Set a value at a deep path in an object, creating intermediate objects as needed
   * Supports paths like "entities.enemy.stats.hp"
   */
  private setDeepValue(obj: Record<string, unknown>, path: string, delta: number): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    // Navigate/create path except for the last part
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final value (add delta to existing value or initialize)
    const finalKey = parts[parts.length - 1];
    const currentValue = current[finalKey];
    if (typeof currentValue === 'number') {
      current[finalKey] = currentValue + delta;
    } else {
      current[finalKey] = delta;
    }
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

  /**
   * Check if execution should stop early due to gating conditions
   * (e.g., "Collapsed" status, critical failure, etc.)
   */
  private shouldStopExecution(engineResult: EngineResultDto): boolean {
    // Check for gating keywords in outcome summary
    const summary = engineResult.outcome_summary.toLowerCase();
    const gatingKeywords = ['collapsed', 'unconscious', 'defeated', 'dead', 'critical failure'];
    
    return gatingKeywords.some(keyword => summary.includes(keyword));
  }
}

