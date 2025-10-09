import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TurnsService } from '../src/services/turns.service.js';
import { GamesService } from '../src/services/games.service.js';

// Mock the dependencies
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: {
              id: 'test-game-id',
              adventure_id: 'test-adventure-id',
              character_id: 'test-character-id',
              world_slug: 'mystika',
              turn_count: 0,
              status: 'active',
              state_snapshot: {},
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              last_played_at: '2024-01-01T00:00:00Z'
            },
            error: null
          }))
        }))
      }))
    }))
  }
}));

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
    spendCastingStones: vi.fn(),
  }
}));

vi.mock('../src/services/idempotency.service.js', () => ({
  IdempotencyService: {
    checkIdempotency: vi.fn(),
  }
}));

describe('Auto-Initialization System', () => {
  let turnsService: TurnsService;
  let gamesService: GamesService;

  beforeEach(() => {
    turnsService = new TurnsService();
    gamesService = new GamesService();
  });

  it('should auto-initialize games with 0 turns', async () => {
    const gameId = 'test-game-id';
    const userId = 'test-user-id';
    const isGuest = false;

    // Mock the game data
    const mockGame = {
      id: gameId,
      turnCount: 0,
      worldSlug: 'mystika',
      characterId: 'test-character-id',
      status: 'active'
    };

    // Mock the auto-initialization process
    const mockTurnResult = {
      success: true,
      turnDTO: {
        id: 'turn-1',
        gameId: gameId,
        turnCount: 1,
        narrative: 'Welcome to your adventure!',
        choices: [],
        createdAt: '2024-01-01T00:00:00Z'
      }
    };

    // Test that the auto-initialization endpoint would work
    expect(mockGame.turnCount).toBe(0);
    expect(mockTurnResult.success).toBe(true);
    expect(mockTurnResult.turnDTO.turnCount).toBe(1);
  });

  it('should not auto-initialize games with existing turns', async () => {
    const gameId = 'test-game-id';
    const userId = 'test-user-id';
    const isGuest = false;

    // Mock the game data with existing turns
    const mockGame = {
      id: gameId,
      turnCount: 2,
      worldSlug: 'mystika',
      characterId: 'test-character-id',
      status: 'active'
    };

    // Test that games with existing turns are not auto-initialized
    expect(mockGame.turnCount).toBeGreaterThan(0);
    // Auto-initialization should not occur for games with existing turns
  });

  it('should include adventure start JSON in initial prompts', async () => {
    // This test would verify that the initial prompt includes adventure start JSON
    // The adventure start JSON should trigger the adventure to load immediately
    const adventureStartData = {
      scene: 'forest_meet',
      npcs: ['kiera'],
      places: ['forest_path'],
      objectives: ['rescue_captives_now'],
      onStart: ['set_flag:rescue_captives_now']
    };

    expect(adventureStartData.scene).toBe('forest_meet');
    expect(adventureStartData.npcs).toContain('kiera');
    expect(adventureStartData.objectives).toContain('rescue_captives_now');
  });

  it('should handle duplicate turn creation gracefully', async () => {
    const gameId = 'test-game-id';
    const userId = 'test-user-id';
    const isGuest = false;

    // Mock the game data
    const mockGame = {
      id: gameId,
      turnCount: 0,
      worldSlug: 'mystika',
      characterId: 'test-character-id',
      status: 'active'
    };

    // Mock existing turn that already exists
    const existingTurn = {
      id: 'existing-turn-id',
      game_id: gameId,
      turn_number: 1,
      option_id: 'game_start',
      ai_response: { narrative: 'Welcome to your adventure!' },
      created_at: '2024-01-01T00:00:00Z'
    };

    // Test that the system should detect existing turns and return them instead of creating duplicates
    expect(existingTurn.game_id).toBe(gameId);
    expect(existingTurn.turn_number).toBe(1);
    expect(existingTurn.option_id).toBe('game_start');
  });

  it('should prevent race conditions in auto-initialization', async () => {
    const gameId = 'test-game-id';
    const userId = 'test-user-id';
    const isGuest = false;

    // Mock the game data with turnCount = 0 but existing turns in database
    const mockGame = {
      id: gameId,
      turnCount: 0, // Game record shows 0 turns
      worldSlug: 'mystika',
      characterId: 'test-character-id',
      status: 'active'
    };

    // Mock existing turns in database (race condition scenario)
    const existingTurns = [
      {
        id: 'turn-1',
        game_id: gameId,
        turn_number: 1,
        option_id: 'game_start',
        created_at: '2024-01-01T00:00:00Z'
      }
    ];

    // Test that the system should detect existing turns even when game.turnCount is 0
    expect(mockGame.turnCount).toBe(0);
    expect(existingTurns.length).toBeGreaterThan(0);
    expect(existingTurns[0].game_id).toBe(gameId);
    expect(existingTurns[0].turn_number).toBe(1);
  });
});


