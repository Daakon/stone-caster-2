import { describe, it, expect, beforeEach, vi } from 'vitest';
import { walletService } from './wallet.service.js';
import { ApiErrorCode } from 'shared';

// Create a comprehensive mock for Supabase
const mockSupabaseClient = {
  from: vi.fn(),
};

// Mock the entire supabase module
vi.mock('./supabase.js', () => ({
  supabaseAdmin: mockSupabaseClient,
}));

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spendCasting', () => {
    it('should succeed when balance >= cost and write ledger entry', async () => {
      const owner = 'user-123';
      const amount = 10;
      const idempotencyKey = 'key-123';
      const gameId = 'game-123';
      const turnId = 'turn-123';

      // Mock the Supabase chain for idempotency check
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null, // No existing entry
          error: { code: 'PGRST116' }, // Not found
        }),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      // Mock wallet balance check
      const mockWalletChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { balance: 50 },
          error: null,
        }),
      };

      // Mock ledger insert
      const mockLedgerChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'ledger-123' },
          error: null,
        }),
      };

      // Setup the from() mock to return different chains based on table
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockChain;
        } else if (table === 'stone_wallets') {
          return mockWalletChain;
        }
        return mockChain;
      });

      const result = await walletService.spendCasting(owner, amount, idempotencyKey, gameId, turnId);

      expect(result).toEqual({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      // Verify ledger entry was created
      expect(mockChain.insert).toHaveBeenCalledWith({
        owner,
        delta: -amount,
        reason: 'TURN_SPEND',
        game_id: gameId,
        turn_id: turnId,
        idempotency_key: idempotencyKey,
        new_balance: 40,
        created_at: expect.any(String),
      });
    });

    it('should fail with INSUFFICIENT_STONES when balance < cost', async () => {
      const owner = 'user-123';
      const amount = 100;
      const idempotencyKey = 'key-123';

      // Mock insufficient balance
      mockSingle.mockResolvedValueOnce({
        data: { balance: 50 },
        error: null,
      });

      const result = await walletService.spendCasting(owner, amount, idempotencyKey);

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.INSUFFICIENT_STONES,
        message: 'Insufficient casting stones',
      });

      // Verify no ledger entry was created
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should handle idempotency - second call with same key returns first result', async () => {
      const owner = 'user-123';
      const amount = 10;
      const idempotencyKey = 'key-123';
      const gameId = 'game-123';
      const turnId = 'turn-123';

      // First call - mock current balance
      mockSingle.mockResolvedValueOnce({
        data: { balance: 50 },
        error: null,
      });

      // Mock existing ledger entry
      mockSelect.mockResolvedValueOnce({
        data: { id: 'ledger-123', delta: -amount, new_balance: 40 },
        error: null,
      });

      const result1 = await walletService.spendCasting(owner, amount, idempotencyKey, gameId, turnId);

      // Second call with same key - should return existing result
      mockSelect.mockResolvedValueOnce({
        data: { id: 'ledger-123', delta: -amount, new_balance: 40 },
        error: null,
      });

      const result2 = await walletService.spendCasting(owner, amount, idempotencyKey, gameId, turnId);

      expect(result1).toEqual({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      expect(result2).toEqual({
        success: true,
        newBalance: 40,
        ledgerEntryId: 'ledger-123',
      });

      // Verify only one ledger entry was created
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      const owner = 'user-123';
      const amount = 10;
      const idempotencyKey = 'key-123';

      // Mock database error
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await walletService.spendCasting(owner, amount, idempotencyKey);

      expect(result).toEqual({
        success: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Failed to process stone spend',
      });
    });
  });

  describe('getBalance', () => {
    it('should return current balance for user', async () => {
      const owner = 'user-123';

      mockSingle.mockResolvedValueOnce({
        data: { balance: 75 },
        error: null,
      });

      const balance = await walletService.getBalance(owner);

      expect(balance).toBe(75);
    });

    it('should return 0 for new user', async () => {
      const owner = 'new-user-123';

      mockSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const balance = await walletService.getBalance(owner);

      expect(balance).toBe(0);
    });
  });
});
