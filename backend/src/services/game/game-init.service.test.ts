/**
 * Game Initialization Service Tests
 * Phase 5: Character Creator & Game Initialization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameInitService, PlayerInputDto } from './game-init.service';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';
import type { GameState } from '@shared/types/chimera-runtime';

describe('GameInitService', () => {
  let service: GameInitService;
  let mockStoriesRepo: {
    getCompiledStoryById: ReturnType<typeof vi.fn>;
    createGameState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStoriesRepo = {
      getCompiledStoryById: vi.fn(),
      createGameState: vi.fn(),
    };

    service = new GameInitService(mockStoriesRepo as unknown as StoriesRepository);
  });

  const createMockCompiledStory = (): CompiledStory => ({
    meta: {
      source_ids: ['world-1', 'ruleset-1'],
    },
    master_schema: {
      tier1_allowlist: ['hp', 'mana'],
      tier0_allowlist: ['memory_stream'],
      actions_map: {},
    },
    narrative_index: [],
    initial_state: {
      tier1_mechanical: {
        hp: 100,
        mana: 50,
        entities: {
          player: {
            // Empty player entity to be populated
          },
        },
      },
      tier0_narrative: {
        memory_stream: [],
        active_quests: [],
      },
    },
  });

  describe('Test 1: State Cloning (Deep Copy)', () => {
    it('should create a deep copy of initial_state that does not affect the original', async () => {
      const compiledStory = createMockCompiledStory();
      const originalHp = (compiledStory.initial_state.tier1_mechanical as Record<string, unknown>).hp;

      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        // Modify the state to verify it's a copy
        (state.tier1_mechanical as Record<string, unknown>).hp = 999;
        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      // Verify the original CompiledStory was not modified
      expect((compiledStory.initial_state.tier1_mechanical as Record<string, unknown>).hp).toBe(originalHp);
      expect((compiledStory.initial_state.tier1_mechanical as Record<string, unknown>).hp).toBe(100);
    });

    it('should preserve all initial state values in the cloned state', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        // Verify the cloned state has all original values
        const tier1 = state.tier1_mechanical as Record<string, unknown>;
        expect(tier1.hp).toBe(100);
        expect(tier1.mana).toBe(50);
        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });
  });

  describe('Test 2: Player Data Injection', () => {
    it('should inject player identity into gameState.tier1_mechanical.entities.player.identity', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const entities = (state.tier1_mechanical as Record<string, unknown>).entities as Record<string, unknown>;
        const player = entities.player as Record<string, unknown>;
        const identity = player.identity as Record<string, unknown>;

        expect(identity.name).toBe('Test Player');
        expect(identity.pronouns).toBe('they/them');
        expect(identity.role).toBe('Adventurer');
        expect(identity.age).toBe(25);

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
          pronouns: 'they/them',
          role: 'Adventurer',
          age: 25,
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });

    it('should inject appearance into player entity', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const entities = (state.tier1_mechanical as Record<string, unknown>).entities as Record<string, unknown>;
        const player = entities.player as Record<string, unknown>;

        expect(player.appearance).toEqual({
          height: 'tall',
          build: 'athletic',
        });

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
        appearance: {
          height: 'tall',
          build: 'athletic',
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });

    it('should inject narrative profile into tier0_narrative.player', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const playerNarrative = (state.tier0_narrative as Record<string, unknown>).player as Record<string, unknown>;

        expect(playerNarrative.backstory).toBe('A mysterious past');
        expect(playerNarrative.personality_traits).toEqual(['brave', 'curious']);
        expect(playerNarrative.drive).toBe('Seek the truth');
        expect(playerNarrative.flaw).toBe('Too trusting');

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
        backstory: 'A mysterious past',
        personality_traits: ['brave', 'curious'],
        drive: 'Seek the truth',
        flaw: 'Too trusting',
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });
  });

  describe('Test 3: Stats Preservation', () => {
    it('should preserve stats generated by the Compiler (e.g., hp: 100)', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const tier1 = state.tier1_mechanical as Record<string, unknown>;
        
        // Verify stats from compiler are preserved
        expect(tier1.hp).toBe(100);
        expect(tier1.mana).toBe(50);

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });

    it('should preserve tier0_narrative structure from compiler', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const tier0 = state.tier0_narrative as Record<string, unknown>;
        
        // Verify tier0 structure is preserved
        expect(Array.isArray(tier0.memory_stream)).toBe(true);
        expect(Array.isArray(tier0.active_quests)).toBe(true);
        expect((tier0.memory_stream as unknown[]).length).toBe(0);
        expect((tier0.active_quests as unknown[]).length).toBe(0);

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });
  });

  describe('World Extensions', () => {
    it('should inject world-specific extensions into player entity', async () => {
      const compiledStory = createMockCompiledStory();
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.createGameState.mockImplementation(async (storyId, state) => {
        const entities = (state.tier1_mechanical as Record<string, unknown>).entities as Record<string, unknown>;
        const player = entities.player as Record<string, unknown>;

        // Verify world-specific extensions are stored
        expect(player.essence_alignment).toBe('light');
        expect(player.faction).toBe('Guardians');

        return 'game-state-id';
      });

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
        essence_alignment: 'light',
        faction: 'Guardians',
      };

      await service.initializeGame('story-id', playerInput, 'player-id');

      expect(mockStoriesRepo.createGameState).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error if compiled story not found', async () => {
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(null);

      const playerInput: PlayerInputDto = {
        identity: {
          name: 'Test Player',
        },
      };

      await expect(
        service.initializeGame('non-existent-id', playerInput, 'player-id')
      ).rejects.toThrow('Compiled story not found');
    });
  });
});

