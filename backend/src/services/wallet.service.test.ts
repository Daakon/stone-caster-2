import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletService } from './wallet.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import { configService } from './config.service.js';
import { supabaseAdmin } from './supabase.js';

// Mock dependencies
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('./config.service.js', () => ({
  configService: {
    getConfig: vi.fn(),
  },
}));

vi.mock('./stoneLedger.service.js', () => ({
  StoneLedgerService: {
    appendEntry: vi.fn(),
  },
}));

describe('WalletService', () => {
  const mockUserId = 'user-123';
  const mockWalletId = 'wallet-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('convertStones', () => {
    it('should successfully convert shards to casting stones', async () => {
      // Mock config service
      vi.mocked(configService.getConfig).mockResolvedValue({
        value: { shard: 10, crystal: 100, relic: 500 }
      });

      // Mock wallet data
      const mockWallet = {
        id: mockWalletId,
        user_id: mockUserId,
        casting_stones: 50,
        inventory_shard: 20,
        inventory_crystal: 5,
        inventory_relic: 2,
        daily_regen: 0,
        last_regen_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockUpdatedWallet = {
        ...mockWallet,
        casting_stones: 250, // 50 + (20 * 10)
        inventory_shard: 0, // 20 - 20
      };

      // Mock Supabase calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockWallet, error: null }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedWallet, error: null }),
          }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return {
            select: mockSelect,
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      // Mock ledger service
      vi.mocked(StoneLedgerService.appendEntry).mockResolvedValue({
        id: 'ledger-123',
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert',
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
        createdAt: '2023-01-01T00:00:00Z',
      });

      // Execute conversion
      const result = await WalletService.convertStones(mockUserId, 'shard', 20);

      // Verify result
      expect(result).toEqual({
        fromType: 'shard',
        fromAmount: 20,
        toCastingStones: 200,
        newBalance: {
          castingStones: 250,
          inventoryShard: 0,
          inventoryCrystal: 5,
          inventoryRelic: 2,
        },
      });

      // Verify ledger entry was created
      expect(StoneLedgerService.appendEntry).toHaveBeenCalledWith({
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'convert',
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
      });
    });

    it('should fail with insufficient inventory', async () => {
      // Mock config service
      vi.mocked(configService.getConfig).mockResolvedValue({
        value: { shard: 10, crystal: 100, relic: 500 }
      });

      // Mock wallet with insufficient shards
      const mockWallet = {
        id: mockWalletId,
        user_id: mockUserId,
        casting_stones: 50,
        inventory_shard: 5, // Only 5 shards available
        inventory_crystal: 5,
        inventory_relic: 2,
        daily_regen: 0,
        last_regen_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Mock Supabase calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockWallet, error: null }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return {
            select: mockSelect,
          } as any;
        }
        return {} as any;
      });

      // Execute conversion - should fail
      await expect(
        WalletService.convertStones(mockUserId, 'shard', 20)
      ).rejects.toThrow('Insufficient shard inventory. Have 5, need 20');

      // Verify ledger entry was NOT created
      expect(StoneLedgerService.appendEntry).not.toHaveBeenCalled();
    });

    it('should fail with invalid conversion rate', async () => {
      // Mock config service with invalid rate
      vi.mocked(configService.getConfig).mockResolvedValue({
        value: { shard: 0, crystal: 100, relic: 500 } // Invalid rate of 0
      });

      // Execute conversion - should fail
      await expect(
        WalletService.convertStones(mockUserId, 'shard', 10)
      ).rejects.toThrow('Invalid conversion rate for shard');
    });

    it('should fail when conversion rates are not configured', async () => {
      // Mock config service returning null
      vi.mocked(configService.getConfig).mockResolvedValue(null);

      // Execute conversion - should fail
      await expect(
        WalletService.convertStones(mockUserId, 'shard', 10)
      ).rejects.toThrow('Conversion rates not configured');
    });
  });

  describe('applyPurchase', () => {
    it('should successfully apply a stone pack purchase', async () => {
      const mockPackId = 'pack-123';
      
      // Mock stone pack
      const mockPack = {
        id: mockPackId,
        name: 'Starter Pack',
        description: 'A good starting pack',
        price_cents: 999,
        currency: 'USD',
        stones_shard: 100,
        stones_crystal: 50,
        stones_relic: 10,
        bonus_shard: 10,
        bonus_crystal: 5,
        bonus_relic: 1,
        is_active: true,
        sort_order: 1,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Mock wallet
      const mockWallet = {
        id: mockWalletId,
        user_id: mockUserId,
        casting_stones: 50,
        inventory_shard: 20,
        inventory_crystal: 10,
        inventory_relic: 5,
        daily_regen: 0,
        last_regen_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockUpdatedWallet = {
        ...mockWallet,
        inventory_shard: 130, // 20 + 100 + 10
        inventory_crystal: 65, // 10 + 50 + 5
        inventory_relic: 16, // 5 + 10 + 1
      };

      // Mock Supabase calls
      const mockPackSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPack, error: null }),
          }),
        }),
      });

      const mockWalletSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockWallet, error: null }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedWallet, error: null }),
          }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_packs') {
          return {
            select: mockPackSelect,
          } as any;
        } else if (table === 'stone_wallets') {
          return {
            select: mockWalletSelect,
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      // Mock ledger service
      vi.mocked(StoneLedgerService.appendEntry).mockResolvedValue({
        id: 'ledger-123',
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'purchase',
        deltaCastingStones: 0,
        deltaInventoryShard: 110,
        deltaInventoryCrystal: 55,
        deltaInventoryRelic: 11,
        reason: 'Purchased Starter Pack stone pack',
        packId: mockPackId,
        metadata: {
          packName: 'Starter Pack',
          packPrice: 999,
          packCurrency: 'USD',
        },
        createdAt: '2023-01-01T00:00:00Z',
      });

      // Execute purchase
      const result = await WalletService.applyPurchase(mockUserId, mockPackId);

      // Verify result
      expect(result).toEqual({
        packId: mockPackId,
        stonesAdded: {
          shard: 100,
          crystal: 50,
          relic: 10,
        },
        bonusAdded: {
          shard: 10,
          crystal: 5,
          relic: 1,
        },
        newBalance: {
          castingStones: 50,
          inventoryShard: 130,
          inventoryCrystal: 65,
          inventoryRelic: 16,
        },
      });

      // Verify ledger entry was created
      expect(StoneLedgerService.appendEntry).toHaveBeenCalledWith({
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'purchase',
        deltaCastingStones: 0,
        deltaInventoryShard: 110,
        deltaInventoryCrystal: 55,
        deltaInventoryRelic: 11,
        reason: 'Purchased Starter Pack stone pack',
        packId: mockPackId,
        metadata: {
          packName: 'Starter Pack',
          packPrice: 999,
          packCurrency: 'USD',
        },
      });
    });

    it('should fail with invalid pack ID', async () => {
      const mockPackId = 'invalid-pack';

      // Mock Supabase returning no pack
      const mockPackSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_packs') {
          return {
            select: mockPackSelect,
          } as any;
        }
        return {} as any;
      });

      // Execute purchase - should fail
      await expect(
        WalletService.applyPurchase(mockUserId, mockPackId)
      ).rejects.toThrow(`Invalid or inactive stone pack: ${mockPackId}`);
    });
  });

  describe('spendCastingStones', () => {
    it('should successfully spend casting stones', async () => {
      // Mock wallet
      const mockWallet = {
        id: mockWalletId,
        user_id: mockUserId,
        casting_stones: 100,
        inventory_shard: 20,
        inventory_crystal: 10,
        inventory_relic: 5,
        daily_regen: 0,
        last_regen_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockUpdatedWallet = {
        ...mockWallet,
        casting_stones: 80, // 100 - 20
      };

      // Mock Supabase calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockWallet, error: null }),
        }),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedWallet, error: null }),
          }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return {
            select: mockSelect,
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      // Mock ledger service
      vi.mocked(StoneLedgerService.appendEntry).mockResolvedValue({
        id: 'ledger-123',
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'spend',
        deltaCastingStones: -20,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Game action: dice roll',
        metadata: { action: 'dice_roll' },
        createdAt: '2023-01-01T00:00:00Z',
      });

      // Execute spending
      const result = await WalletService.spendCastingStones(
        mockUserId,
        20,
        'Game action: dice roll',
        { action: 'dice_roll' }
      );

      // Verify result
      expect(result).toEqual({
        newBalance: 80,
      });

      // Verify ledger entry was created
      expect(StoneLedgerService.appendEntry).toHaveBeenCalledWith({
        walletId: mockWalletId,
        userId: mockUserId,
        transactionType: 'spend',
        deltaCastingStones: -20,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Game action: dice roll',
        metadata: { action: 'dice_roll' },
      });
    });

    it('should fail with insufficient casting stones', async () => {
      // Mock wallet with insufficient stones
      const mockWallet = {
        id: mockWalletId,
        user_id: mockUserId,
        casting_stones: 10, // Only 10 stones available
        inventory_shard: 20,
        inventory_crystal: 10,
        inventory_relic: 5,
        daily_regen: 0,
        last_regen_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Mock Supabase calls
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockWallet, error: null }),
        }),
      });

      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return {
            select: mockSelect,
          } as any;
        }
        return {} as any;
      });

      // Execute spending - should fail
      await expect(
        WalletService.spendCastingStones(mockUserId, 20, 'Game action')
      ).rejects.toThrow('Insufficient casting stones. Have 10, need 20');
    });
  });
});