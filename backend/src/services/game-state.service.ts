import { supabaseAdmin } from './supabase.js';
import type { Character, WorldTemplate } from '@shared';
import type { GameStateBundle, ActiveEntity, EntityProperties, NarrativeFocus, MechanicalState, SceneRegistry } from '../domain/game-state.types.js';
import type { CompiledStory } from './compile/compiler.service.js';
import { v4 as uuidv4 } from 'uuid';

export interface GameState {
  id: string;
  gameId: string;
  turnIndex: number;
  currentScene: string;
  character: Character | null;
  world: WorldTemplate;
  adventure: {
    name: string;
    scenes: any[];
    objectives: string[];
    npcs: any[];
    places: any[];
    triggers: any[];
  } | null;
  flags: Record<string, any>;
  ledgers: Record<string, any>;
  presence: string;
  lastActs: any[];
  styleHint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitialGameState {
  gameId: string;
  worldId: string;
  characterId?: string;
  adventureName?: string;
  startingScene: string;
  initialFlags: Record<string, any>;
  initialLedgers: Record<string, any>;
}

export class GameStateService {
  /**
   * Create initial game state for a new game
   */
  async createInitialGameState(params: InitialGameState): Promise<GameState> {
    try {
      // Load world template
      const world = await this.loadWorldTemplate(params.worldId);
      if (!world) {
        throw new Error(`World template not found: ${params.worldId}`);
      }

      // Load character if specified
      let character: Character | null = null;
      if (params.characterId) {
        character = await this.loadCharacter(params.characterId);
      }

      // Load adventure if specified
      let adventure = null;
      if (params.adventureName) {
        adventure = await this.loadAdventure(params.worldId, params.adventureName);
      }

      // Create initial game state
      const gameState: GameState = {
        id: this.generateId(),
        gameId: params.gameId,
        turnIndex: 0,
        currentScene: params.startingScene,
        character,
        world,
        adventure,
        flags: {
          'game.initialized': true,
          'game.world': params.worldId,
          'game.adventure': params.adventureName || null,
          'game.starting_scene': params.startingScene,
          ...params.initialFlags,
        },
        ledgers: {
          'game.turns': 0,
          'game.scenes_visited': [params.startingScene],
          'game.actions_taken': [],
          ...params.initialLedgers,
        },
        presence: 'present',
        lastActs: [],
        styleHint: 'neutral',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await this.saveGameState(gameState);

      console.log(`[GAME_STATE] Initial state created for game ${params.gameId}:`, {
        world: params.worldId,
        adventure: params.adventureName,
        startingScene: params.startingScene,
        character: character?.name || 'Guest',
      });

      return gameState;
    } catch (error) {
      console.error('Error creating initial game state:', error);
      throw new Error(`Failed to create initial game state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * [CHIMERA V3] Initialize Active Game from Story Version (Director's Slate)
   * Hydrates the Genesis Config into a live GameStateBundle.
   */
  async initializeActiveGame(
    gameId: string,
    compiledStory: CompiledStory,
    playerCharacter: Character | null,
    userId: string
  ): Promise<GameStateBundle> {
    try {
      const { genesis_config, snapshot_entities, snapshot_world } = compiledStory;

      // 1. Determine Start Scene
      // Priority: Genesis Config > World First Scene > "default"
      const startingSceneId = genesis_config?.opening_action?.scene_id || 'scene_start_01'; // Fallback

      // 2. Hydrate Extras (Factory Pattern) & Setup Roster
      const entities: Record<string, ActiveEntity> = {};
      const entityVisuals: Record<string, string> = {};

      // A. Player Entity
      let playerId = 'player_main';
      if (playerCharacter) {
        playerId = playerCharacter.id;
        entities[playerId] = {
          id: playerId,
          type: 'PLAYER',
          status: 'active',
          properties: {
            name: playerCharacter.name,
            is_known: true,
            visual_name: playerCharacter.name,
            visual_tags: ['Hero'], // Basic tag
            ...playerCharacter.attributes, // Spread existing attributes
            location_id: startingSceneId // [Refinement] Assign to Start Scene
          }
        };
        entityVisuals[playerId] = playerCharacter.description || 'A mysterious hero.';
      }

      // B. Hydrate Extras from Genesis Config
      if (genesis_config?.initial_cast) {
        for (const extra of genesis_config.initial_cast) {
          // Generate ID if deterministic one isn't provided, but ideally we use the one from config if versioned
          const extraId = extra.id || uuidv4();

          entities[extraId] = {
            id: extraId,
            type: 'NPC',
            status: 'active',
            properties: {
              name: extra.name || 'Unknown',
              visual_name: extra.visual_alias || extra.name || 'Unknown',
              visual_tags: [
                extra.role || 'Extra',
                ...(extra.visual_tags || [])
              ],
              is_known: false, // Default to unknown
              location_id: startingSceneId, // [Refinement] Assign to Start Scene
              ...extra.properties
            }
          };

          // Tag as Genesis Extra
          if (!entities[extraId].properties.tags) entities[extraId].properties.tags = [];
          (entities[extraId].properties.tags as string[]).push('genesis_extra');

          entityVisuals[extraId] = extra.description || '';
        }
      }

      // C. Merge Stars (Snapshot Entities)
      // These are full entities defined in the story version
      if (snapshot_entities) {
        for (const star of snapshot_entities) {
          // Only add if not already present (Player might override)
          if (!entities[star.id]) {
            entities[star.id] = {
              id: star.id,
              type: 'NPC', // Assume NPC for stars unless specified
              status: 'active',
              properties: {
                ...star.properties,
                // Ensure location is set if missing, defaults to start or "off_stage"
                location_id: star.properties.location_id || 'off_stage'
              }
            };
            entityVisuals[star.id] = (star.properties as any).description || '';
          }
        }
      }

      // 3. Construct Narrative Focus (The Stage)
      const narrative: NarrativeFocus = {
        scene_context: {
          name: genesis_config?.opening_action?.title || 'The Beginning',
          description: genesis_config?.set_design?.atmosphere || 'A quiet moment before the storm.',
          atmosphere: genesis_config?.set_design?.atmosphere
        },
        entity_visuals: entityVisuals,
        dialogue_history: [], // Will inject Turn 0 next
        director_instructions: {
          tone: genesis_config?.narrative_style?.tone || 'neutral',
          pacing: genesis_config?.narrative_style?.pacing || 'moderate',
          perspective: genesis_config?.narrative_style?.perspective || 'third_person_limited' // Default
        }
      };

      // [Refinement] 4. Inject Turn 0 System Message
      if (narrative.director_instructions) {
        narrative.dialogue_history.push({
          speaker: 'System',
          type: 'system',
          text: `[DIRECTOR INSTRUCTIONS]: Tone=${narrative.director_instructions.tone}, Pacing=${narrative.director_instructions.pacing}.`
        });
      }

      // 5. Construct Mechanical State
      const mechanical: MechanicalState = {
        globals: {
          time: 0,
          danger_level: 0,
          round_index: 0
        },
        entities: entities,
        index: {
          player_id: playerId
        }
      };

      // 6. Construct Registry
      const registry: SceneRegistry = {
        active_scene_id: startingSceneId,
        entity_locations: Object.values(entities).reduce((acc, entity) => {
          acc[entity.id] = entity.properties.location_id;
          return acc;
        }, {} as Record<string, string>),
        node_states: {} // Initial node states
      };

      // 7. Bundle result
      const bundle: GameStateBundle = {
        mechanical,
        narrative,
        registry,
        queue: []
      };

      // 8. Persist (Store as snapshot in games table)
      // We map the bundle to the legacy 'state_snapshot' JSONB column via saveGameState (adapter needed)
      // OR we just return the bundle and let the caller handle persistence.
      // For now, let's just return the bundle.

      console.log(`[GAME_INIT] Initialized V3 Game ${gameId} with ${Object.keys(entities).length} entities.`);
      return bundle;

    } catch (error) {
      console.error('[GAME_INIT] Failed to initialize active game:', error);
      throw error;
    }
  }

  /**
   * Load game state by game ID
   * Note: Game state is now stored in the games table's state_snapshot column
   */
  async loadGameState(gameId: string): Promise<GameState | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('games')
        .select('id, state_snapshot, turn_count, world_slug, character_id, adventure_id')
        .eq('id', gameId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No game found
        }
        throw error;
      }

      if (!data.state_snapshot) {
        return null; // No state snapshot found
      }

      // Convert games table data to GameState format
      return {
        id: data.id,
        gameId: data.id,
        turnIndex: data.turn_count || 0,
        currentScene: data.state_snapshot.currentScene || 'forest_meet',
        character: data.state_snapshot.character || null,
        world: data.state_snapshot.world || null,
        adventure: data.state_snapshot.adventure || null,
        flags: data.state_snapshot.flags || {},
        ledgers: data.state_snapshot.ledgers || {},
        presence: data.state_snapshot.presence || 'present',
        lastActs: data.state_snapshot.lastActs || [],
        styleHint: data.state_snapshot.styleHint || 'neutral',
        createdAt: data.state_snapshot.createdAt || new Date().toISOString(),
        updatedAt: data.state_snapshot.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error loading game state:', error);
      return null;
    }
  }

  /**
   * Update game state with new turn data
   */
  async updateGameState(
    gameId: string,
    turnIndex: number,
    updates: Partial<GameState>
  ): Promise<GameState> {
    try {
      const currentState = await this.loadGameState(gameId);
      if (!currentState) {
        throw new Error(`Game state not found: ${gameId}`);
      }

      const updatedState: GameState = {
        ...currentState,
        ...updates,
        turnIndex,
        updatedAt: new Date().toISOString(),
      };

      await this.saveGameState(updatedState);

      console.log(`[GAME_STATE] State updated for game ${gameId} turn ${turnIndex}:`, {
        scene: updatedState.currentScene,
        flags: Object.keys(updatedState.flags).length,
        ledgers: Object.keys(updatedState.ledgers).length,
        lastActs: updatedState.lastActs.length,
      });

      return updatedState;
    } catch (error) {
      console.error('Error updating game state:', error);
      throw new Error(`Failed to update game state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply actions to game state
   */
  async applyActions(
    gameId: string,
    turnIndex: number,
    actions: any[]
  ): Promise<GameState> {
    try {
      const currentState = await this.loadGameState(gameId);
      if (!currentState) {
        throw new Error(`Game state not found: ${gameId}`);
      }

      // Apply each action to the state
      const updatedState = { ...currentState };
      const changes: any[] = [];

      for (const action of actions) {
        const change = await this.applyAction(updatedState, action);
        if (change) {
          changes.push(change);
        }
      }

      // Update turn index and last acts
      updatedState.turnIndex = turnIndex;
      updatedState.lastActs = actions;
      updatedState.ledgers['game.turns'] = turnIndex;
      updatedState.ledgers['game.actions_taken'] = [
        ...(updatedState.ledgers['game.actions_taken'] || []),
        ...actions,
      ];

      // Save updated state
      await this.saveGameState(updatedState);

      console.log(`[GAME_STATE] Applied ${actions.length} actions to game ${gameId} turn ${turnIndex}:`, {
        changes: changes.length,
        newScene: updatedState.currentScene,
        newFlags: Object.keys(updatedState.flags).length,
      });

      return updatedState;
    } catch (error) {
      console.error('Error applying actions:', error);
      throw new Error(`Failed to apply actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply a single action to game state
   */
  private async applyAction(state: GameState, action: any): Promise<any> {
    // Validate action against registry
    const { validateAction } = await import('./action-validation.service.js');
    const storyId = state.adventure?.name ? undefined : undefined; // TODO: Get story ID from state
    const validation = await validateAction(action, storyId);

    if (!validation.valid) {
      // Check if we should reject or allow
      if (validation.reason === 'unknown_action' && process.env.ALLOW_UNKNOWN_ACTIONS !== 'false') {
        // Allow unknown actions when flag is set
        console.warn(`[GAME_STATE] Unknown action ${action.t} allowed (ALLOW_UNKNOWN_ACTIONS=true)`);
      } else {
        // Reject invalid actions
        throw new Error(`Action validation failed: ${validation.reason}${validation.errors ? ` - ${JSON.stringify(validation.errors)}` : ''}`);
      }
    }

    // If action is registered and valid, try to use registry reducer
    const { actionRegistry } = await import('../actions/registry.js');
    const entry = actionRegistry.get(action.t);

    if (entry && entry.owner !== 'core') {
      // Use module reducer
      try {
        // Try to get storyId from state (may need to be passed differently in production)
        const storyId = state.gameId ? undefined : undefined; // TODO: Get actual story ID

        const result = entry.applyFn(state, action.payload, storyId);
        // Handle both sync and async reducers
        const updatedState = result instanceof Promise ? await result : result;

        // Update state in place (reducer returns new state)
        Object.assign(state, updatedState);

        return {
          action,
          timestamp: new Date().toISOString(),
          changes: [{ type: 'module_action', actionType: action.t }],
        };
      } catch (error) {
        console.error(`[GAME_STATE] Error applying module action ${action.t}:`, error);
        throw error;
      }
    }

    // Fall back to core action handlers
    const change = {
      action,
      timestamp: new Date().toISOString(),
      changes: [] as any[],
    };

    switch (action.t) {
      case 'MOVE':
        if (action.payload?.to?.name) {
          state.currentScene = action.payload.to.name;
          state.ledgers['game.scenes_visited'] = [
            ...(state.ledgers['game.scenes_visited'] || []),
            action.payload.to.name,
          ];
          change.changes.push({
            type: 'scene_change',
            from: state.currentScene,
            to: action.payload.to.name,
          });
        }
        break;

      case 'FLAG_SET':
        if (action.payload?.key && action.payload?.value !== undefined) {
          state.flags[action.payload.key] = action.payload.value;
          change.changes.push({
            type: 'flag_set',
            key: action.payload.key,
            value: action.payload.value,
          });
        }
        break;

      case 'STAT_DELTA':
        if (action.payload?.key && action.payload?.delta && state.character) {
          const currentValue = (state.character as any).stats?.[action.payload.key] || 0;
          (state.character as any).stats = {
            ...(state.character as any).stats,
            [action.payload.key]: currentValue + action.payload.delta,
          };
          change.changes.push({
            type: 'stat_change',
            key: action.payload.key,
            delta: action.payload.delta,
            newValue: currentValue + action.payload.delta,
          });
        }
        break;

      case 'TIME_ADVANCE':
        if (action.payload?.minutes) {
          state.ledgers['game.time_elapsed'] = (state.ledgers['game.time_elapsed'] || 0) + action.payload.minutes;
          change.changes.push({
            type: 'time_advance',
            minutes: action.payload.minutes,
            totalElapsed: state.ledgers['game.time_elapsed'],
          });
        }
        break;

      case 'NPC_ADD':
        if (action.payload?.who?.name) {
          state.ledgers['game.npcs_met'] = [
            ...(state.ledgers['game.npcs_met'] || []),
            action.payload.who.name,
          ];
          change.changes.push({
            type: 'npc_added',
            name: action.payload.who.name,
          });
        }
        break;

      case 'PLACE_ADD':
        if (action.payload?.where?.name) {
          state.ledgers['game.places_discovered'] = [
            ...(state.ledgers['game.places_discovered'] || []),
            action.payload.where.name,
          ];
          change.changes.push({
            type: 'place_added',
            name: action.payload.where.name,
          });
        }
        break;

      default:
        // Log unknown action type
        change.changes.push({
          type: 'unknown_action',
          actionType: action.t,
          payload: action.payload,
        });
    }

    return change.changes.length > 0 ? change : null;
  }

  /**
   * Save game state to database
   * Note: Game state is now stored in the games table's state_snapshot column
   */
  private async saveGameState(state: GameState): Promise<void> {
    const stateSnapshot = {
      turnIndex: state.turnIndex,
      currentScene: state.currentScene,
      character: state.character,
      world: state.world,
      adventure: state.adventure,
      flags: state.flags,
      ledgers: state.ledgers,
      presence: state.presence,
      lastActs: state.lastActs,
      styleHint: state.styleHint,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };

    const { error } = await supabaseAdmin
      .from('games')
      .update({
        state_snapshot: stateSnapshot,
        turn_count: state.turnIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', state.gameId);

    if (error) {
      throw error;
    }
  }

  /**
   * Serialize game state for database storage
   */
  private serializeGameState(state: GameState): any {
    return {
      id: state.id,
      game_id: state.gameId,
      turn_index: state.turnIndex,
      current_scene: state.currentScene,
      character_data: state.character,
      world_data: state.world,
      adventure_data: state.adventure,
      flags: state.flags,
      ledgers: state.ledgers,
      presence: state.presence,
      last_acts: state.lastActs,
      style_hint: state.styleHint,
      created_at: state.createdAt,
      updated_at: state.updatedAt,
    };
  }

  /**
   * Deserialize game state from database
   */
  private deserializeGameState(data: any): GameState {
    return {
      id: data.id,
      gameId: data.game_id,
      turnIndex: data.turn_index,
      currentScene: data.current_scene,
      character: data.character_data,
      world: data.world_data,
      adventure: data.adventure_data,
      flags: data.flags || {},
      ledgers: data.ledgers || {},
      presence: data.presence || 'present',
      lastActs: data.last_acts || [],
      styleHint: data.style_hint,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Load world template
   */
  private async loadWorldTemplate(worldSlug: string): Promise<WorldTemplate | null> {
    try {
      // Use ContentService to load world data by slug
      const { ContentService } = await import('./content.service.js');
      const worldData = await ContentService.getWorldBySlug(worldSlug);

      if (!worldData) {
        console.error(`World not found: ${worldSlug}`);
        return null;
      }

      // Convert ContentService world data to WorldTemplate format
      const worldTemplate: WorldTemplate = {
        id: worldData.slug, // Use slug as ID for compatibility
        name: worldData.name || worldData.slug,
        title: worldData.name || worldData.slug,
        tagline: worldData.description || '',
        description: worldData.description || '',
        genre: 'fantasy', // Default genre
        setting: worldData.description || '',
        themes: worldData.tags || [],
        availableRaces: ['Human', 'Elf', 'Dwarf'], // Default races
        availableClasses: ['Fighter', 'Mage', 'Rogue'], // Default classes
        startingPrompt: `Welcome to ${worldData.name || worldData.slug}! ${worldData.description || ''}`,
        rules: {
          allowMagic: true,
          allowTechnology: false,
          difficultyLevel: 'medium',
          combatSystem: 'd20',
        },
        isPublic: true,
        createdBy: undefined,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      return worldTemplate;
    } catch (error) {
      console.error('Unexpected error loading world template:', error);
      return null;
    }
  }

  /**
   * Load character
   */
  private async loadCharacter(characterId: string): Promise<Character | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();

      if (error) {
        console.error('Error loading character:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error loading character:', error);
      return null;
    }
  }

  /**
   * Load adventure data
   */
  private async loadAdventure(worldId: string, adventureName: string): Promise<any> {
    // This would load adventure data from the database
    // For now, return a basic structure
    return {
      name: adventureName,
      scenes: [],
      objectives: [],
      npcs: [],
      places: [],
      triggers: [],
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `game_state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const gameStateService = new GameStateService();
