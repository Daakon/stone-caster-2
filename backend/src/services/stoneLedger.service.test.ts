import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoneLedgerService } from './stoneLedger.service.js';

// Mock Supabase
const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('./supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('StoneLedgerService', () => {
  const mockUserId = 'user-123';
  const mockWalletId = 'wallet-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('appendEntry', () => {
    it('should successfully append a ledger entry', async () => {
      const mockLedgerEntry = {
        id: 'ledger-123',
        wallet_id: mockWalletId,
        user_id: mockUserId,
        transaction_type: 'convert',
        delta_casting_stones: 200,
        delta_inventory_shard: -20,
        delta_inventory_crystal: 0,
        delta_inventory_relic: 0,
        reason: 'Converted 20 shard to 200 casting stones',
        pack_id: null,
        metadata: {
          conversionType: 'shard',
          conversionAmount: 20,
          conversionRate: 10,
        },
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockInsert = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockLedgerEntry, error: null }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockInsert;
        }
        return {} as any;
      });

      const input = {
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert' as const,
        deltaCastingStones: 200,
        deltaInventoryShard: -20,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Converted 20 shard to 200 casting stones',
        metadata: {
          conversionType: 'shard',
          conversionAmount: 20,
          conversionRate: 10,
        },
      };

      const result = await StoneLedgerService.appendEntry(input);

      expect(result).toEqual({
        id: 'ledger-123',
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert',
        deltaCastingStones: 200,
        deltaInventoryShard: -20,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Converted 20 shard to 200 casting stones',
        packId: null,
        metadata: {
          conversionType: 'shard',
          conversionAmount: 20,
          conversionRate: 10,
        },
        createdAt: '2023-01-01T00:00:00Z',
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockInsert;
        }
        return {} as any;
      });

      const input = {
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert' as const,
        deltaCastingStones: 200,
        deltaInventoryShard: -20,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Converted 20 shard to 200 casting stones',
      };

      await expect(StoneLedgerService.appendEntry(input)).rejects.toThrow(
        'Failed to append ledger entry: Database error'
      );
    });
  });

  describe('getEntries', () => {
    it('should fetch ledger entries with all filters', async () => {
      const mockEntries = [
        {
          id: 'ledger-1',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'convert',
          delta_casting_stones: 200,
          delta_inventory_shard: -20,
          delta_inventory_crystal: 0,
          delta_inventory_relic: 0,
          reason: 'Converted 20 shard to 200 casting stones',
          pack_id: null,
          metadata: {},
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'ledger-2',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'purchase',
          delta_casting_stones: 0,
          delta_inventory_shard: 100,
          delta_inventory_crystal: 50,
          delta_inventory_relic: 10,
          reason: 'Purchased Starter Pack',
          pack_id: 'pack-123',
          metadata: {},
          created_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        range: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const options = {
        userId: mockUserId,
        walletId: mockWalletId,
        transactionType: 'convert',
        limit: 10,
        offset: 0,
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z',
      };

      const result = await StoneLedgerService.getEntries(options);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'ledger-1',
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert',
        deltaCastingStones: 200,
        deltaInventoryShard: -20,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Converted 20 shard to 200 casting stones',
        packId: null,
        metadata: {},
        createdAt: '2023-01-01T00:00:00Z',
      });
    });

    it('should handle empty results', async () => {
      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.getEntries({});

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Database error' } 
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      await expect(StoneLedgerService.getEntries({})).rejects.toThrow(
        'Failed to fetch ledger entries: Database error'
      );
    });
  });

  describe('getWalletEntries', () => {
    it('should fetch entries for a specific wallet', async () => {
      const mockEntries = [
        {
          id: 'ledger-1',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'convert',
          delta_casting_stones: 200,
          delta_inventory_shard: -20,
          delta_inventory_crystal: 0,
          delta_inventory_relic: 0,
          reason: 'Converted 20 shard to 200 casting stones',
          pack_id: null,
          metadata: {},
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.getWalletEntries(mockWalletId, 50, 0);

      expect(result).toHaveLength(1);
      expect(result[0].walletId).toBe(mockWalletId);
    });
  });

  describe('getUserEntries', () => {
    it('should fetch entries for a specific user', async () => {
      const mockEntries = [
        {
          id: 'ledger-1',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'convert',
          delta_casting_stones: 200,
          delta_inventory_shard: -20,
          delta_inventory_crystal: 0,
          delta_inventory_relic: 0,
          reason: 'Converted 20 shard to 200 casting stones',
          pack_id: null,
          metadata: {},
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.getUserEntries(mockUserId, 50, 0);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(mockUserId);
    });
  });

  describe('getConversionEntries', () => {
    it('should fetch conversion entries for a user', async () => {
      const mockEntries = [
        {
          id: 'ledger-1',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'convert',
          delta_casting_stones: 200,
          delta_inventory_shard: -20,
          delta_inventory_crystal: 0,
          delta_inventory_relic: 0,
          reason: 'Converted 20 shard to 200 casting stones',
          pack_id: null,
          metadata: {},
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.getConversionEntries(mockUserId, 20);

      expect(result).toHaveLength(1);
      expect(result[0].transactionType).toBe('convert');
    });
  });

  describe('getPurchaseEntries', () => {
    it('should fetch purchase entries for a user', async () => {
      const mockEntries = [
        {
          id: 'ledger-2',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'purchase',
          delta_casting_stones: 0,
          delta_inventory_shard: 100,
          delta_inventory_crystal: 50,
          delta_inventory_relic: 10,
          reason: 'Purchased Starter Pack',
          pack_id: 'pack-123',
          metadata: {},
          created_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.getPurchaseEntries(mockUserId, 20);

      expect(result).toHaveLength(1);
      expect(result[0].transactionType).toBe('purchase');
    });
  });

  describe('calculateBalanceChanges', () => {
    it('should calculate total balance changes from ledger entries', async () => {
      const mockEntries = [
        {
          id: 'ledger-1',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'convert',
          delta_casting_stones: 200,
          delta_inventory_shard: -20,
          delta_inventory_crystal: 0,
          delta_inventory_relic: 0,
          reason: 'Converted 20 shard to 200 casting stones',
          pack_id: null,
          metadata: {},
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'ledger-2',
          wallet_id: mockWalletId,
          user_id: mockUserId,
          transaction_type: 'purchase',
          delta_casting_stones: 0,
          delta_inventory_shard: 100,
          delta_inventory_crystal: 50,
          delta_inventory_relic: 10,
          reason: 'Purchased Starter Pack',
          pack_id: 'pack-123',
          metadata: {},
          created_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: mockEntries, error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.calculateBalanceChanges(
        mockWalletId,
        '2023-01-01T00:00:00Z',
        '2023-01-31T23:59:59Z'
      );

      expect(result).toEqual({
        totalCastingStones: 200, // 200 + 0
        totalInventoryShard: 80, // -20 + 100
        totalInventoryCrystal: 50, // 0 + 50
        totalInventoryRelic: 10, // 0 + 10
      });
    });

    it('should handle empty entries', async () => {
      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_ledger') {
          return mockQuery;
        }
        return {} as any;
      });

      const result = await StoneLedgerService.calculateBalanceChanges(mockWalletId);

      expect(result).toEqual({
        totalCastingStones: 0,
        totalInventoryShard: 0,
        totalInventoryCrystal: 0,
        totalInventoryRelic: 0,
      });
    });
  });
});
