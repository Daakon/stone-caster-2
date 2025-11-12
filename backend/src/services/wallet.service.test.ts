import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletService } from './wallet.service.js';
import { StoneLedgerService } from './stoneLedger.service.js';
import { createSupabaseAdminMock } from '../test-utils/supabase-mock.js';
import { createConfigServiceMock } from '../test-utils/config-mock.js';
import type { StoneWallet } from '@shared';

type SupabaseAdminMock = ReturnType<typeof createSupabaseAdminMock>['mockSupabaseAdmin'];
type ConfigServiceMock = ReturnType<typeof createConfigServiceMock>['mockConfigService'];

const mockSupabaseAdmin = (globalThis as any).mockSupabaseAdmin as SupabaseAdminMock;
const mockConfigService = (globalThis as any).mockConfigService as ConfigServiceMock;

vi.mock('./stoneLedger.service.js', () => ({
  StoneLedgerService: {
    appendEntry: vi.fn(),
  },
}));

const ledgerAppend = vi.mocked(StoneLedgerService.appendEntry);

const mockUserId = 'user-123';
const mockWalletId = 'wallet-123';

const defaultPricing = {
  turnCostDefault: 2,
  turnCostByWorld: {},
  guestStarterCastingStones: 10,
  guestDailyRegen: 5,
  conversionRates: {
    shard: 10,
    crystal: 5,
    relic: 2,
  },
};

const buildWallet = (overrides: Partial<StoneWallet> = {}): StoneWallet => ({
  id: mockWalletId,
  userId: mockUserId,
  castingStones: 50,
  inventoryShard: 20,
  inventoryCrystal: 5,
  inventoryRelic: 2,
  dailyRegen: 0,
  lastRegenAt: '2023-01-01T00:00:00Z',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createWalletUpdateBuilder = (updatedRow: any) => {
  const single = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));

  return {
    builder: { update } as any,
    update,
  };
};

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin.from.mockReset();
    mockConfigService.getPricing.mockReset?.();
    ledgerAppend.mockReset();
    mockConfigService.getPricing.mockReturnValue(defaultPricing);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('convertStones', () => {
    it('converts shards into casting stones and records ledger entry', async () => {
      const wallet = buildWallet();
      const getWalletSpy = vi.spyOn(WalletService as any, 'getOrCreateWallet').mockResolvedValue(wallet);

      const updatedRow = {
        id: mockWalletId,
        casting_stones: 250,
        inventory_shard: 0,
        inventory_crystal: wallet.inventoryCrystal,
        inventory_relic: wallet.inventoryRelic,
      };
      const { builder } = createWalletUpdateBuilder(updatedRow);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return builder;
        }
        return {} as any;
      });

      ledgerAppend.mockResolvedValue(undefined as any);

      const result = await WalletService.convertStones(mockUserId, 'shard', 20);

      expect(result).toEqual({
        fromType: 'shard',
        fromAmount: 20,
        toCastingStones: 200,
        newBalance: {
          castingStones: 250,
          inventoryShard: 0,
          inventoryCrystal: wallet.inventoryCrystal,
          inventoryRelic: wallet.inventoryRelic,
        },
      });

      expect(ledgerAppend).toHaveBeenCalledWith({
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

      getWalletSpy.mockRestore();
    });

    it('fails when inventory is insufficient', async () => {
      const wallet = buildWallet({ inventoryShard: 5 });
      const getWalletSpy = vi.spyOn(WalletService as any, 'getOrCreateWallet').mockResolvedValue(wallet);

      await expect(WalletService.convertStones(mockUserId, 'shard', 20)).rejects.toThrow(
        'Insufficient shard inventory. Have 5, need 20'
      );

      expect(mockSupabaseAdmin.from).not.toHaveBeenCalledWith('stone_wallets');
      getWalletSpy.mockRestore();
    });

    it('fails when conversion rate is invalid', async () => {
      mockConfigService.getPricing.mockReturnValue({
        ...defaultPricing,
        conversionRates: { shard: 0 },
      });

      const wallet = buildWallet();
      const getWalletSpy = vi.spyOn(WalletService as any, 'getOrCreateWallet').mockResolvedValue(wallet);

      await expect(WalletService.convertStones(mockUserId, 'shard', 5)).rejects.toThrow(
        'Invalid conversion rate for shard'
      );

      getWalletSpy.mockRestore();
    });

    it('fails when conversion rates missing', async () => {
      mockConfigService.getPricing.mockReturnValue({
        ...defaultPricing,
        conversionRates: undefined as any,
      });

      const wallet = buildWallet();
      const getWalletSpy = vi.spyOn(WalletService as any, 'getOrCreateWallet').mockResolvedValue(wallet);

      await expect(WalletService.convertStones(mockUserId, 'shard', 5)).rejects.toThrow(
        'Conversion rates not configured'
      );

      getWalletSpy.mockRestore();
    });
  });

  describe('spendCastingStones', () => {
    it('spends casting stones and logs ledger entry', async () => {
      const wallet = buildWallet({ castingStones: 100 });
      const getWalletSpy = vi.spyOn(WalletService as any, 'getWallet').mockResolvedValue(wallet);

      const updatedRow = {
        id: mockWalletId,
        casting_stones: 80,
      };
      const { builder } = createWalletUpdateBuilder(updatedRow);

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'stone_wallets') {
          return builder;
        }
        return {} as any;
      });

      ledgerAppend.mockResolvedValue(undefined as any);

      const result = await WalletService.spendCastingStones(
        mockUserId,
        20,
        'idempotency-key',
        'game-id',
        'Game action: dice roll'
      );

      expect(result).toEqual({ success: true, newBalance: 80 });
      expect(ledgerAppend).toHaveBeenCalledWith({
        walletId: mockWalletId,
        userId: mockUserId,
        cookieGroupId: undefined,
        transactionType: 'spend',
        deltaCastingStones: -20,
        deltaInventoryShard: 0,
        deltaInventoryCrystal: 0,
        deltaInventoryRelic: 0,
        reason: 'Game action: dice roll',
        metadata: {},
      });

      getWalletSpy.mockRestore();
    });

    it('returns failure when inventory is insufficient', async () => {
      const wallet = buildWallet({ castingStones: 10 });
      const getWalletSpy = vi.spyOn(WalletService as any, 'getWallet').mockResolvedValue(wallet);

      const result = await WalletService.spendCastingStones(
        mockUserId,
        20,
        'idempotency-key',
        'game-id',
        'Game action'
      );

      expect(result).toEqual({
        success: false,
        newBalance: 0,
        error: 'INSUFFICIENT_INVENTORY',
        message: 'Insufficient casting stones. Have 10, need 20',
      });
      expect(ledgerAppend).not.toHaveBeenCalled();

      getWalletSpy.mockRestore();
    });
  });
});
