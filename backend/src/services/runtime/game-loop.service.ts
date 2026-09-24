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

import type { GameState, Mas1Intent, EngineResultDto, Mas2ResponseDto, DirectorUnifiedIntent } from '@shared/types/chimera-runtime';
import { GameStateSchema } from '@shared/types/chimera-runtime';
import { DirectorService } from './director.service.js';
import { EngineService } from './engine.service.js';
import { Mas2Service } from './mas2.service.js';
import { StateService } from './state.service.js';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';

export interface CastStoneResult {
  director: DirectorUnifiedIntent;
  engine: EngineResultDto | null; // null if resolution_mode is "narrative"
  mas2: Mas2ResponseDto;
  updatedState: GameState;
}

export class GameLoopService {
  private director: DirectorService;
  private engine: EngineService;
  private mas2: Mas2Service;
  private storiesRepo: StoriesRepository;

  constructor(
    storiesRepo: StoriesRepository,
    director?: DirectorService,
    engine?: EngineService,
    mas2?: Mas2Service
  ) {
    this.storiesRepo = storiesRepo;
    this.director = director || new DirectorService();
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
   * 4. Call Director -> Returns DirectorUnifiedIntent
   * 5. Apply unseen_ripples to StateService (Pre-Engine Write)
   * 6. If resolution_mode is "engine": Execute intent_queue via Engine
   * 7. If resolution_mode is "narrative": Skip Engine
   * 8. Apply engine deltas to StateService (if engine ran)
   * 9. Call Narrator (MAS2) with current state
   * 10. Apply Narrator Tier0 mutations to StateService
   * 11. Persist final state using StateService.getState()
   * 12. Return composite result
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

    // TODO: Retrieve lore fragments via RAG (placeholder for now)
    const loreFragments: Array<{ id: string; content: string; title?: string }> = [];

    // Step 2: Initialize StateService (Single Source of Truth)
    const stateService = new StateService(gameState);
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: StateService initialized`);

    // Step 3: Call Director (Strategic Lead) - Returns Unified Intent DTO
    const directorIntent = await this.director.resolve(userText, gameState, actionsMap, loreFragments);
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Director returned resolution_mode="${directorIntent.turn_meta.resolution_mode}", ${directorIntent.intent_queue.length} intent(s), ${directorIntent.unseen_ripples.length} ripple(s)`);

    // Step 4: Apply unseen_ripples to StateService (Pre-Engine Write)
    for (const ripple of directorIntent.unseen_ripples) {
      // Apply the ripple to the state path
      const currentValue = stateService.getValue(ripple.property_path) as number || 0;
      // Calculate delta based on tier (will be converted by Engine later, but we apply a percentage here)
      const tierMultiplier = { Minor: 0.05, Moderate: 0.15, Major: 0.30, Severe: 0.50 }[ripple.delta_tier] || 0.15;
      const delta = Math.round(currentValue * tierMultiplier * (ripple.type === 'relationship' ? 1 : -1));
      stateService.setValue(ripple.property_path, currentValue + delta);
      console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Applied ripple ${ripple.delta_tier} to ${ripple.property_path}: ${currentValue} -> ${currentValue + delta}`);
    }

    // Step 5: Handle resolution_mode
    let engineResult: EngineResultDto | null = null;
    
    if (directorIntent.turn_meta.resolution_mode === 'engine') {
      // Step 6: Execute intent_queue via Engine (sequential processing)
      engineResult = await this.engine.executeIntentQueue(
        directorIntent,
        stateService.getState(),
        actionsMap
      );
      console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Engine processed ${directorIntent.intent_queue.length} intent(s) from Director`);

      // Step 7: Apply engine deltas to StateService
      stateService.applyDeltas(engineResult.numeric_deltas);
      console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Applied ${Object.keys(engineResult.numeric_deltas).length} engine deltas to StateService`);
    } else {
      console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Resolution mode is "narrative", skipping Engine`);
    }

    // Step 8: Call Narrator (MAS2) with current state
    const mas2Result = await this.mas2.narrate(
      engineResult || { success: true, numeric_deltas: {}, outcome_summary: 'Narrative-only turn' },
      stateService.getState(),
      directorIntent.intent_queue[0]?.trigger_id || 'unknown'
    );
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Narrator generated narration`);

    // Step 9: Apply Narrator Tier0 mutations to StateService
    for (const [key, value] of Object.entries(mas2Result.tier0_mutations)) {
      stateService.setValue(`tier0_narrative.${key}`, value);
    }
    console.log(`[LOGIC_TRACE] [GameLoopService] Execution: Applied ${Object.keys(mas2Result.tier0_mutations).length} Narrator mutations to StateService`);

    // Step 10: Get final authoritative state from StateService (NOT from engine delta)
    const finalState = stateService.getState();
    console.log(`[LOGIC_TRACE] [GameLoopService] Output: Final state retrieved from StateService (source of truth)`);

    // Step 11: Persist final state to DB (using StateService.getState(), not engine delta)
    await this.storiesRepo.updateGameState(gameStateId, finalState);
    console.log(`[LOGIC_TRACE] [GameLoopService] Output: State persisted to database`);

    // Step 12: Return composite result
    return {
      director: directorIntent,
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

