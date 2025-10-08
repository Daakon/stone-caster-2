import { supabaseAdmin } from './supabase.js';
import type { Character, WorldTemplate } from '@shared';

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
        currentScene: data.state_snapshot.currentScene || 'opening',
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
    // This would load adventure data from the GPT Prompts or database
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
