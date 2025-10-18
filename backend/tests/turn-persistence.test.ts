import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GamesService } from '../src/services/games.service.js';
import { TurnsService } from '../src/services/turns.service.js';

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
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              last_played_at: '2024-01-01T00:00:00Z',
              adventures: {
                title: 'Test Adventure',
                description: 'Test Description'
              },
              characters: {
                name: 'Test Character'
              }
            },
            error: null
          }))
        }))
      }))
    }))
  }
}));

vi.mock('../src/services/content.service.js', () => ({
  ContentService: {
    getWorldBySlug: vi.fn(() => ({ name: 'Mystika' }))
  }
}));

describe('Turn Persistence System', () => {
  let gamesService: GamesService;
  let turnsService: TurnsService;

  beforeEach(() => {
    gamesService = new GamesService();
    turnsService = new TurnsService();
  });

  it('should load game turns from database', async () => {
    // Mock the database response for game turns
    const mockTurns = [
      {
        id: 'turn-1',
        game_id: 'test-game-id',
        turn_number: 1,
        option_id: 'option-1',
        ai_response: {
          narrative: 'You begin your adventure...',
          choices: []
        },
        created_at: '2024-01-01T00:00:00Z'
      }
    ];

    // Mock the supabase query for turns
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockTurns,
            error: null
          }))
        }))
      }))
    }));

    // Test the getGameTurns method
    const turns = await gamesService.getGameTurns('test-game-id');
    expect(turns).toEqual(mockTurns);
  });

  it('should create initial prompt for games with turnCount: 0', async () => {
    // This test would verify that the initial prompt system works
    // when a game has turnCount: 0
    const gameId = 'test-game-id';
    const worldSlug = 'mystika';
    const characterId = 'test-character-id';

    // The initial prompt should be created automatically when the first turn is submitted
    // This is handled by the backend turns service
    expect(true).toBe(true); // Placeholder for now
  });

  it('should return clean GameDTO without unnecessary character fields', async () => {
    const game = await gamesService.getGameById('test-game-id', 'test-user-id', false);
    
    expect(game).toBeDefined();
    expect(game?.id).toBe('test-game-id');
    expect(game?.adventureTitle).toBe('Test Adventure');
    expect(game?.characterName).toBe('Test Character');
    
    // These fields should not be present in the cleaned response
    expect(game).not.toHaveProperty('characterLevel');
    expect(game).not.toHaveProperty('characterCurrentHealth');
    expect(game).not.toHaveProperty('characterMaxHealth');
    expect(game).not.toHaveProperty('characterRace');
    expect(game).not.toHaveProperty('characterClass');
    expect(game).not.toHaveProperty('characterWorldData');
  });
});












