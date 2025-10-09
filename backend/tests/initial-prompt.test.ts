import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnsService } from '../src/services/turns.service.js';
import { PromptsService } from '../src/services/prompts.service.js';
import { GamesService } from '../src/services/games.service.js';
import { gameStateService } from '../src/services/game-state.service.js';

// Mock the dependencies
vi.mock('../src/services/games.service.js', () => ({
  gamesService: {
    loadGame: vi.fn(),
    applyTurn: vi.fn(),
  }
}));

vi.mock('../src/services/game-state.service.js', () => ({
  gameStateService: {
    loadGameState: vi.fn(),
    createInitialGameState: vi.fn(),
  }
}));

vi.mock('../src/services/prompts.service.js', () => ({
  promptsService: {
    createInitialPrompt: vi.fn(),
  }
}));

vi.mock('../src/services/ai.js', () => ({
  aiService: {
    generateTurnResponse: vi.fn(),
  }
}));

vi.mock('../src/services/wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    spendCastingStones: vi.fn(),
  }
}));

vi.mock('../src/services/idempotency.service.js', () => ({
  IdempotencyService: {
    checkIdempotency: vi.fn(),
    storeIdempotencyRecord: vi.fn(),
  }
}));

vi.mock('../src/services/debug.service.js', () => ({
  debugService: {
    logAiResponse: vi.fn(),
  }
}));

vi.mock('../src/config/index.js', () => ({
  configService: {
    getPricing: vi.fn(() => ({ pricing: { turn_cost_default: 2 } })),
  }
}));

describe('Initial Prompt Functionality', () => {
  let turnsService: TurnsService;
  let mockGame: any;

  beforeEach(() => {
    vi.clearAllMocks();
    turnsService = new TurnsService();
    
    mockGame = {
      id: 'test-game-id',
      world_slug: 'mystika',
      character_id: 'test-character-id',
      turn_count: 0,
      state_snapshot: {
        currentScene: 'forest_meet',
        character: { name: 'Test Character' },
        adventure: null,
      },
    };
  });

  it('should detect games with zero turns and create initial AI prompt', async () => {
    const { gamesService } = await import('../src/services/games.service.js');
    const { gameStateService } = await import('../src/services/game-state.service.js');
    const { promptsService } = await import('../src/services/prompts.service.js');
    const { aiService } = await import('../src/services/ai.js');
    const { WalletService } = await import('../src/services/wallet.service.js');
    const { IdempotencyService } = await import('../src/services/idempotency.service.js');

    // Mock the service calls
    vi.mocked(gamesService.loadGame).mockResolvedValue(mockGame);
    vi.mocked(gameStateService.loadGameState).mockResolvedValue(null);
    vi.mocked(gameStateService.createInitialGameState).mockResolvedValue({} as any);
    vi.mocked(WalletService.getWallet).mockResolvedValue({ castingStones: 10 });
    vi.mocked(IdempotencyService.checkIdempotency).mockResolvedValue({
      error: null,
      isDuplicate: false,
      existingRecord: undefined,
    });
    vi.mocked(promptsService.createInitialPrompt).mockResolvedValue('Initial prompt text');
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue({
      response: JSON.stringify({
        txt: 'Welcome to the adventure!',
        'optional choices': [
          { choice: 'Begin the quest', outcome: 'Start the adventure' }
        ]
      }),
      debug: { promptText: 'Initial prompt text' }
    });
    vi.mocked(gamesService.applyTurn).mockResolvedValue({ id: 'turn-1' });
    vi.mocked(WalletService.spendCastingStones).mockResolvedValue({ success: true, newBalance: 8 });

    const request = {
      gameId: 'test-game-id',
      optionId: 'game_start',
      owner: 'test-user',
      idempotencyKey: 'test-key',
      isGuest: false,
    };

    const result = await turnsService.runBufferedTurn(request);

    expect(result.success).toBe(true);
    expect(promptsService.createInitialPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-game-id',
        world_id: 'mystika',
        character_id: 'test-character-id',
        turn_index: 0,
      })
    );
    expect(aiService.generateTurnResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-game-id',
        world_id: 'mystika',
        character_id: 'test-character-id',
        turn_index: 0,
      }),
      'game_start',
      [],
      expect.any(Boolean)
    );
    expect(gamesService.applyTurn).toHaveBeenCalled();
  });

  it('should include adventure start JSON in initial prompts', async () => {
    const { promptsService } = await import('../src/services/prompts.service.js');
    
    // Mock the file system to return adventure start data
    const mockAdventureStartData = {
      id: 'adv.whispercross.start.v3',
      title: 'Whispercross Opening',
      start: {
        scene: 'forest_meet',
        policy: 'ai_first',
        hints: ['You cross into Whispercross at dusk.']
      }
    };

    // Mock the loadAdventureStartData method
    const promptsServiceInstance = new PromptsService();
    const loadAdventureStartDataSpy = vi.spyOn(promptsServiceInstance as any, 'loadAdventureStartData');
    loadAdventureStartDataSpy.mockResolvedValue(mockAdventureStartData);

    const gameContext = {
      id: 'test-game-id',
      world_id: 'mystika',
      character_id: 'test-character-id',
      state_snapshot: {},
      turn_index: 0,
    };

    // This would be called internally by buildFileBasedTemplateContext
    const context = await (promptsServiceInstance as any).buildFileBasedTemplateContext(gameContext, 'game_start');
    
    expect(context.turn).toBe(0);
    expect(context.scene_id).toBe('forest_meet'); // Should use the actual starting scene
    expect(context.flags_json).toBe('Begin the adventure');
  });

  it('should not create initial prompt for games with existing turns', async () => {
    const { gamesService } = await import('../src/services/games.service.js');
    const { promptsService } = await import('../src/services/prompts.service.js');
    const { aiService } = await import('../src/services/ai.js');

    // Mock game with existing turns
    const gameWithTurns = { ...mockGame, turn_count: 1 };
    vi.mocked(gamesService.loadGame).mockResolvedValue(gameWithTurns);
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue({
      response: JSON.stringify({
        txt: 'Continue the adventure!',
        'optional choices': [
          { choice: 'Continue', outcome: 'Keep going' }
        ]
      }),
      debug: { promptText: 'Regular prompt text' }
    });

    const request = {
      gameId: 'test-game-id',
      optionId: 'continue',
      owner: 'test-user',
      idempotencyKey: 'test-key',
      isGuest: false,
    };

    await turnsService.runBufferedTurn(request);

    // Should not call createInitialPrompt for games with existing turns
    expect(promptsService.createInitialPrompt).not.toHaveBeenCalled();
  });
});
