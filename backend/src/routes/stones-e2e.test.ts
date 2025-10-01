import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

// Mock all dependencies for E2E testing
vi.mock('../services/wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    convertStones: vi.fn(),
    applyPurchase: vi.fn(),
  },
}));

vi.mock('../services/stonePacks.service.js', () => ({
  StonePacksService: {
    getActivePacks: vi.fn(),
    getPackById: vi.fn(),
  },
}));

vi.mock('../wrappers/payments.js', () => ({
  PaymentService: {
    createStonePackCheckout: vi.fn(),
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth.js', () => ({
  jwtAuth: (req: any, res: any, next: any) => {
    req.ctx = { userId: 'test-user-123' };
    next();
  },
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.ctx?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  },
  optionalAuth: (req: any, res: any, next: any) => {
    req.ctx = { userId: 'test-user-123' };
    next();
  },
}));

describe('Stones Economy E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Stones Economy Flow', () => {
    it('should handle the complete stones economy flow: get wallet → get packs → convert stones → purchase pack', async () => {
      const { WalletService } = await import('../services/wallet.service.js');
      const { StonePacksService } = await import('../services/stonePacks.service.js');
      const { PaymentService } = await import('../wrappers/payments.js');

      // Mock wallet data
      const mockWallet = {
        id: 'wallet-123',
        userId: 'test-user-123',
        castingStones: 50,
        inventoryShard: 20,
        inventoryCrystal: 10,
        inventoryRelic: 5,
        dailyRegen: 0,
        lastRegenAt: '2023-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      // Mock stone packs
      const mockPacks = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Starter Pack',
          description: 'A good starting pack',
          priceCents: 999,
          currency: 'USD',
          stonesShard: 100,
          stonesCrystal: 50,
          stonesRelic: 10,
          bonusShard: 10,
          bonusCrystal: 5,
          bonusRelic: 1,
          isActive: true,
          sortOrder: 1,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      // Mock conversion result
      const mockConversionResult = {
        fromType: 'shard' as const,
        fromAmount: 10,
        toCastingStones: 100,
        newBalance: {
          castingStones: 150,
          inventoryShard: 10,
          inventoryCrystal: 10,
          inventoryRelic: 5,
        },
      };

      // Mock purchase result
      const mockPurchaseResult = {
        packId: 'pack-1',
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
          castingStones: 150,
          inventoryShard: 120,
          inventoryCrystal: 65,
          inventoryRelic: 16,
        },
      };

      // Mock checkout session
      const mockCheckoutSession = {
        sessionId: 'cs_test_123',
        sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      };

      // Setup mocks
      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);
      vi.mocked(StonePacksService.getActivePacks).mockResolvedValue(mockPacks);
      vi.mocked(StonePacksService.getPackById).mockResolvedValue(mockPacks[0]);
      vi.mocked(WalletService.convertStones).mockResolvedValue(mockConversionResult);
      vi.mocked(WalletService.applyPurchase).mockResolvedValue(mockPurchaseResult);
      vi.mocked(PaymentService.createStonePackCheckout).mockResolvedValue(mockCheckoutSession);

      // Step 1: Get wallet
      const walletResponse = await request(app)
        .get('/api/stones/wallet')
        .expect(200);

      expect(walletResponse.body).toEqual({
        ok: true,
        data: {
          shard: 20,
          crystal: 10,
          relic: 5,
          dailyRegen: 0,
          lastRegenAt: '2023-01-01T00:00:00Z',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Step 2: Get available packs
      const packsResponse = await request(app)
        .get('/api/stones/packs')
        .expect(200);

      expect(packsResponse.body).toEqual({
        ok: true,
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Starter Pack',
            description: 'A good starting pack',
            price: 999,
            currency: 'USD',
            stones: {
              shard: 100,
              crystal: 50,
              relic: 10,
            },
            bonus: {
              shard: 10,
              crystal: 5,
              relic: 1,
            },
            isActive: true,
          },
        ],
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Step 3: Convert stones
      const convertResponse = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'shard',
          amount: 10,
        })
        .expect(200);

      expect(convertResponse.body).toEqual({
        ok: true,
        data: mockConversionResult,
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Step 4: Purchase pack
      const purchaseResponse = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: '550e8400-e29b-41d4-a716-446655440000',
        });
      
      expect(purchaseResponse.status).toBe(200);

      expect(purchaseResponse.body).toEqual({
        ok: true,
        data: {
          sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Verify all services were called correctly
      expect(WalletService.getWallet).toHaveBeenCalledWith('test-user-123');
      expect(StonePacksService.getActivePacks).toHaveBeenCalled();
      expect(WalletService.convertStones).toHaveBeenCalledWith('test-user-123', 'shard', 10);
      expect(StonePacksService.getPackById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      expect(PaymentService.createStonePackCheckout).toHaveBeenCalledWith(
        'test-user-123',
        '550e8400-e29b-41d4-a716-446655440000',
        'Starter Pack',
        999,
        'USD'
      );
    });

    it('should handle error scenarios gracefully', async () => {
      const { WalletService } = await import('../services/wallet.service.js');
      const { StonePacksService } = await import('../services/stonePacks.service.js');

      // Test insufficient inventory error
      vi.mocked(WalletService.convertStones).mockRejectedValue(
        new Error('Insufficient shard inventory. Have 5, need 20')
      );

      const convertResponse = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'shard',
          amount: 20,
        })
        .expect(400);

      expect(convertResponse.body).toEqual({
        ok: false,
        error: {
          code: 'INSUFFICIENT_INVENTORY',
          message: 'Insufficient shard inventory. Have 5, need 20',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      // Test invalid pack error
      vi.mocked(StonePacksService.getPackById).mockResolvedValue(null);

      const purchaseResponse = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: '550e8400-e29b-41d4-a716-446655440001',
        })
        .expect(400);

      expect(purchaseResponse.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_PACK',
          message: 'Invalid or inactive stone pack',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should handle guest user wallet access', async () => {
      // Mock auth middleware to not set userId (guest user)
      const authModule = await import('../middleware/auth.js');
      vi.mocked(authModule).jwtAuth = async (req: any, res: any, next: any) => {
        req.ctx = { userId: null };
        next();
      };

      const walletResponse = await request(app)
        .get('/api/stones/wallet')
        .expect(200);

      expect(walletResponse.body).toEqual({
        ok: true,
        data: {
          shard: 0,
          crystal: 0,
          relic: 0,
          dailyRegen: 0,
          lastRegenAt: undefined,
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

  });
});
