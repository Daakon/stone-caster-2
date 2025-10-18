/**
 * AWF Act Interpreter
 * Phase 4: Act Interpreter - Applies AWF.acts[] to session state using injection_map.acts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../repositories/awf-repository-factory.js';
import { 
  ApplyActsParams, 
  ApplyActsResult, 
  ActApplicationSummary,
  AwfAct,
  GameState,
  EpisodicMemory,
  ObjectiveEntry,
  ObjectiveStatus,
  RelationEntry,
  ResourceEntry,
  FlagEntry,
  TimeEntry,
  ActMode,
  ACT_TYPES,
  ActType
} from '../types/awf-acts.js';
import { WorldDoc } from '../types/awf-docs.js';
import { getAtPointer, setAtPointer } from '../utils/awf-bundle-helpers.js';

export class ActInterpreter {
  private supabase: SupabaseClient;
  private repos: ReturnType<AWFRepositoryFactory['getAllRepositories']>;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.repos = new AWFRepositoryFactory({ supabase }).getAllRepositories();
  }

  /**
   * Apply AWF acts to session state with full transaction support
   */
  async applyActs(params: ApplyActsParams): Promise<ApplyActsResult> {
    const { sessionId, awf } = params;
    
    console.log(`[AWF] Starting act application for session ${sessionId}`);
    
    // Start transaction
    const { data: transactionData, error: transactionError } = await this.supabase.rpc('begin_transaction');
    if (transactionError) {
      throw new Error(`Failed to begin transaction: ${transactionError.message}`);
    }

    try {
      // Read current session and game state with FOR UPDATE
      const session = await this.repos.sessions.getByIdVersion(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const gameState = await this.repos.gameStates.getByIdVersion(sessionId);
      if (!gameState) {
        throw new Error(`Game state for session ${sessionId} not found`);
      }

      // Load injection map and world for configuration
      const injectionMap = await this.repos.injectionMap.getByIdVersion('default');
      if (!injectionMap) {
        throw new Error('Default injection map not found');
      }

      const world = await this.repos.worlds.getByIdVersion(session.world_ref, 'v1');
      if (!world) {
        throw new Error(`World ${session.world_ref} not found`);
      }

      // Validate contract rules
      this.validateContractRules(session.is_first_turn, awf.acts || []);

      // Apply acts
      const summary = await this.applyActsToState(
        gameState as unknown as GameState,
        awf.acts || [],
        injectionMap.doc.acts,
        world.doc as WorldDoc
      );

      // Update session
      const newTurnId = session.turn_id + 1;
      const newIsFirstTurn = false;

      // Update session using upsert
      const updatedSession = {
        ...session,
        turn_id: newTurnId,
        is_first_turn: newIsFirstTurn,
        updated_at: new Date().toISOString()
      };
      await this.repos.sessions.upsert(updatedSession);

      // Update game state using upsert
      const updatedGameState = {
        ...gameState,
        hot: gameState.hot,
        warm: gameState.warm,
        cold: gameState.cold,
        updated_at: new Date().toISOString()
      };
      await this.repos.gameStates.upsert(updatedGameState);

      // Commit transaction
      const { error: commitError } = await this.supabase.rpc('commit_transaction');
      if (commitError) {
        throw new Error(`Failed to commit transaction: ${commitError.message}`);
      }

      console.log(`[AWF] Act application completed for session ${sessionId}`);
      console.log(`[AWF] Summary:`, summary);

      return {
        newState: gameState as unknown as GameState,
        summary
      };

    } catch (error) {
      // Rollback transaction
      await this.supabase.rpc('rollback_transaction');
      throw error;
    }
  }

  /**
   * Validate contract rules for act application
   */
  private validateContractRules(isFirstTurn: boolean, acts: AwfAct[]): void {
    const timeAdvanceActs = acts.filter(act => act.type === ACT_TYPES.TIME_ADVANCE);
    
    if (isFirstTurn && timeAdvanceActs.length > 0) {
      throw new Error('TIME_ADVANCE acts are forbidden on first turn');
    }
    
    if (!isFirstTurn && timeAdvanceActs.length !== 1) {
      throw new Error(`Exactly one TIME_ADVANCE act required on subsequent turns, found ${timeAdvanceActs.length}`);
    }
  }

  /**
   * Apply acts to game state using injection map configuration
   */
  private async applyActsToState(
    gameState: GameState,
    acts: AwfAct[],
    actsConfig: Record<string, string>,
    worldDoc: WorldDoc
  ): Promise<ActApplicationSummary> {
    const summary: ActApplicationSummary = {
      relChanges: [],
      objectives: [],
      flags: [],
      resources: [],
      memory: { added: 0, pinned: 0, trimmed: 0 },
      violations: []
    };

    for (const act of acts) {
      const config = actsConfig[act.type];
      if (!config) {
        const violation = `Unknown act type: ${act.type}`;
        summary.violations.push(violation);
        console.warn(`[AWF] ${violation}`);
        continue;
      }

      try {
        await this.applyAct(gameState, act, config, summary, worldDoc);
      } catch (error) {
        const violation = `Failed to apply act ${act.type}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        summary.violations.push(violation);
        console.warn(`[AWF] ${violation}`);
      }
    }

    // Apply memory hygiene
    this.applyMemoryHygiene(gameState, summary);

    return summary;
  }

  /**
   * Apply a single act to game state
   */
  private async applyAct(
    gameState: GameState,
    act: AwfAct,
    config: string,
    summary: ActApplicationSummary,
    worldDoc: WorldDoc
  ): Promise<void> {
    const [pointer, mode] = config.split('|');
    const actMode = mode as ActMode;

    switch (actMode) {
      case 'merge_delta_by_npc':
        this.applyMergeDeltaByNpc(gameState, act, pointer, summary);
        break;
      case 'upsert_by_id':
        this.applyUpsertById(gameState, act, pointer, summary);
        break;
      case 'set_by_key':
        this.applySetByKey(gameState, act, pointer, summary);
        break;
      case 'merge_delta_by_key':
        this.applyMergeDeltaByKey(gameState, act, pointer, summary);
        break;
      case 'set_value':
        this.applySetValue(gameState, act, pointer, summary);
        break;
      case 'add_number':
        this.applyAddNumber(gameState, act, pointer, summary, worldDoc);
        break;
      case 'append_unique_by_key':
        this.applyAppendUniqueByKey(gameState, act, pointer, summary);
        break;
      case 'add_unique':
        this.applyAddUnique(gameState, act, pointer, summary);
        break;
      case 'tag_by_key':
        this.applyTagByKey(gameState, act, pointer, summary);
        break;
      case 'remove_by_key':
        this.applyRemoveByKey(gameState, act, pointer, summary);
        break;
      default:
        throw new Error(`Unknown act mode: ${actMode}`);
    }
  }

  /**
   * Apply merge_delta_by_npc mode for relation changes
   */
  private applyMergeDeltaByNpc(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { npc, delta } = act.data as { npc: string; delta: number };
    
    // Ensure relations object exists
    let relations = getAtPointer(gameState as Record<string, unknown>, pointer) as RelationEntry;
    if (!relations) {
      relations = {};
      setAtPointer(gameState as Record<string, unknown>, pointer, relations);
    }

    // Apply delta with baseline of 50
    const current = relations[npc] ?? 50;
    const newVal = current + delta;
    relations[npc] = newVal;

    summary.relChanges.push({ npc, delta, newVal });
  }

  /**
   * Apply upsert_by_id mode for objectives
   */
  private applyUpsertById(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { id, status, progress } = act.data as { 
      id: string; 
      status: string; 
      progress?: number 
    };

    // Validate status
    const validStatuses: string[] = ['not_started', 'in_progress', 'complete', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid objective status: ${status}`);
    }

    // Ensure objectives array exists
    let objectives = getAtPointer(gameState as Record<string, unknown>, pointer) as ObjectiveEntry[];
    if (!objectives) {
      objectives = [];
      setAtPointer(gameState as Record<string, unknown>, pointer, objectives);
    }

    // Find existing objective
    const existingIndex = objectives.findIndex(obj => obj.id === id);
    const prevStatus = existingIndex >= 0 ? objectives[existingIndex].status : undefined;

    // Upsert objective
    const objective: ObjectiveEntry = { id, status: status as ObjectiveStatus, progress };
    if (existingIndex >= 0) {
      objectives[existingIndex] = objective;
    } else {
      objectives.push(objective);
    }

    summary.objectives.push({ id, prev: prevStatus, next: status });
  }

  /**
   * Apply set_by_key mode for flags
   */
  private applySetByKey(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { key, val } = act.data as { key: string; val: string };
    
    // Ensure flags object exists
    let flags = getAtPointer(gameState as Record<string, unknown>, pointer) as FlagEntry;
    if (!flags) {
      flags = {};
      setAtPointer(gameState as Record<string, unknown>, pointer, flags);
    }

    flags[key] = val;
    summary.flags.push(key);
  }

  /**
   * Apply merge_delta_by_key mode for resources
   */
  private applyMergeDeltaByKey(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { key, delta } = act.data as { key: string; delta: number };
    
    // Ensure resources object exists
    let resources = getAtPointer(gameState as Record<string, unknown>, pointer) as ResourceEntry;
    if (!resources) {
      resources = {};
      setAtPointer(gameState as Record<string, unknown>, pointer, resources);
    }

    const current = resources[key] ?? 0;
    const newVal = current + delta;
    resources[key] = newVal;

    summary.resources.push({ key, delta, newVal });
  }

  /**
   * Apply set_value mode for scene setting
   */
  private applySetValue(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { scn } = act.data as { scn: string };
    setAtPointer(gameState as Record<string, unknown>, pointer, scn);
    summary.scene = scn;
  }

  /**
   * Apply add_number mode for time advancement
   */
  private applyAddNumber(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary,
    worldDoc: WorldDoc
  ): void {
    const { ticks } = act.data as { ticks: number };
    
    if (ticks < 1) {
      throw new Error('Time advancement must be at least 1 tick');
    }

    // Get current time state
    let time = getAtPointer(gameState as Record<string, unknown>, pointer) as TimeEntry;
    if (!time) {
      time = { band: worldDoc.time?.defaultBand || 'Dawn', ticks: 0 };
    }

    const prevTime = { ...time };
    
    // Apply time band rolling
    const newTime = this.rollTimeBands(time, ticks, worldDoc);
    setAtPointer(gameState as Record<string, unknown>, pointer, newTime);

    summary.time = {
      prev: prevTime,
      next: newTime,
      added: ticks
    };
  }

  /**
   * Apply append_unique_by_key mode for episodic memory
   */
  private applyAppendUniqueByKey(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { k, note, salience, tags } = act.data as { 
      k: string; 
      note: string; 
      salience: number; 
      tags?: string[] 
    };

    // Ensure episodic array exists
    let episodic = getAtPointer(gameState as Record<string, unknown>, pointer) as EpisodicMemory[];
    if (!episodic) {
      episodic = [];
      setAtPointer(gameState as Record<string, unknown>, pointer, episodic);
    }

    // Check if key already exists
    const existingIndex = episodic.findIndex(entry => entry.k === k);
    if (existingIndex >= 0) {
      return; // Skip if already exists
    }

    // Truncate note if too long
    let truncatedNote = note;
    if (note.length > 120) {
      truncatedNote = note.substring(0, 117) + '...';
      summary.violations.push(`Note truncated for key ${k}: ${note.length} chars`);
    }

    // Add new memory entry
    const memoryEntry: EpisodicMemory = {
      k,
      note: truncatedNote,
      salience,
      tags,
      t: Date.now() // Using timestamp as turn ID for now
    };

    episodic.push(memoryEntry);
    summary.memory.added++;
  }

  /**
   * Apply add_unique mode for pins
   */
  private applyAddUnique(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { key } = act.data as { key: string };
    
    // Ensure pins array exists
    let pins = getAtPointer(gameState as Record<string, unknown>, pointer) as string[];
    if (!pins) {
      pins = [];
      setAtPointer(gameState as Record<string, unknown>, pointer, pins);
    }

    // Add if not already present
    if (!pins.includes(key)) {
      pins.push(key);
      summary.memory.pinned++;
    }
  }

  /**
   * Apply tag_by_key mode for memory tagging
   */
  private applyTagByKey(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { k, addTags, removeTags } = act.data as { 
      k: string; 
      addTags?: string[]; 
      removeTags?: string[] 
    };
    
    let episodic = getAtPointer(gameState as Record<string, unknown>, pointer) as EpisodicMemory[];
    if (!episodic) {
      return;
    }

    const entry = episodic.find(e => e.k === k);
    if (!entry) {
      return;
    }

    // Add tags
    if (addTags) {
      entry.tags = [...(entry.tags || []), ...addTags];
    }

    // Remove tags
    if (removeTags) {
      entry.tags = (entry.tags || []).filter(tag => !removeTags.includes(tag));
    }
  }

  /**
   * Apply remove_by_key mode for memory eviction
   */
  private applyRemoveByKey(
    gameState: GameState,
    act: AwfAct,
    pointer: string,
    summary: ActApplicationSummary
  ): void {
    const { k } = act.data as { k: string };
    
    let episodic = getAtPointer(gameState as Record<string, unknown>, pointer) as EpisodicMemory[];
    if (!episodic) {
      return;
    }

    const index = episodic.findIndex(e => e.k === k);
    if (index >= 0) {
      episodic.splice(index, 1);
    }
  }

  /**
   * Roll time bands based on world configuration
   */
  private rollTimeBands(
    currentTime: TimeEntry,
    addedTicks: number,
    worldDoc: WorldDoc
  ): TimeEntry {
    const timeConfig = worldDoc.time;
    if (!timeConfig || !timeConfig.bands) {
      // Default time configuration
      return { band: currentTime.band, ticks: currentTime.ticks + addedTicks };
    }

    let totalTicks = currentTime.ticks + addedTicks;
    let currentBand = currentTime.band;
    let bandIndex = timeConfig.bands.findIndex((band: any) => band.name === currentBand);
    
    if (bandIndex === -1) {
      bandIndex = 0; // Default to first band
      currentBand = timeConfig.bands[0].name;
    }

    // Roll through bands
    while (totalTicks >= timeConfig.bands[bandIndex].maxTicks) {
      totalTicks -= timeConfig.bands[bandIndex].maxTicks;
      bandIndex = (bandIndex + 1) % timeConfig.bands.length;
      currentBand = timeConfig.bands[bandIndex].name;
    }

    return { band: currentBand, ticks: totalTicks };
  }

  /**
   * Apply memory hygiene (capping and trimming)
   */
  private applyMemoryHygiene(gameState: GameState, summary: ActApplicationSummary): void {
    const maxEpisodicLength = 60;
    let episodic = gameState.warm.episodic as EpisodicMemory[];
    
    if (!episodic || episodic.length <= maxEpisodicLength) {
      return;
    }

    // Sort by salience (ascending) then by turn (ascending)
    episodic.sort((a, b) => {
      if (a.salience !== b.salience) {
        return a.salience - b.salience;
      }
      return a.t - b.t;
    });

    // Remove excess entries
    const toRemove = episodic.length - maxEpisodicLength;
    episodic.splice(0, toRemove);
    summary.memory.trimmed = toRemove;
  }
}

/**
 * Main function to apply acts to a session
 */
export async function applyActs(params: ApplyActsParams): Promise<ApplyActsResult> {
  // This would need to be passed in from the calling context
  // For now, we'll create a new interpreter instance
  throw new Error('applyActs function requires Supabase client - use ActInterpreter class directly');
}
