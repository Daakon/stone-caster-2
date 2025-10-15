import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GamesService } from '../src/services/games.service.js';
import { supabaseAdmin } from '../src/services/supabase.js';

// Mock Supabase
vi.mock('../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}));

describe('Turn Recording Service', () => {
  let gamesService: GamesService;
  let mockSupabase: any;

  beforeEach(() => {
    gamesService = new GamesService();
    mockSupabase = vi.mocked(supabaseAdmin);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSessionTurns', () => {
    it('should fetch session turns successfully', async () => {
      const gameId = 'test-game-id';
      const mockTurns = [
        {
          id: 'turn-1',
          session_id: gameId,
          sequence: 1,
          user_prompt: 'Start the game',
          narrative_summary: 'You find yourself in a mysterious forest...',
          is_initialization: true,
          created_at: '2024-01-01T00:00:00Z',
          turn_number: 1
        },
        {
          id: 'turn-2',
          session_id: gameId,
          sequence: 2,
          user_prompt: 'Look around',
          narrative_summary: 'You see ancient trees and hear distant sounds...',
          is_initialization: false,
          created_at: '2024-01-01T00:01:00Z',
          turn_number: 2
        }
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockTurns, error: null })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await gamesService.getSessionTurns(gameId);

      expect(mockSupabase.from).toHaveBeenCalledWith('turns');
      expect(mockQuery.select).toHaveBeenCalledWith(`
          id,
          session_id,
          sequence,
          user_prompt,
          narrative_summary,
          is_initialization,
          created_at,
          turn_number
        `);
      expect(mockQuery.eq).toHaveBeenCalledWith('session_id', gameId);
      expect(mockQuery.order).toHaveBeenCalledWith('sequence', { ascending: true });
      expect(result).toEqual(mockTurns);
    });

    it('should handle database errors gracefully', async () => {
      const gameId = 'test-game-id';
      const mockError = new Error('Database connection failed');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(gamesService.getSessionTurns(gameId)).rejects.toThrow('Failed to fetch session turns: Database connection failed');
    });

    it('should return empty array when no turns exist', async () => {
      const gameId = 'test-game-id';

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await gamesService.getSessionTurns(gameId);

      expect(result).toEqual([]);
    });
  });

  describe('getInitializeNarrative', () => {
    it('should fetch initialize narrative successfully', async () => {
      const gameId = 'test-game-id';
      const mockNarrative = 'You find yourself in a mysterious forest...';

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { narrative_summary: mockNarrative }, 
          error: null 
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await gamesService.getInitializeNarrative(gameId);

      expect(mockSupabase.from).toHaveBeenCalledWith('turns');
      expect(mockQuery.select).toHaveBeenCalledWith('narrative_summary');
      expect(mockQuery.eq).toHaveBeenCalledWith('session_id', gameId);
      expect(mockQuery.eq).toHaveBeenCalledWith('is_initialization', true);
      expect(result).toBe(mockNarrative);
    });

    it('should return null when no initialize narrative exists', async () => {
      const gameId = 'test-game-id';

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'No rows found' }
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await gamesService.getInitializeNarrative(gameId);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const gameId = 'test-game-id';
      const mockError = new Error('Database connection failed');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: mockError
        })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      const result = await gamesService.getInitializeNarrative(gameId);

      expect(result).toBeNull();
    });
  });

  describe('applyTurn with enhanced recording', () => {
    it('should create turn with enhanced recording fields', async () => {
      const gameId = 'test-game-id';
      const turnResult = {
        narrative: 'You take a step forward...',
        emotion: 'neutral',
        choices: [
          { id: 'choice-1', label: 'Continue forward' },
          { id: 'choice-2', label: 'Look around' }
        ]
      };
      const optionId = 'test-option-id';
      const turnData = {
        userInput: 'Take a step forward',
        userInputType: 'action' as const,
        promptData: { sections: ['system', 'world', 'character'] },
        promptMetadata: { tokenCount: 150 },
        aiResponseMetadata: {
          model: 'gpt-4',
          tokenCount: 200,
          promptId: 'prompt-123'
        },
        processingTimeMs: 1500
      };

      // Mock game loading
      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'character-123',
        user_id: 'user-123',
        cookie_group_id: undefined,
        world_slug: 'mystika',
        state_snapshot: {},
        turn_count: 0,
        status: 'active' as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_played_at: '2024-01-01T00:00:00Z'
      };

      const mockLoadGame = vi.spyOn(gamesService, 'loadGame').mockResolvedValue(mockGame);

      // Mock existing turn check
      const mockExistingTurnQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      };

      // Mock turn creation
      const mockTurnRecord = {
        id: 'new-turn-id',
        game_id: gameId,
        session_id: gameId,
        sequence: 1,
        user_prompt: turnData.userInput,
        narrative_summary: turnResult.narrative,
        is_initialization: true,
        created_at: new Date().toISOString()
      };

      const mockInsertQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockTurnRecord, error: null })
      };

      const mockUpdateQuery = {
        eq: vi.fn().mockResolvedValue({ error: null })
      };

      mockSupabase.from
        .mockReturnValueOnce(mockExistingTurnQuery) // existing turn check
        .mockReturnValueOnce(mockInsertQuery) // turn insert
        .mockReturnValueOnce(mockUpdateQuery); // game update

      const result = await gamesService.applyTurn(gameId, turnResult, optionId, turnData);

      expect(mockLoadGame).toHaveBeenCalledWith(gameId);
      expect(mockSupabase.from).toHaveBeenCalledWith('turns');
      expect(result).toEqual(mockTurnRecord);
    });

    it('should handle turn creation errors', async () => {
      const gameId = 'test-game-id';
      const turnResult = { narrative: 'Test narrative' };
      const optionId = 'test-option-id';

      const mockGame = {
        id: gameId,
        adventure_id: 'adventure-123',
        character_id: 'character-123',
        user_id: 'user-123',
        cookie_group_id: undefined,
        world_slug: 'mystika',
        state_snapshot: {},
        turn_count: 0,
        status: 'active' as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_played_at: '2024-01-01T00:00:00Z'
      };

      vi.spyOn(gamesService, 'loadGame').mockResolvedValue(mockGame);

      const mockError = new Error('Database insert failed');
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      };

      mockSupabase.from.mockReturnValue(mockQuery);

      await expect(gamesService.applyTurn(gameId, turnResult, optionId)).rejects.toThrow('Failed to create turn record: Database insert failed');
    });
  });
});
