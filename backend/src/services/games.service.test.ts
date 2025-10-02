import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gamesService } from './games.service.js';
import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from 'shared';

// Mock Supabase
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('GamesService', () => {
  const mockFrom = vi.mocked(supabaseAdmin.from);
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSingle = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
    } as any);
    
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
    } as any);
    
    mockInsert.mockReturnValue({
      select: mockSelect,
    } as any);
    
    mockUpdate.mockReturnValue({
      eq: mockEq,
      select: mockSelect,
    } as any);
    
    mockEq.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
      single: mockSingle,
    } as any);
    
    mockOrder.mockReturnValue({
      limit: mockLimit,
      single: mockSingle,
    } as any);
    
    mockLimit.mockReturnValue({
      single: mockSingle,
    } as any);
  });

  describe('spawn', () => {
    it('should successfully spawn a game for a character not currently active', async () => {
      const adventureId = 'adventure-123';
      const characterId = 'character-456';
      const owner = 'user-789';

      const mockAdventure = {
        id: adventureId,
        world_id: 'world-123',
        title: 'Test Adventure',
      };

      const mockCharacter = {
        id: characterId,
        user_id: owner,
        world_id: 'world-123',
        active_game_id: null, // Not currently active
        name: 'Test Character',
      };

      const mockNewGame = {
        id: 'game-123',
        adventure_id: adventureId,
        character_id: characterId,
        user_id: owner,
        state_snapshot: {},
        turn_index: 0,
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock adventure lookup
      mockSingle.mockResolvedValueOnce({
        data: mockAdventure,
        error: null,
      });

      // Mock character lookup
      mockSingle.mockResolvedValueOnce({
        data: mockCharacter,
        error: null,
      });

      // Mock game creation
      mockSelect.mockResolvedValueOnce({
        data: mockNewGame,
        error: null,
      });

      // Mock character update to set active_game_id
      mockSelect.mockResolvedValueOnce({
        data: { ...mockCharacter, active_game_id: 'game-123' },
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId,
        owner,
      });

      expect(result).toEqual({
        success: true,
        game: mockNewGame,
      });

      // Verify character was updated with active_game_id
      expect(mockUpdate).toHaveBeenCalledWith({
        active_game_id: 'game-123',
        updated_at: expect.any(String),
      });
    });

    it('should fail with CONFLICT when character is already active in another game', async () => {
      const adventureId = 'adventure-123';
      const characterId = 'character-456';
      const owner = 'user-789';

      const mockAdventure = {
        id: adventureId,
        world_id: 'world-123',
        title: 'Test Adventure',
      };

      const mockCharacter = {
        id: characterId,
        user_id: owner,
        world_id: 'world-123',
        active_game_id: 'existing-game-789', // Already active!
        name: 'Test Character',
      };

      // Mock adventure lookup
      mockSingle.mockResolvedValueOnce({
        data: mockAdventure,
        error: null,
      });

      // Mock character lookup
      mockSingle.mockResolvedValueOnce({
        data: mockCharacter,
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId,
        owner,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.CONFLICT,
        message: 'Character is already active in another game',
      });

      // Verify no game was created
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should fail when character and adventure are from different worlds', async () => {
      const adventureId = 'adventure-123';
      const characterId = 'character-456';
      const owner = 'user-789';

      const mockAdventure = {
        id: adventureId,
        world_id: 'world-123',
        title: 'Test Adventure',
      };

      const mockCharacter = {
        id: characterId,
        user_id: owner,
        world_id: 'different-world-456', // Different world!
        active_game_id: null,
        name: 'Test Character',
      };

      // Mock adventure lookup
      mockSingle.mockResolvedValueOnce({
        data: mockAdventure,
        error: null,
      });

      // Mock character lookup
      mockSingle.mockResolvedValueOnce({
        data: mockCharacter,
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId,
        owner,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.CONFLICT,
        message: 'Character and adventure must be from the same world',
      });

      // Verify no game was created
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should handle guest spawn without character', async () => {
      const adventureId = 'adventure-123';
      const owner = 'guest-cookie-123';

      const mockAdventure = {
        id: adventureId,
        world_id: 'world-123',
        title: 'Test Adventure',
      };

      const mockNewGame = {
        id: 'game-123',
        adventure_id: adventureId,
        character_id: null,
        user_id: owner,
        state_snapshot: {},
        turn_index: 0,
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock adventure lookup
      mockSingle.mockResolvedValueOnce({
        data: mockAdventure,
        error: null,
      });

      // Mock game creation
      mockSelect.mockResolvedValueOnce({
        data: mockNewGame,
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId: undefined,
        owner,
      });

      expect(result).toEqual({
        success: true,
        game: mockNewGame,
      });

      // Verify no character update was attempted
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should handle adventure not found', async () => {
      const adventureId = 'nonexistent-adventure';
      const characterId = 'character-456';
      const owner = 'user-789';

      // Mock adventure not found
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId,
        owner,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Adventure not found',
      });
    });

    it('should handle character not found', async () => {
      const adventureId = 'adventure-123';
      const characterId = 'nonexistent-character';
      const owner = 'user-789';

      const mockAdventure = {
        id: adventureId,
        world_id: 'world-123',
        title: 'Test Adventure',
      };

      // Mock adventure lookup
      mockSingle.mockResolvedValueOnce({
        data: mockAdventure,
        error: null,
      });

      // Mock character not found
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await gamesService.spawn({
        adventureId,
        characterId,
        owner,
      });

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.NOT_FOUND,
        message: 'Character not found',
      });
    });
  });

  describe('loadGame', () => {
    it('should load game with all required fields', async () => {
      const gameId = 'game-123';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'character-456',
        user_id: 'user-789',
        state_snapshot: { currentScene: 'tavern' },
        turn_index: 5,
        world_id: 'world-123',
        created_at: '2023-01-01T00:00:00Z',
      };

      mockSingle.mockResolvedValueOnce({
        data: mockGame,
        error: null,
      });

      const result = await gamesService.loadGame(gameId);

      expect(result).toEqual(mockGame);
    });

    it('should return null for non-existent game', async () => {
      const gameId = 'nonexistent-game';

      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await gamesService.loadGame(gameId);

      expect(result).toBeNull();
    });
  });

  describe('applyTurn', () => {
    it('should apply turn and update game state', async () => {
      const gameId = 'game-123';
      const turnResult = {
        narrative: 'You approach the bartender.',
        emotion: 'neutral' as const,
        suggestedActions: ['Ask about rumors', 'Order a drink'],
        worldStateChanges: { tavern_visited: true },
      };

      const mockUpdatedGame = {
        id: gameId,
        state_snapshot: { currentScene: 'tavern', tavern_visited: true },
        turn_index: 6,
        server_summary: 'Player approached bartender',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockTurnRecord = {
        id: 'turn-123',
        game_id: gameId,
        ai_response: turnResult,
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock turn record creation
      mockSelect.mockResolvedValueOnce({
        data: mockTurnRecord,
        error: null,
      });

      // Mock game update
      mockSelect.mockResolvedValueOnce({
        data: mockUpdatedGame,
        error: null,
      });

      const result = await gamesService.applyTurn(gameId, turnResult);

      expect(result).toEqual(mockTurnRecord);

      // Verify game was updated with new state
      expect(mockUpdate).toHaveBeenCalledWith({
        state_snapshot: expect.objectContaining({
          tavern_visited: true,
        }),
        turn_index: 6,
        server_summary: 'Player approached bartender',
        updated_at: expect.any(String),
      });
    });
  });
});
