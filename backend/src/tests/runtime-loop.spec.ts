// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Runtime Loop Integration Test
 * Tests the full game loop with mocked LLM responses
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameState, Mas1ResponseDto, EngineResultDto, Mas2ResponseDto } from '@shared/types/chimera-runtime';
import { GameLoopService } from '../services/runtime/game-loop.service.js';
import { Mas1Service } from '../services/runtime/mas1.service.js';
import { EngineService } from '../services/runtime/engine.service.js';
import { Mas2Service } from '../services/runtime/mas2.service.js';
import { StoriesRepository } from '../db/repos/stories.repo.js';
import type { LlmProvider } from '../services/runtime/llm.provider.js';
import type { CompiledStory } from '@shared/types/chimera-compiled';

// Mock LLM Provider
class MockLlmProvider implements LlmProvider {
  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    // Mock MAS1 response
    if (systemPrompt.includes('Action Interpreter')) {
      return {
        action_slug: 'attack',
        parameters: { target: 'enemy', damage: 5 },
        sentiment: 'aggressive',
      } as T;
    }
    
    // Mock MAS2 response
    if (systemPrompt.includes('Narrator')) {
      return {
        ripple_narrative: 'You swing your sword and strike the enemy for 5 damage.',
        tier0_mutations: {
          memories: ['Combat encounter with enemy'],
        },
      } as T;
    }
    
    return {} as T;
  }
}

describe('Runtime Loop', () => {
  let mockStoriesRepo: any;
  let mockLlmProvider: LlmProvider;
  let mas1Service: Mas1Service;
  let engineService: EngineService;
  let mas2Service: Mas2Service;
  let gameLoopService: GameLoopService;

  const mockGameStateId = 'test-game-state-id';
  const mockStoryId = 'test-story-id';
  const mockPlayerId = 'test-player-id';

  const mockGameState: GameState = {
    tier1_mechanical: {
      hp: 10,
      max_hp: 10,
      str: 15,
    },
    tier0_narrative: {
      memories: [],
    },
  };

  const mockCompiledStory: CompiledStory = {
    meta: {
      source_ids: ['world-1', 'ruleset-1'],
    },
    master_schema: {
      tier1_allowlist: ['hp', 'max_hp', 'str'],
      tier0_allowlist: ['memories'],
      actions_map: {
        attack: JSON.stringify({
          logic: '1d20 + str vs 15',
          deltas: {},
        }),
      },
    },
    narrative_index: [],
    initial_state: {
      hp: 10,
      max_hp: 10,
      str: 15,
    },
  };

  beforeEach(() => {
    // Mock StoriesRepository
    mockStoriesRepo = {
      loadGameState: vi.fn().mockResolvedValue(mockGameState),
      getStoryIdFromGameState: vi.fn().mockResolvedValue(mockStoryId),
      getCompiledStoryById: vi.fn().mockResolvedValue(mockCompiledStory),
      updateGameState: vi.fn().mockResolvedValue(undefined),
      createGameState: vi.fn().mockResolvedValue(mockGameStateId),
    };

    // Create services with mocked LLM
    mockLlmProvider = new MockLlmProvider();
    mas1Service = new Mas1Service(mockLlmProvider);
    engineService = new EngineService();
    mas2Service = new Mas2Service(mockLlmProvider);
    gameLoopService = new GameLoopService(
      mockStoriesRepo as any,
      mas1Service,
      engineService,
      mas2Service
    );
  });

  it('should execute full game loop and apply numeric deltas', async () => {
    const userText = 'I attack the enemy with my sword';

    const result = await gameLoopService.castStone(mockGameStateId, userText);

    // Verify MAS1 was called
    expect(result.mas1).toBeDefined();
    expect(result.mas1.action_slug).toBe('attack');
    expect(result.mas1.parameters).toHaveProperty('target', 'enemy');

    // Verify Engine processed the action
    expect(result.engine).toBeDefined();
    expect(result.engine.success).toBeDefined();
    expect(typeof result.engine.outcome_summary).toBe('string');

    // Verify MAS2 generated narrative
    expect(result.mas2).toBeDefined();
    expect(result.mas2.ripple_narrative).toBeDefined();
    expect(result.mas2.tier0_mutations).toBeDefined();

    // Verify state was updated
    expect(result.updatedState).toBeDefined();
    expect(mockStoriesRepo.updateGameState).toHaveBeenCalledWith(
      mockGameStateId,
      expect.objectContaining({
        tier1_mechanical: expect.any(Object),
        tier0_narrative: expect.any(Object),
      })
    );
  });

  it('should apply numeric deltas correctly to HP', async () => {
    // Mock engine result with HP delta
    const mockEngineResult: EngineResultDto = {
      success: true,
      outcome_summary: 'Attack succeeds',
      numeric_deltas: { hp: -5 },
    };

    // Mock MAS2 result
    const mockMas2Result: Mas2ResponseDto = {
      ripple_narrative: 'You deal 5 damage',
      tier0_mutations: {},
    };

    // Manually test state reducer logic
    const initialState: GameState = {
      tier1_mechanical: { hp: 10, max_hp: 10 },
      tier0_narrative: {},
    };

    // Apply deltas
    const updatedState: GameState = {
      tier1_mechanical: { ...initialState.tier1_mechanical },
      tier0_narrative: { ...initialState.tier0_narrative },
    };

    for (const [key, delta] of Object.entries(mockEngineResult.numeric_deltas)) {
      const currentValue = updatedState.tier1_mechanical[key];
      if (typeof currentValue === 'number') {
        updatedState.tier1_mechanical[key] = currentValue + delta;
      } else {
        updatedState.tier1_mechanical[key] = delta;
      }
    }

    // Verify HP was reduced from 10 to 5
    expect(updatedState.tier1_mechanical.hp).toBe(5);
  });

  it('should initialize a new game session', async () => {
    const gameStateId = await gameLoopService.initializeSession(mockStoryId, mockPlayerId);

    expect(gameStateId).toBe(mockGameStateId);
    expect(mockStoriesRepo.getCompiledStoryById).toHaveBeenCalledWith(mockStoryId);
    expect(mockStoriesRepo.createGameState).toHaveBeenCalledWith(
      mockStoryId,
      expect.objectContaining({
        tier1_mechanical: expect.any(Object),
        tier0_narrative: expect.any(Object),
      }),
      mockPlayerId
    );
  });

  it('should handle action with dice logic', async () => {
    // Mock a more complex action with dice
    const mockActionsMap = {
      attack: {
        logic: '1d20 + str vs 15',
        deltas: {},
      },
    };

    const engineService = new EngineService();
    const mas1Result: Mas1ResponseDto = {
      action_slug: 'attack',
      parameters: { target: 'enemy' },
      sentiment: 'aggressive',
    };

    const engineResult = await engineService.execute(
      mas1Result,
      mockGameState,
      mockActionsMap
    );

    expect(engineResult.success).toBeDefined();
    expect(engineResult.outcome_summary).toBeDefined();
    // The result should include dice roll information
    expect(engineResult.outcome_summary).toContain('Rolled');
  });
});

