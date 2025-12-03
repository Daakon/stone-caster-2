/**
 * Runtime Engine Integration Tests
 * Phase 6-A: The Runtime Engine (Backend Core)
 * 
 * Tests the full game loop: MAS1 -> Engine -> MAS2 -> State Update
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameLoopService } from '../runtime/game-loop.service.js';
import { Mas1Service } from '../runtime/mas1.service.js';
import { EngineService } from '../runtime/engine.service.js';
import { Mas2Service } from '../runtime/mas2.service.js';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import type { GameState, Mas1ResponseDto, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import type { CompiledStory } from '@shared/types/chimera-compiled';

describe('Runtime Engine Integration', () => {
  let mockStoriesRepo: {
    loadGameState: ReturnType<typeof vi.fn>;
    updateGameState: ReturnType<typeof vi.fn>;
    getStoryIdFromGameState: ReturnType<typeof vi.fn>;
    getCompiledStoryById: ReturnType<typeof vi.fn>;
  };

  let gameLoopService: GameLoopService;
  let mas1Service: Mas1Service;
  let engineService: EngineService;
  let mas2Service: Mas2Service;

  beforeEach(() => {
    mockStoriesRepo = {
      loadGameState: vi.fn(),
      updateGameState: vi.fn(),
      getStoryIdFromGameState: vi.fn(),
      getCompiledStoryById: vi.fn(),
    };

    mas1Service = new Mas1Service();
    engineService = new EngineService();
    mas2Service = new Mas2Service();
    gameLoopService = new GameLoopService(
      mockStoriesRepo as unknown as StoriesRepository,
      mas1Service,
      engineService,
      mas2Service
    );
  });

  const createMockGameState = (): GameState => ({
    tier1_mechanical: {
      entities: {
        player: {
          stats: {
            hp: 10,
            str: 3,
          },
        },
        enemy: {
          stats: {
            hp: 10,
          },
        },
      },
    },
    tier0_narrative: {
      memory_stream: [],
    },
  });

  const createMockCompiledStory = (): CompiledStory => ({
    meta: {
      source_ids: ['world-1', 'ruleset-1'],
    },
    master_schema: {
      tier1_allowlist: ['hp', 'str'],
      tier0_allowlist: ['memory_stream'],
      actions_map: {
        attack: JSON.stringify({
          logic: '1d6',
          damage: 4,
        }),
        inspect: JSON.stringify({
          logic: 'none',
        }),
      },
    },
    narrative_index: [],
    initial_state: {},
  });

  describe('Test A: Combat Loop', () => {
    it('should process attack action, calculate damage, update state, and generate narrative', async () => {
      const gameStateId = 'test-game-state-id';
      const storyId = 'test-story-id';
      const initialGameState = createMockGameState();
      const compiledStory = createMockCompiledStory();

      // Mock repository calls
      mockStoriesRepo.loadGameState.mockResolvedValue(initialGameState);
      mockStoriesRepo.getStoryIdFromGameState.mockResolvedValue(storyId);
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.updateGameState.mockImplementation(async (id, state) => {
        // Verify the state was updated
        expect(id).toBe(gameStateId);
        const enemyHp = (state.tier1_mechanical as Record<string, unknown>).entities as Record<string, unknown>;
        const enemy = enemyHp.enemy as Record<string, unknown>;
        const stats = enemy.stats as Record<string, unknown>;
        expect(stats.hp).toBeLessThan(10); // Enemy HP should be reduced
      });

      // Execute game loop
      const result = await gameLoopService.castStone(gameStateId, 'attack enemy');

      // Verify MAS1 result
      expect(result.mas1.action_slug).toBe('attack');
      expect(result.mas1.parameters.target).toBe('enemy');
      expect(result.mas1.sentiment).toBe('aggressive');

      // Verify Engine result
      expect(result.engine.success).toBe(true);
      expect(Object.keys(result.engine.numeric_deltas).length).toBeGreaterThan(0);
      
      // Check that enemy HP delta is negative (damage)
      const enemyHpDelta = result.engine.numeric_deltas['entities.enemy.stats.hp'];
      expect(enemyHpDelta).toBeLessThan(0);

      // Verify MAS2 result
      expect(result.mas2.ripple_narrative).toContain('attack');
      expect(result.mas2.tier0_mutations.memory_stream).toBeDefined();

      // Verify updated state
      const updatedEnemyHp = (result.updatedState.tier1_mechanical.entities as Record<string, unknown>).enemy as Record<string, unknown>;
      const updatedEnemyStats = updatedEnemyHp.stats as Record<string, unknown>;
      expect(updatedEnemyStats.hp).toBeLessThan(10);

      // Verify state was saved
      expect(mockStoriesRepo.updateGameState).toHaveBeenCalledWith(
        gameStateId,
        expect.objectContaining({
          tier1_mechanical: expect.any(Object),
        })
      );
    });
  });

  describe('Test B: Persistence', () => {
    it('should persist state changes to database and reload correctly', async () => {
      const gameStateId = 'test-game-state-id';
      const storyId = 'test-story-id';
      const initialGameState = createMockGameState();
      const compiledStory = createMockCompiledStory();

      let savedState: GameState | null = null;

      // Mock repository calls
      mockStoriesRepo.loadGameState.mockResolvedValue(initialGameState);
      mockStoriesRepo.getStoryIdFromGameState.mockResolvedValue(storyId);
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.updateGameState.mockImplementation(async (id, state) => {
        savedState = state;
      });

      // Execute game loop
      await gameLoopService.castStone(gameStateId, 'attack enemy');

      // Verify state was saved
      expect(mockStoriesRepo.updateGameState).toHaveBeenCalled();

      // Simulate reloading the state
      if (savedState) {
        mockStoriesRepo.loadGameState.mockResolvedValue(savedState);
        
        // Execute another action
        const secondResult = await gameLoopService.castStone(gameStateId, 'attack enemy');
        
        // Verify the enemy HP continues to decrease
        const enemyHp = (secondResult.updatedState.tier1_mechanical.entities as Record<string, unknown>).enemy as Record<string, unknown>;
        const enemyStats = enemyHp.stats as Record<string, unknown>;
        expect(enemyStats.hp).toBeLessThan(10);
      }
    });
  });

  describe('MAS1 Intent Mocking', () => {
    it('should resolve "attack" intent correctly', async () => {
      const gameState = createMockGameState();
      const actionsMap = { attack: {} };

      const result = await mas1Service.resolve('attack the enemy', gameState, actionsMap);

      expect(result.action_slug).toBe('attack');
      expect(result.parameters.target).toBe('enemy');
      expect(result.sentiment).toBe('aggressive');
    });

    it('should resolve "look" intent correctly', async () => {
      const gameState = createMockGameState();
      const actionsMap = { inspect: {} };

      const result = await mas1Service.resolve('look around', gameState, actionsMap);

      expect(result.action_slug).toBe('inspect');
      expect(result.sentiment).toBe('curious');
    });
  });

  describe('Engine Math Resolution', () => {
    it('should parse dice strings and calculate damage', async () => {
      const mas1Result: Mas1ResponseDto = {
        action_slug: 'attack',
        parameters: { target: 'enemy', damage: 4 },
        sentiment: 'aggressive',
      };
      const gameState = createMockGameState();
      const actionsMap = {
        attack: JSON.stringify({
          logic: '1d6',
          damage: 4,
        }),
      };

      const result = await engineService.execute(mas1Result, gameState, actionsMap);

      expect(result.success).toBe(true);
      expect(result.numeric_deltas['entities.enemy.stats.hp']).toBeLessThan(0);
    });

    it('should handle deep path deltas correctly', async () => {
      const mas1Result: Mas1ResponseDto = {
        action_slug: 'attack',
        parameters: { target: 'enemy', damage: 5 },
        sentiment: 'aggressive',
      };
      const gameState = createMockGameState();
      const actionsMap = {
        attack: JSON.stringify({
          logic: '1d6',
          damage: 5,
        }),
      };

      const result = await engineService.execute(mas1Result, gameState, actionsMap);

      // Verify deep path delta exists
      expect(result.numeric_deltas['entities.enemy.stats.hp']).toBe(-5);
    });
  });

  describe('MAS2 Narration Mocking', () => {
    it('should generate narrative from engine result', async () => {
      const engineResult: EngineResultDto = {
        success: true,
        outcome_summary: 'attack',
        numeric_deltas: {
          'entities.enemy.stats.hp': -4,
        },
      };
      const gameState = createMockGameState();

      const result = await mas2Service.narrate(engineResult, gameState);

      expect(result.ripple_narrative).toContain('attack');
      expect(result.ripple_narrative).toContain('damage');
      expect(result.tier0_mutations.memory_stream).toBeDefined();
    });
  });

  describe('State Persistence (HP Changed)', () => {
    it('should persist HP changes to database', async () => {
      const gameStateId = 'test-game-state-id';
      const storyId = 'test-story-id';
      const initialGameState = createMockGameState();
      const compiledStory = createMockCompiledStory();

      let savedState: GameState | null = null;

      mockStoriesRepo.loadGameState.mockResolvedValue(initialGameState);
      mockStoriesRepo.getStoryIdFromGameState.mockResolvedValue(storyId);
      mockStoriesRepo.getCompiledStoryById.mockResolvedValue(compiledStory);
      mockStoriesRepo.updateGameState.mockImplementation(async (id, state) => {
        savedState = state;
      });

      await gameLoopService.castStone(gameStateId, 'attack enemy');

      // Verify HP was changed and persisted
      expect(savedState).not.toBeNull();
      if (savedState) {
        const enemyHp = (savedState.tier1_mechanical.entities as Record<string, unknown>).enemy as Record<string, unknown>;
        const enemyStats = enemyHp.stats as Record<string, unknown>;
        const initialHp = (initialGameState.tier1_mechanical.entities as Record<string, unknown>).enemy as Record<string, unknown>;
        const initialStats = initialHp.stats as Record<string, unknown>;
        
        expect(enemyStats.hp).toBeLessThan(initialStats.hp as number);
      }
    });
  });
});

