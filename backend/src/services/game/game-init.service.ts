/**
 * Game Initialization Service
 * Phase 5: Character Creator & Game Initialization
 * 
 * Transforms a static CompiledStory into a live GameState by:
 * 1. Deep cloning the initial_state
 * 2. Injecting player input (identity, appearance, world extensions)
 * 3. Persisting to database
 */

import type { CompiledStory } from '@shared/types/chimera-compiled';
import type { GameState } from '@shared/types/chimera-runtime';
import { GameStateSchema } from '@shared/types/chimera-runtime';
import { StoriesRepository } from '../../db/repos/stories.repo.js';

export interface PlayerInputDto {
  identity: {
    name: string;
    pronouns?: string;
    role?: string;
    age?: number;
  };
  appearance?: Record<string, unknown>;
  backstory?: string;
  personality_traits?: string[];
  drive?: string;
  flaw?: string;
  // World-specific extensions (dynamic based on world.character_schema_extensions)
  [key: string]: unknown;
}

export class GameInitService {
  constructor(private storiesRepo: StoriesRepository) {}

  /**
   * Initialize a new game from a compiled story
   * @param storyId - The ID of the compiled story
   * @param playerInput - Player character creation data
   * @param playerId - The player's user ID
   * @returns The ID of the created game state
   */
  async initializeGame(
    storyId: string,
    playerInput: PlayerInputDto,
    playerId: string
  ): Promise<string> {
    // Step 1: Fetch CompiledStory from DB
    const compiledStory = await this.storiesRepo.getCompiledStoryById(storyId);
    if (!compiledStory) {
      throw new Error(`Compiled story not found: ${storyId}`);
    }

    // Step 2: Deep clone initial_state
    const gameState = this.deepCloneState(compiledStory.initial_state);

    // Step 3: Layer 3 Injection - Merge playerInput into the state
    this.injectPlayerData(gameState, playerInput);

    // Step 4: Persistence - Insert into chimera_game_states
    const gameStateId = await this.storiesRepo.createGameState(
      storyId,
      gameState,
      playerId
    );

    return gameStateId;
  }

  /**
   * Deep clone the initial state from CompiledStory
   * Ensures modifications don't affect the original CompiledStory
   */
  private deepCloneState(initialState: Record<string, unknown>): GameState {
    // Use JSON serialization for deep cloning
    const cloned = JSON.parse(JSON.stringify(initialState)) as Record<string, unknown>;

    // Ensure it matches GameState structure
    const gameState: GameState = {
      tier1_mechanical: (cloned.tier1_mechanical as Record<string, unknown>) || {},
      tier0_narrative: (cloned.tier0_narrative as Record<string, unknown>) || {},
    };

    // Validate against schema
    return GameStateSchema.parse(gameState);
  }

  /**
   * Inject player input into the game state
   * Merges identity, appearance, and world extensions into the player entity
   */
  private injectPlayerData(gameState: GameState, playerInput: PlayerInputDto): void {
    // Ensure entities structure exists in tier1_mechanical
    if (!gameState.tier1_mechanical.entities) {
      gameState.tier1_mechanical.entities = {};
    }

    const entities = gameState.tier1_mechanical.entities as Record<string, unknown>;
    
    // Ensure player entity exists
    if (!entities.player) {
      entities.player = {};
    }

    const player = entities.player as Record<string, unknown>;

    // Inject identity
    if (!player.identity) {
      player.identity = {};
    }
    const identity = player.identity as Record<string, unknown>;
    identity.name = playerInput.identity.name;
    if (playerInput.identity.pronouns) {
      identity.pronouns = playerInput.identity.pronouns;
    }
    if (playerInput.identity.role) {
      identity.role = playerInput.identity.role;
    }
    if (playerInput.identity.age !== undefined) {
      identity.age = playerInput.identity.age;
    }

    // Inject appearance if provided
    if (playerInput.appearance) {
      player.appearance = playerInput.appearance;
    }

    // Inject narrative profile into tier0_narrative
    if (!gameState.tier0_narrative.player) {
      gameState.tier0_narrative.player = {};
    }
    const playerNarrative = gameState.tier0_narrative.player as Record<string, unknown>;

    if (playerInput.backstory) {
      playerNarrative.backstory = playerInput.backstory;
    }
    if (playerInput.personality_traits) {
      playerNarrative.personality_traits = playerInput.personality_traits;
    }
    if (playerInput.drive) {
      playerNarrative.drive = playerInput.drive;
    }
    if (playerInput.flaw) {
      playerNarrative.flaw = playerInput.flaw;
    }

    // Inject any world-specific extensions (dynamic fields)
    // These come from playerInput but aren't in the standard schema
    const standardFields = new Set([
      'identity',
      'appearance',
      'backstory',
      'personality_traits',
      'drive',
      'flaw',
    ]);

    for (const [key, value] of Object.entries(playerInput)) {
      if (!standardFields.has(key) && key !== 'identity') {
        // This is a world-specific extension
        // Store it in the player entity for easy access
        player[key] = value;
      }
    }
  }
}

