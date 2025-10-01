import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { WalletService } from '../services/wallet.service.js';
import { StonePacksService } from '../services/stonePacks.service.js';
import { PaymentService } from '../wrappers/payments.js';

// Mock dependencies
vi.mock('../services/wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    convertStones: vi.fn(),
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

describe('Stones API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/stones/wallet', () => {
    it('should return wallet for authenticated user', async () => {
      const mockWallet = {
        id: 'wallet-123',
        userId: 'test-user-123',
        castingStones: 100,
        inventoryShard: 20,
        inventoryCrystal: 10,
        inventoryRelic: 5,
        dailyRegen: 0,
        lastRegenAt: '2023-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(200);

      expect(response.body).toEqual({
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

      expect(WalletService.getWallet).toHaveBeenCalledWith('test-user-123');
    });

    it('should return empty wallet for guest user', async () => {
      // Mock auth middleware to not set userId
      vi.mocked(require('../middleware/auth.js')).jwtAuth = (req: any, res: any, next: any) => {
        req.ctx = { userId: null };
        next();
      };

      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(200);

      expect(response.body).toEqual({
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

      expect(WalletService.getWallet).not.toHaveBeenCalled();
    });

    it('should handle wallet service errors', async () => {
      vi.mocked(WalletService.getWallet).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch stones wallet',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });

  describe('POST /api/stones/convert', () => {
    it('should successfully convert stones', async () => {
      const mockConversionResult = {
        fromType: 'shard' as const,
        fromAmount: 20,
        toCastingStones: 200,
        newBalance: {
          castingStones: 300,
          inventoryShard: 0,
          inventoryCrystal: 10,
          inventoryRelic: 5,
        },
      };

      vi.mocked(WalletService.convertStones).mockResolvedValue(mockConversionResult);

      const response = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'shard',
          amount: 20,
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: mockConversionResult,
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(WalletService.convertStones).toHaveBeenCalledWith('test-user-123', 'shard', 20);
    });

    it('should handle insufficient inventory error', async () => {
      vi.mocked(WalletService.convertStones).mockRejectedValue(
        new Error('Insufficient shard inventory. Have 5, need 20')
      );

      const response = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'shard',
          amount: 20,
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INSUFFICIENT_INVENTORY',
          message: 'Insufficient shard inventory. Have 5, need 20',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'invalid',
          amount: -1,
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: expect.objectContaining({
            validationErrors: expect.arrayContaining([
              expect.objectContaining({
                field: 'type',
                message: expect.stringContaining('Invalid enum value'),
              }),
              expect.objectContaining({
                field: 'amount',
                message: expect.stringContaining('Number must be greater than or equal to 1'),
              }),
            ]),
          }),
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should require authentication', async () => {
      // Mock auth middleware to not set userId
      vi.mocked(require('../middleware/auth.js')).requireAuth = (req: any, res: any, next: any) => {
        return res.status(401).json({ error: 'Unauthorized' });
      };

      const response = await request(app)
        .post('/api/stones/convert')
        .send({
          type: 'shard',
          amount: 20,
        })
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('GET /api/stones/packs', () => {
    it('should return active stone packs', async () => {
      const mockPacks = [
        {
          id: 'pack-1',
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
        {
          id: 'pack-2',
          name: 'Adventurer Pack',
          description: 'Great value for regular players',
          priceCents: 1999,
          currency: 'USD',
          stonesShard: 250,
          stonesCrystal: 125,
          stonesRelic: 25,
          bonusShard: 25,
          bonusCrystal: 12,
          bonusRelic: 2,
          isActive: true,
          sortOrder: 2,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];

      vi.mocked(StonePacksService.getActivePacks).mockResolvedValue(mockPacks);

      const response = await request(app)
        .get('/api/stones/packs')
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            id: 'pack-1',
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
          {
            id: 'pack-2',
            name: 'Adventurer Pack',
            description: 'Great value for regular players',
            price: 1999,
            currency: 'USD',
            stones: {
              shard: 250,
              crystal: 125,
              relic: 25,
            },
            bonus: {
              shard: 25,
              crystal: 12,
              relic: 2,
            },
            isActive: true,
          },
        ],
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(StonePacksService.getActivePacks).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      vi.mocked(StonePacksService.getActivePacks).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/stones/packs')
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch stones packs',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });

  describe('POST /api/stones/purchase', () => {
    it('should create checkout session for valid pack', async () => {
      const mockPack = {
        id: 'pack-1',
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
      };

      const mockCheckoutSession = {
        sessionId: 'cs_test_123',
        sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      };

      vi.mocked(StonePacksService.getPackById).mockResolvedValue(mockPack);
      vi.mocked(PaymentService.createStonePackCheckout).mockResolvedValue(mockCheckoutSession);

      const response = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: 'pack-1',
        })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: {
          sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(StonePacksService.getPackById).toHaveBeenCalledWith('pack-1');
      expect(PaymentService.createStonePackCheckout).toHaveBeenCalledWith(
        'test-user-123',
        'pack-1',
        'Starter Pack',
        999,
        'USD'
      );
    });

    it('should handle invalid pack ID', async () => {
      vi.mocked(StonePacksService.getPackById).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: 'invalid-pack',
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_PACK',
          message: 'Invalid or inactive stone pack',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(PaymentService.createStonePackCheckout).not.toHaveBeenCalled();
    });

    it('should handle payment service errors', async () => {
      const mockPack = {
        id: 'pack-1',
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
      };

      vi.mocked(StonePacksService.getPackById).mockResolvedValue(mockPack);
      vi.mocked(PaymentService.createStonePackCheckout).mockRejectedValue(
        new Error('Payment session creation failed: Stripe API error')
      );

      const response = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: 'pack-1',
        })
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'PAYMENT_FAILED',
          message: 'Payment session creation failed: Stripe API error',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/stones/purchase')
        .send({
          packId: 'invalid-uuid',
        })
        .expect(400);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: expect.objectContaining({
            validationErrors: expect.arrayContaining([
              expect.objectContaining({
                field: 'packId',
                message: expect.stringContaining('Invalid uuid'),
              }),
            ]),
          }),
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });
});
