// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [SERVICE] GameLoopService
 * ----------------------------------------------------------------------
 * ROLE: The Orchestrator (The "Motherboard").
 * RESPONSIBILITY:
 * - Connects Inputs (Controller) to Processors (MAS1, Engine, MAS2).
 * - Manages the Transaction Boundary (Load -> Process -> Persist).
 * - Handles Error Recovery and safe failures.
 *
 * CONSTRAINTS:
 * - Persistence MUST occur after all logic is complete.
 * - Uses StateService as the ONLY source of truth for saving.
 * - Pipeline: MAS1 (Intents) -> Engine (Mutate State) -> MAS2 (Narrate).
 */

import type { GameState, Mas1Intent, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { GameStateSchema } from '@shared/types/chimera-runtime';
import { Mas1Service } from './mas1.service.js';
import { EngineService } from './engine.service.js';
import { Mas2Service } from './mas2.service.js';
import { StateService } from './state.service.js';
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
   * [METHOD] castStone
   * ----------------------------------------------------------------
   * @mutates context.state - Via StateService during turn processing
   * @sourceOfTruth - StateService.getState() for persistence
   * @logic_flow
   * 1. Load GameState from DB
   * 2. Load CompiledStory and extract actionsMap
   * 3. Initialize StateService with loaded state
   * 4. Call MAS1 (Interpreter) -> Returns Mas1Intent[]
   * 5. Call Engine.executeActionSteps (Mas1Intent[]) -> Returns EngineResultDto
   * 6. Apply engine deltas to StateService
   * 7. Call MAS2 (Narrator) -> Returns Mas2ResponseDto
   * 8. Apply MAS2 mutations to StateService
   * 9. Persist final state using StateService.getState() (NOT engine delta)
   * 10. Return composite result
   */
  async castStone(gameStateId: string, userText: string): Promise<CastStoneResult> {
    console.log(`[LOGIC_TRACE] [GameLoopService] Input: GameStateId: ${gameStateId}, UserText: "${userText}"`);
    
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

    // Step 2: Initialize StateService (Single Source of Truth)
    const stateService = new StateService(gameState);
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: StateService initialized`);

    // Step 3: Call MAS1 (Interpreter) - Returns array of intents
    const mas1Intents = await this.mas1.resolve(userText, gameState, actionsMap);
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: MAS1 returned ${mas1Intents.length} intent(s)`);

    // Step 4: Execute all intents via Engine (chained execution)
    const engineResult = await this.engine.executeActionSteps(
      mas1Intents,
      stateService.getState(),
      actionsMap
    );
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Engine processed all intents`);

    // Step 5: Apply engine deltas to StateService
    stateService.applyDeltas(engineResult.numeric_deltas);
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Applied ${Object.keys(engineResult.numeric_deltas).length} engine deltas to StateService`);

    // Step 6: Call MAS2 (Narrator) with current state
    const mas2Result = await this.mas2.narrate(
      engineResult,
      stateService.getState(),
      mas1Intents[0]?.trigger_id || 'unknown'
    );
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: MAS2 generated narration`);

    // Step 7: Apply MAS2 Tier0 mutations to StateService
    for (const [key, value] of Object.entries(mas2Result.tier0_mutations)) {
      stateService.setValue(`tier0_narrative.${key}`, value);
    }
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Applied ${Object.keys(mas2Result.tier0_mutations).length} MAS2 mutations to StateService`);

    // Step 8: Get final authoritative state from StateService (NOT from engine delta)
    const finalState = stateService.getState();
    console.log(`[LOGIC_TRACE] [GameLoopService] Output: Final state retrieved from StateService (source of truth)`);

    // Step 9: Persist final state to DB (using StateService.getState(), not engine delta)
    await this.storiesRepo.updateGameState(gameStateId, finalState);
    console.log(`[LOGIC_TRACE] [GameLoopService] Output: State persisted to database`);

    // Step 10: Return composite result
    return {
      mas1: mas1Intents,
      engine: engineResult,
      mas2: mas2Result,
      updatedState: finalState,
    };
  }

  /**
   * [METHOD] initializeSession
   * ----------------------------------------------------------------
   * @sourceOfTruth - CompiledStory from database
   * @logic_flow
   * 1. Load CompiledStory from database
   * 2. Create initial GameState from compiled story
   * 3. Save initial state to database
   * 4. Return game state ID
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
   * [METHOD] extractActionsMap
   * ----------------------------------------------------------------
   * @sourceOfTruth - CompiledStory parameter
   * @logic_flow
   * 1. Try config_mechanics.runtime.actions (new architecture)
   * 2. Fallback to config_engine.runtime.actions (legacy)
   * 3. Fallback to master_schema.actions_map (legacy)
   * 4. Return actions map or empty object
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
   * [METHOD] getStoryIdFromGameState
   * ----------------------------------------------------------------
   * @sourceOfTruth - Database via StoriesRepository
   * @logic_flow
   * 1. Query database for story ID associated with game state
   * 2. Return story ID or null
   */

  private async getStoryIdFromGameState(gameStateId: string): Promise<string | null> {
    return this.storiesRepo.getStoryIdFromGameState(gameStateId);
  }

  /**
   * [METHOD] createInitialTier1
   * ----------------------------------------------------------------
   * @sourceOfTruth - CompiledStory.initial_state
   * @logic_flow
   * 1. Extract initial_state from compiled story
   * 2. Return as Record<string, unknown> or empty object
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
   * [METHOD] createInitialTier0
   * ----------------------------------------------------------------
   * @logic_flow
   * 1. Return default Tier 0 structure (memories, relationships)
   */
  private createInitialTier0(compiledStory: CompiledStory): Record<string, unknown> {
    return {
      memories: [],
      relationships: {},
    };
  }

  /**
   * [METHOD] shouldStopExecution
   * ----------------------------------------------------------------
   * @logic_flow
   * 1. Check outcome_summary for gating keywords
   * 2. Return true if gating condition detected
   */
  private shouldStopExecution(engineResult: EngineResultDto): boolean {
    // Check for gating keywords in outcome summary
    const summary = engineResult.outcome_summary.toLowerCase();
    const gatingKeywords = ['collapsed', 'unconscious', 'defeated', 'dead', 'critical failure'];
    
    return gatingKeywords.some(keyword => summary.includes(keyword));
  }
}

