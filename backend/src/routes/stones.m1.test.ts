import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import stonesRouter from './stones.js';
import { WalletService } from '../services/wallet.service.js';
import { ApiErrorCode } from '@shared';

// Mock the wallet service
vi.mock('../services/wallet.service.js', () => ({
  WalletService: {
    getWallet: vi.fn(),
    getOrCreateWallet: vi.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api/stones', stonesRouter);

describe('Layer M1 - Wallet Read Operations', () => {
  const mockUserId = uuidv4();
  const mockGuestId = uuidv4();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Wallet Read (GET /api/stones/wallet)', () => {
    it('should return casting stones balance for authenticated user', async () => {
      const mockWallet = {
        id: uuidv4(),
        userId: mockUserId,
        castingStones: 150,
        inventoryShard: 25,
        inventoryCrystal: 10,
        inventoryRelic: 2,
        dailyRegen: 5,
        lastRegenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful wallet retrieval
      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({
        shard: 25,
        crystal: 10,
        relic: 2,
        dailyRegen: 5,
        lastRegenAt: mockWallet.lastRegenAt
      });
      expect(response.body.meta.traceId).toBeDefined();
      expect(WalletService.getWallet).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty wallet for guest user', async () => {
      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Cookie', `guestId=${mockGuestId}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({
        shard: 0,
        crystal: 0,
        relic: 0,
        dailyRegen: 0,
        lastRegenAt: undefined
      });
      expect(response.body.meta.traceId).toBeDefined();
      // WalletService should not be called for guests
      expect(WalletService.getWallet).not.toHaveBeenCalled();
    });

    it('should reject wallet access without authentication', async () => {
      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(401);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(response.body.error.message).toContain('Authentication required');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should handle wallet service errors gracefully', async () => {
      // Mock wallet service error
      vi.mocked(WalletService.getWallet).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(500);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(response.body.error.message).toContain('Failed to fetch stones wallet');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should return wallet with zero balance for new user', async () => {
      const mockWallet = {
        id: uuidv4(),
        userId: mockUserId,
        castingStones: 0,
        inventoryShard: 0,
        inventoryCrystal: 0,
        inventoryRelic: 0,
        dailyRegen: 0,
        lastRegenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful wallet retrieval with zero balance
      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({
        shard: 0,
        crystal: 0,
        relic: 0,
        dailyRegen: 0,
        lastRegenAt: mockWallet.lastRegenAt
      });
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should return wallet with high balance for premium user', async () => {
      const mockWallet = {
        id: uuidv4(),
        userId: mockUserId,
        castingStones: 5000,
        inventoryShard: 1000,
        inventoryCrystal: 500,
        inventoryRelic: 100,
        dailyRegen: 50,
        lastRegenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful wallet retrieval with high balance
      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({
        shard: 1000,
        crystal: 500,
        relic: 100,
        dailyRegen: 50,
        lastRegenAt: mockWallet.lastRegenAt
      });
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Wallet DTO Redaction', () => {
    it('should not include internal wallet fields in response', async () => {
      const mockWallet = {
        id: uuidv4(),
        userId: mockUserId,
        castingStones: 150,
        inventoryShard: 25,
        inventoryCrystal: 10,
        inventoryRelic: 2,
        dailyRegen: 5,
        lastRegenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Internal fields that should be redacted
        internalFlags: ['premium_user'],
        systemMetadata: { source: 'migration' },
        auditTrail: ['created', 'updated']
      };

      // Mock successful wallet retrieval
      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual({
        shard: 25,
        crystal: 10,
        relic: 2,
        dailyRegen: 5,
        lastRegenAt: mockWallet.lastRegenAt
      });
      // Internal fields should not be present
      expect(response.body.data.id).toBeUndefined();
      expect(response.body.data.userId).toBeUndefined();
      expect(response.body.data.castingStones).toBeUndefined();
      expect(response.body.data.internalFlags).toBeUndefined();
      expect(response.body.data.systemMetadata).toBeUndefined();
      expect(response.body.data.auditTrail).toBeUndefined();
      expect(response.body.data.createdAt).toBeUndefined();
      expect(response.body.data.updatedAt).toBeUndefined();
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Response Envelope Compliance', () => {
    it('should include traceId in all responses', async () => {
      const mockWallet = {
        id: uuidv4(),
        userId: mockUserId,
        castingStones: 100,
        inventoryShard: 20,
        inventoryCrystal: 5,
        inventoryRelic: 1,
        dailyRegen: 3,
        lastRegenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.mocked(WalletService.getWallet).mockResolvedValue(mockWallet);

      const response = await request(app)
        .get('/api/stones/wallet')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.traceId).toBeDefined();
      expect(typeof response.body.meta.traceId).toBe('string');
      // Should be a valid UUID
      expect(response.body.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should include traceId in error responses', async () => {
      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(401);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.traceId).toBeDefined();
      expect(typeof response.body.meta.traceId).toBe('string');
      expect(response.body.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
