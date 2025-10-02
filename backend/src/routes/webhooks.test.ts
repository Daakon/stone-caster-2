import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { PaymentService } from '../wrappers/payments.js';
import { WalletService } from '../services/wallet.service.js';

// Mock dependencies
vi.mock('../wrappers/payments.js', () => ({
  PaymentService: {
    handleWebhook: vi.fn(),
    processCompletedSession: vi.fn(),
  },
}));

vi.mock('../services/wallet.service.js', () => ({
  WalletService: {
    applyPurchase: vi.fn(),
  },
}));

const mockSupabaseAdmin = {
  from: vi.fn(),
};

vi.mock('../services/supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('Webhooks API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/webhooks/stripe', () => {
    it('should successfully process checkout.session.completed event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            status: 'complete',
            metadata: {
              userId: 'test-user-123',
              packId: 'pack-123',
            },
            amount_total: 999,
            currency: 'usd',
          },
        },
      };

      const mockSessionData = {
        userId: 'test-user-123',
        packId: 'pack-123',
        amountCents: 999,
        currency: 'usd',
      };

      const mockPurchaseResult = {
        packId: 'pack-123',
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
          castingStones: 100,
          inventoryShard: 110,
          inventoryCrystal: 55,
          inventoryRelic: 11,
        },
      };

      // Mock webhook verification
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: true,
        event: mockEvent,
      });

      // Mock session processing
      vi.mocked(PaymentService.processCompletedSession).mockResolvedValue(mockSessionData);

      // Mock wallet service
      vi.mocked(WalletService.applyPurchase).mockResolvedValue(mockPurchaseResult);

      // Mock database update
      const mockUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'payment_sessions') {
          return mockUpdate;
        }
        return {} as any;
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: { status: 'processed' },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(PaymentService.handleWebhook).toHaveBeenCalledWith({ test: 'payload' }, 'test_signature');
      expect(PaymentService.processCompletedSession).toHaveBeenCalledWith('cs_test_123');
      expect(WalletService.applyPurchase).toHaveBeenCalledWith('test-user-123', 'pack-123');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle missing stripe signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({ test: 'payload' })
        .expect(403);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Missing Stripe signature',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(PaymentService.handleWebhook).not.toHaveBeenCalled();
    });

    it('should handle invalid webhook signature', async () => {
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: false,
        error: 'Invalid signature',
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({ test: 'payload' })
        .expect(403);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Invalid webhook signature',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should handle payment processing errors', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            status: 'complete',
            metadata: {
              userId: 'test-user-123',
              packId: 'pack-123',
            },
            amount_total: 999,
            currency: 'usd',
          },
        },
      };

      // Mock webhook verification
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: true,
        event: mockEvent,
      });

      // Mock session processing error
      vi.mocked(PaymentService.processCompletedSession).mockRejectedValue(
        new Error('Session is not completed or paid')
      );

      // Mock database update for failed status
      const mockUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'payment_sessions') {
          return mockUpdate;
        }
        return {} as any;
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'PAYMENT_FAILED',
          message: 'Failed to process payment',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'failed',
        metadata: {
          error: 'Session is not completed or paid',
        },
      });
    });

    it('should handle wallet service errors', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            status: 'complete',
            metadata: {
              userId: 'test-user-123',
              packId: 'pack-123',
            },
            amount_total: 999,
            currency: 'usd',
          },
        },
      };

      const mockSessionData = {
        userId: 'test-user-123',
        packId: 'pack-123',
        amountCents: 999,
        currency: 'usd',
      };

      // Mock webhook verification
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: true,
        event: mockEvent,
      });

      // Mock session processing
      vi.mocked(PaymentService.processCompletedSession).mockResolvedValue(mockSessionData);

      // Mock wallet service error
      vi.mocked(WalletService.applyPurchase).mockRejectedValue(
        new Error('Invalid or inactive stone pack: pack-123')
      );

      // Mock database update for failed status
      const mockUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'payment_sessions') {
          return mockUpdate;
        }
        return {} as any;
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'PAYMENT_FAILED',
          message: 'Failed to process payment',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'failed',
        metadata: {
          error: 'Invalid or inactive stone pack: pack-123',
        },
      });
    });

    it('should handle checkout.session.expired event', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_test_123',
            status: 'expired',
          },
        },
      };

      // Mock webhook verification
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: true,
        event: mockEvent,
      });

      // Mock database update
      const mockUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'payment_sessions') {
          return mockUpdate;
        }
        return {} as any;
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: { status: 'received' },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'cancelled',
        metadata: {
          reason: 'session_expired',
        },
      });
    });

    it('should handle unhandled webhook events', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_123',
          },
        },
      };

      // Mock webhook verification
      vi.mocked(PaymentService.handleWebhook).mockResolvedValue({
        isValid: true,
        event: mockEvent,
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(200);

      expect(response.body).toEqual({
        ok: true,
        data: { status: 'received' },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });

    it('should handle webhook processing errors', async () => {
      vi.mocked(PaymentService.handleWebhook).mockRejectedValue(
        new Error('Webhook processing failed')
      );

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send({ test: 'payload' })
        .expect(500);

      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Webhook processing failed',
        },
        meta: expect.objectContaining({
          traceId: expect.any(String),
        }),
      });
    });
  });
});
