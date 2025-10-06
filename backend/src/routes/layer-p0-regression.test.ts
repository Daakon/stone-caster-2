import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { GamesService } from '../services/games.service.js';
import { TurnsService } from '../services/turns.service.js';
import { WalletService } from '../services/wallet.service.js';
import { StoneLedgerService } from '../services/stoneLedger.service.js';

// Mock services
vi.mock('../services/games.service.js');
vi.mock('../services/turns.service.js');
vi.mock('../services/wallet.service.js');
vi.mock('../services/stone-ledger.service.js');

const mockGamesService = vi.mocked(GamesService);
const mockTurnsService = vi.mocked(TurnsService);
const mockWalletService = vi.mocked(WalletService);
const mockStoneLedgerService = vi.mocked(StoneLedgerService);

describe('Layer P0 Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Guest Authentication Fixes', () => {
    it('should allow guest to fetch game by ID without 401 error', async () => {
      const mockGame = {
        id: 'game-123',
        adventure_id: 'adventure-456',
        character_id: undefined,
        user_id: 'guest-cookie-123',
        state_snapshot: {
          currentScene: 'tavern',
          history: [],
          npcs: [],
          worldState: {},
        },
        turn_index: 0,
        world_id: 'world-789',
        created_at: '2023-01-01T00:00:00Z',
      };

      // Mock the games service to return a game for guest
      const mockGetGameById = vi.fn().mockResolvedValue(mockGame);
      mockGamesService.prototype.getGameById = mockGetGameById;

      const response = await request(app)
        .get('/api/games/game-123')
        .set('Cookie', 'guestId=guest-cookie-123')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'game-123',
          adventure_id: 'adventure-456',
          user_id: 'guest-cookie-123',
        }),
      });

      expect(mockGetGameById).toHaveBeenCalledWith('game-123', 'guest-cookie-123', true);
    });

    it('should handle guest spawn flow end-to-end', async () => {
      const mockSpawnResult = {
        success: true,
        game: {
          id: 'game-123',
          adventure_id: 'adventure-456',
          character_id: undefined,
          user_id: 'guest-cookie-123',
          state_snapshot: {},
          turn_index: 0,
          world_id: 'world-789',
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      const response = await request(app)
        .post('/api/games')
        .set('Cookie', 'guestId=guest-cookie-123')
        .send({
          adventureId: 'adventure-456',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.objectContaining({
          id: 'game-123',
          adventure_id: 'adventure-456',
          user_id: 'guest-cookie-123',
        }),
      });

      expect(mockSpawn).toHaveBeenCalledWith({
        adventureId: 'adventure-456',
        characterId: undefined,
        owner: 'guest-cookie-123',
        isGuest: true,
      });
    });
  });

  describe('Guest Wallet Transaction Fixes', () => {
    it('should handle guest stone spending with proper wallet method', async () => {
      const mockWallet = {
        id: 'wallet-123',
        userId: 'guest-cookie-123',
        castingStones: 10,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockGetWallet = vi.fn().mockResolvedValue(mockWallet);
      mockWalletService.getWallet = mockGetWallet;

      const mockAppendEntry = vi.fn().mockResolvedValue({ success: true });
      mockStoneLedgerService.appendEntry = mockAppendEntry;

      // Mock Supabase update
      const mockUpdate = vi.fn().mockResolvedValue({
        data: { ...mockWallet, castingStones: 8 },
        error: null,
      });

      // We need to mock the supabase admin client
      const { supabaseAdmin } = await import('../services/supabase.js');
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockUpdate,
            }),
          }),
        }),
      } as any);

      const result = await WalletService.spendCastingStones(
        'guest-cookie-123',
        2,
        'test-idempotency-key',
        'game-123',
        'TURN_SPEND',
        true // isGuest = true
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(8);
      expect(mockGetWallet).toHaveBeenCalledWith('guest-cookie-123', true);
      expect(mockAppendEntry).toHaveBeenCalledWith({
        walletId: 'wallet-123',
        userId: 'guest-cookie-123',
        transactionType: 'spend',
        deltaCastingStones: -2,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'TURN_SPEND',
        metadata: {},
      });
    });

    it('should handle insufficient stones error for guest', async () => {
      const mockWallet = {
        id: 'wallet-123',
        userId: 'guest-cookie-123',
        castingStones: 1, // Insufficient stones
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockGetWallet = vi.fn().mockResolvedValue(mockWallet);
      mockWalletService.getWallet = mockGetWallet;

      const result = await WalletService.spendCastingStones(
        'guest-cookie-123',
        5, // Trying to spend more than available
        'test-idempotency-key',
        'game-123',
        'TURN_SPEND',
        true // isGuest = true
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_INVENTORY');
      expect(result.message).toContain('Insufficient casting stones');
    });
  });

  describe('Guest Turn Flow Integration', () => {
    it('should complete guest spawn->turn loop successfully', async () => {
      // Mock game spawn
      const mockSpawnResult = {
        success: true,
        game: {
          id: 'game-123',
          adventure_id: 'adventure-456',
          character_id: undefined,
          user_id: 'guest-cookie-123',
          state_snapshot: {
            currentScene: 'tavern',
            history: [],
            npcs: [],
            worldState: {},
          },
          turn_index: 0,
          world_id: 'world-789',
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      const mockSpawn = vi.fn().mockResolvedValue(mockSpawnResult);
      mockGamesService.prototype.spawn = mockSpawn;

      // Mock turn processing
      const mockTurnResult = {
        success: true,
        turnDTO: {
          id: 'turn-123',
          game_id: 'game-123',
          option_id: 'option-456',
          ai_response: {
            narrative: 'You approach the bartender and ask for information.',
            emotion: 'neutral',
            suggestedActions: ['Ask about rumors', 'Order a drink'],
          },
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      const mockRunBufferedTurn = vi.fn().mockResolvedValue(mockTurnResult);
      mockTurnsService.prototype.runBufferedTurn = mockRunBufferedTurn;

      // Mock wallet operations
      const mockWallet = {
        id: 'wallet-123',
        userId: 'guest-cookie-123',
        castingStones: 10,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockGetWallet = vi.fn().mockResolvedValue(mockWallet);
      mockWalletService.getWallet = mockGetWallet;

      const mockSpendResult = { success: true, newBalance: 8 };
      const mockSpendCastingStones = vi.fn().mockResolvedValue(mockSpendResult);
      mockWalletService.spendCastingStones = mockSpendCastingStones;

      // Test spawn
      const spawnResponse = await request(app)
        .post('/api/games')
        .set('Cookie', 'guestId=guest-cookie-123')
        .send({
          adventureId: 'adventure-456',
        })
        .expect(201);

      expect(spawnResponse.body.ok).toBe(true);
      expect(spawnResponse.body.data.id).toBe('game-123');

      // Test turn
      const turnResponse = await request(app)
        .post('/api/games/game-123/turn')
        .set('Cookie', 'guestId=guest-cookie-123')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          optionId: 'option-456',
        })
        .expect(200);

      expect(turnResponse.body.ok).toBe(true);
      expect(turnResponse.body.data.id).toBe('turn-123');

      // Verify services were called with correct guest parameters
      expect(mockSpawn).toHaveBeenCalledWith({
        adventureId: 'adventure-456',
        characterId: undefined,
        owner: 'guest-cookie-123',
        isGuest: true,
      });

      expect(mockRunBufferedTurn).toHaveBeenCalledWith({
        gameId: 'game-123',
        optionId: 'option-456',
        owner: 'guest-cookie-123',
        idempotencyKey: 'test-key-123',
        isGuest: true,
      });

      expect(mockSpendCastingStones).toHaveBeenCalledWith(
        'guest-cookie-123',
        expect.any(Number), // turn cost
        'test-key-123',
        'game-123',
        'TURN_SPEND',
        true // isGuest = true
      );
    });

    it('should handle insufficient stones in turn flow', async () => {
      // Mock insufficient stones scenario
      const mockWallet = {
        id: 'wallet-123',
        userId: 'guest-cookie-123',
        castingStones: 0, // No stones
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const mockGetWallet = vi.fn().mockResolvedValue(mockWallet);
      mockWalletService.getWallet = mockGetWallet;

      const mockTurnResult = {
        success: false,
        error: 'INSUFFICIENT_STONES',
        message: 'Insufficient casting stones. Have 0, need 2',
      };

      const mockRunBufferedTurn = vi.fn().mockResolvedValue(mockTurnResult);
      mockTurnsService.prototype.runBufferedTurn = mockRunBufferedTurn;

      const turnResponse = await request(app)
        .post('/api/games/game-123/turn')
        .set('Cookie', 'guestId=guest-cookie-123')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          optionId: 'option-456',
        })
        .expect(400);

      expect(turnResponse.body.ok).toBe(false);
      expect(turnResponse.body.error).toBe('INSUFFICIENT_STONES');
      expect(turnResponse.body.message).toContain('Insufficient casting stones');
    });
  });
});
