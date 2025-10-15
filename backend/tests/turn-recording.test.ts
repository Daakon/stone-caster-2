import { describe, it, expect, beforeEach, vi } from 'vitest';
import { turnsService } from '../src/services/turns.service.js';
import { gamesService } from '../src/services/games.service.js';
import { aiService } from '../src/services/ai.js';

// Mock dependencies
vi.mock('../src/services/games.service.js', () => ({
  gamesService: {
    loadGame: vi.fn(),
    applyTurn: vi.fn(),
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

describe('Turn Data Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should capture user input data during turn processing', async () => {
    // Mock game data
    const mockGame = {
      id: 'test-game-id',
      turn_count: 1,
      world_slug: 'mystika',
      state_snapshot: {
        currentScene: 'forest_meet',
        character: { name: 'Test Character' },
        adventure: { name: 'Test Adventure' }
      }
    };

    // Mock AI response with comprehensive metadata
    const mockAiResponse = {
      response: JSON.stringify({
        txt: 'The forest whispers around you...',
        'optional choices': [
          { choice: 'Look around', outcome: 'You see ancient trees' },
          { choice: 'Continue forward', outcome: 'You walk deeper into the forest' }
        ]
      }),
      promptData: 'Full prompt text sent to AI',
      promptMetadata: {
        sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
        tokenCount: 1500,
        assembledAt: new Date().toISOString(),
        length: 5000
      },
      model: 'gpt-4',
      tokenCount: 2000,
      promptId: 'prompt-12345-abc'
    };

    // Mock service responses
    vi.mocked(gamesService.loadGame).mockResolvedValue(mockGame);
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue(mockAiResponse);
    vi.mocked(gamesService.applyTurn).mockResolvedValue({
      id: 'turn-123',
      game_id: 'test-game-id',
      turn_number: 2,
      created_at: new Date().toISOString()
    });

    // Mock other dependencies
    const { WalletService } = await import('../src/services/wallet.service.js');
    const { IdempotencyService } = await import('../src/services/idempotency.service.js');
    
    vi.mocked(WalletService.getWallet).mockResolvedValue({ castingStones: 100 });
    vi.mocked(WalletService.spendCastingStones).mockResolvedValue({ success: true });
    vi.mocked(IdempotencyService.checkIdempotency).mockResolvedValue({
      error: null,
      isDuplicate: false
    });
    vi.mocked(IdempotencyService.storeIdempotencyRecord).mockResolvedValue();

    // Test turn request with user input data
    const turnRequest = {
      gameId: 'test-game-id',
      optionId: 'test-option-id',
      owner: 'test-user-id',
      idempotencyKey: 'test-key',
      isGuest: false,
      userInput: 'I want to explore the forest',
      userInputType: 'text' as const
    };

    // Execute turn
    const result = await turnsService.runBufferedTurn(turnRequest);

    // Verify comprehensive turn data was passed to applyTurn
    expect(gamesService.applyTurn).toHaveBeenCalledWith(
      'test-game-id',
      expect.any(Object), // AI response
      'test-option-id',
      expect.objectContaining({
        userInput: 'I want to explore the forest',
        userInputType: 'text',
        promptData: 'Full prompt text sent to AI',
        promptMetadata: expect.objectContaining({
          sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
          tokenCount: 1500
        }),
        aiResponseMetadata: expect.objectContaining({
          model: 'gpt-4',
          tokenCount: 2000,
          promptId: 'prompt-12345-abc'
        }),
        processingTimeMs: expect.any(Number)
      })
    );

    expect(result.success).toBe(true);
  });

  it('should handle different user input types', async () => {
    const mockGame = {
      id: 'test-game-id',
      turn_count: 0,
      world_slug: 'mystika',
      state_snapshot: {}
    };

    vi.mocked(gamesService.loadGame).mockResolvedValue(mockGame);
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue({
      response: JSON.stringify({ txt: 'Welcome to the adventure!' }),
      promptData: 'Complete initial prompt with all sections',
      promptMetadata: { 
        sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
        tokenCount: 100,
        assembledAt: new Date().toISOString(),
        length: 500
      },
      model: 'gpt-4',
      tokenCount: 150,
      promptId: 'initial-prompt'
    });

    // Mock other dependencies
    const { WalletService } = await import('../src/services/wallet.service.js');
    const { IdempotencyService } = await import('../src/services/idempotency.service.js');
    
    vi.mocked(WalletService.getWallet).mockResolvedValue({ castingStones: 100 });
    vi.mocked(WalletService.spendCastingStones).mockResolvedValue({ success: true });
    vi.mocked(IdempotencyService.checkIdempotency).mockResolvedValue({
      error: null,
      isDuplicate: false
    });
    vi.mocked(IdempotencyService.storeIdempotencyRecord).mockResolvedValue();

    // Test with choice input type
    const choiceRequest = {
      gameId: 'test-game-id',
      optionId: 'choice-123',
      owner: 'test-user-id',
      idempotencyKey: 'test-key',
      isGuest: false,
      userInput: 'Look around',
      userInputType: 'choice' as const
    };

    vi.mocked(gamesService.applyTurn).mockResolvedValue({
      id: 'turn-123',
      game_id: 'test-game-id',
      turn_number: 1,
      created_at: new Date().toISOString()
    });

    const result = await turnsService.runBufferedTurn(choiceRequest);

    expect(gamesService.applyTurn).toHaveBeenCalledWith(
      'test-game-id',
      expect.any(Object),
      'choice-123',
      expect.objectContaining({
        userInput: 'Look around',
        userInputType: 'choice'
      })
    );

    expect(result.success).toBe(true);
  });

  it('should record AI response metadata correctly', async () => {
    const mockGame = {
      id: 'test-game-id',
      turn_count: 1,
      world_slug: 'mystika',
      state_snapshot: { currentScene: 'forest' }
    };

    const mockAiResponse = {
      response: JSON.stringify({
        txt: 'The adventure continues...',
        'optional choices': [{ choice: 'Continue', outcome: 'You move forward' }]
      }),
      promptData: 'Complete prompt with all sections',
      promptMetadata: {
        sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
        tokenCount: 2000,
        assembledAt: new Date().toISOString(),
        length: 8000
      },
      model: 'gpt-4-turbo',
      tokenCount: 3000,
      promptId: 'prompt-67890-def'
    };

    vi.mocked(gamesService.loadGame).mockResolvedValue(mockGame);
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue(mockAiResponse);
    vi.mocked(gamesService.applyTurn).mockResolvedValue({
      id: 'turn-456',
      game_id: 'test-game-id',
      turn_number: 2,
      created_at: new Date().toISOString()
    });

    // Mock other dependencies
    const { WalletService } = await import('../src/services/wallet.service.js');
    const { IdempotencyService } = await import('../src/services/idempotency.service.js');
    
    vi.mocked(WalletService.getWallet).mockResolvedValue({ castingStones: 100 });
    vi.mocked(WalletService.spendCastingStones).mockResolvedValue({ success: true });
    vi.mocked(IdempotencyService.checkIdempotency).mockResolvedValue({
      error: null,
      isDuplicate: false
    });
    vi.mocked(IdempotencyService.storeIdempotencyRecord).mockResolvedValue();

    const turnRequest = {
      gameId: 'test-game-id',
      optionId: 'test-option',
      owner: 'test-user',
      idempotencyKey: 'test-key',
      isGuest: false,
      userInput: 'Take action',
      userInputType: 'action' as const
    };

    const result = await turnsService.runBufferedTurn(turnRequest);

    // Verify AI response metadata is captured
    expect(gamesService.applyTurn).toHaveBeenCalledWith(
      'test-game-id',
      expect.any(Object),
      'test-option',
      expect.objectContaining({
        aiResponseMetadata: expect.objectContaining({
          model: 'gpt-4-turbo',
          tokenCount: 3000,
          promptId: 'prompt-67890-def',
          validationPassed: true
        })
      })
    );

    expect(result.success).toBe(true);
  });

  it('should capture comprehensive data for initial turn (game_start)', async () => {
    const mockGame = {
      id: 'test-game-id',
      turn_count: 0,
      world_slug: 'mystika',
      state_snapshot: {
        currentScene: 'forest_meet',
        character: { name: 'Test Character' },
        adventure: { name: 'Test Adventure' }
      }
    };

    const mockAiResponse = {
      response: JSON.stringify({
        txt: 'Welcome to the mystical realm of Mystika...',
        'optional choices': [
          { choice: 'Look around', outcome: 'You see ancient trees' },
          { choice: 'Continue forward', outcome: 'You walk deeper into the forest' }
        ]
      }),
      promptData: 'Complete initial prompt with adventure start data and all sections',
      promptMetadata: {
        sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
        tokenCount: 2000,
        assembledAt: new Date().toISOString(),
        length: 8000,
        isInitialPrompt: true
      },
      model: 'gpt-4',
      tokenCount: 2500,
      promptId: 'initial-prompt-12345'
    };

    vi.mocked(gamesService.loadGame).mockResolvedValue(mockGame);
    vi.mocked(aiService.generateTurnResponse).mockResolvedValue(mockAiResponse);
    vi.mocked(gamesService.applyTurn).mockResolvedValue({
      id: 'turn-123',
      game_id: 'test-game-id',
      turn_number: 1,
      created_at: new Date().toISOString()
    });

    // Mock other dependencies
    const { WalletService } = await import('../src/services/wallet.service.js');
    const { IdempotencyService } = await import('../src/services/idempotency.service.js');
    
    vi.mocked(WalletService.getWallet).mockResolvedValue({ castingStones: 100 });
    vi.mocked(WalletService.spendCastingStones).mockResolvedValue({ success: true });
    vi.mocked(IdempotencyService.checkIdempotency).mockResolvedValue({
      error: null,
      isDuplicate: false
    });
    vi.mocked(IdempotencyService.storeIdempotencyRecord).mockResolvedValue();

    // Test initial turn request
    const initialTurnRequest = {
      gameId: 'test-game-id',
      optionId: 'game_start',
      owner: 'test-user-id',
      idempotencyKey: 'test-key',
      isGuest: false,
      userInput: 'game_start',
      userInputType: 'action' as const
    };

    const result = await turnsService.runBufferedTurn(initialTurnRequest);

    // Verify comprehensive turn data was captured for initial turn
    expect(gamesService.applyTurn).toHaveBeenCalledWith(
      'test-game-id',
      expect.any(Object), // AI response
      'game_start',
      expect.objectContaining({
        userInput: 'game_start',
        userInputType: 'action',
        promptData: 'Complete initial prompt with adventure start data and all sections',
        promptMetadata: expect.objectContaining({
          sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
          tokenCount: 2000,
          isInitialPrompt: true
        }),
        aiResponseMetadata: expect.objectContaining({
          model: 'gpt-4',
          tokenCount: 2500,
          promptId: 'initial-prompt-12345',
          validationPassed: true
        })
      })
    );

    expect(result.success).toBe(true);
  });
});
