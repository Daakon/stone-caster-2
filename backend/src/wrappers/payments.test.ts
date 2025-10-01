import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Stripe first
vi.mock('stripe', () => {
  const mockStripe = {
    checkout: {
      sessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };

  return {
    default: vi.fn(() => mockStripe),
  };
});

import { PaymentWrapper, PaymentService } from './payments.js';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    cors: {
      origin: 'http://localhost:3000',
    },
  },
}));

describe('PaymentWrapper', () => {
  let mockStripe: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked Stripe instance
    const Stripe = await import('stripe');
    mockStripe = new (Stripe as any).default();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should successfully create a checkout session', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const params = {
        userId: 'user-123',
        packId: 'pack-123',
        packName: 'Starter Pack',
        amountCents: 999,
        currency: 'USD',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      };

      const result = await PaymentWrapper.createCheckoutSession(params);

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Starter Pack',
                description: 'Stone pack purchase for user user-123',
              },
              unit_amount: 999,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'http://localhost:3000/success',
        cancel_url: 'http://localhost:3000/cancel',
        client_reference_id: 'user-123',
        metadata: {
          userId: 'user-123',
          packId: 'pack-123',
        },
      });
    });

    it('should handle Stripe errors', async () => {
      const stripeError = new Error('Stripe API error');
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeError);

      const params = {
        userId: 'user-123',
        packId: 'pack-123',
        packName: 'Starter Pack',
        amountCents: 999,
        currency: 'USD',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      };

      await expect(PaymentWrapper.createCheckoutSession(params)).rejects.toThrow(
        'Payment session creation failed: Stripe API error'
      );
    });

    it('should handle missing session data', async () => {
      const mockSession = {
        id: null,
        url: null,
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const params = {
        userId: 'user-123',
        packId: 'pack-123',
        packName: 'Starter Pack',
        amountCents: 999,
        currency: 'USD',
        successUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel',
      };

      await expect(PaymentWrapper.createCheckoutSession(params)).rejects.toThrow(
        'Failed to create checkout session'
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should successfully verify webhook signature', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await PaymentWrapper.verifyWebhookSignature(
        'payload',
        'signature',
        'webhook_secret'
      );

      expect(result).toEqual({
        isValid: true,
        event: {
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              payment_status: 'paid',
            },
          },
        },
      });

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'webhook_secret'
      );
    });

    it('should handle invalid webhook signature', async () => {
      const signatureError = new Error('Invalid signature');
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw signatureError;
      });

      const result = await PaymentWrapper.verifyWebhookSignature(
        'payload',
        'invalid_signature',
        'webhook_secret'
      );

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid signature',
      });
    });
  });

  describe('getCheckoutSession', () => {
    it('should successfully retrieve a checkout session', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          userId: 'user-123',
          packId: 'pack-123',
        },
        amount_total: 999,
        currency: 'usd',
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await PaymentWrapper.getCheckoutSession('cs_test_123');

      expect(result).toEqual(mockSession);
      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_123');
    });

    it('should handle retrieval errors', async () => {
      const stripeError = new Error('Session not found');
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(stripeError);

      await expect(PaymentWrapper.getCheckoutSession('invalid_session')).rejects.toThrow(
        'Failed to retrieve session: Session not found'
      );
    });
  });

  describe('isSessionCompleted', () => {
    it('should return true for completed and paid session', () => {
      const session = {
        payment_status: 'paid',
        status: 'complete',
      };

      expect(PaymentWrapper.isSessionCompleted(session)).toBe(true);
    });

    it('should return false for incomplete session', () => {
      const session = {
        payment_status: 'unpaid',
        status: 'open',
      };

      expect(PaymentWrapper.isSessionCompleted(session)).toBe(false);
    });

    it('should return false for missing session', () => {
      expect(PaymentWrapper.isSessionCompleted(null)).toBe(false);
      expect(PaymentWrapper.isSessionCompleted(undefined)).toBe(false);
    });
  });

  describe('extractSessionMetadata', () => {
    it('should extract valid metadata', () => {
      const session = {
        metadata: {
          userId: 'user-123',
          packId: 'pack-123',
        },
      };

      const result = PaymentWrapper.extractSessionMetadata(session);

      expect(result).toEqual({
        userId: 'user-123',
        packId: 'pack-123',
      });
    });

    it('should return null for missing metadata', () => {
      const session = {
        metadata: {},
      };

      const result = PaymentWrapper.extractSessionMetadata(session);

      expect(result).toBeNull();
    });

    it('should return null for missing session', () => {
      expect(PaymentWrapper.extractSessionMetadata(null)).toBeNull();
      expect(PaymentWrapper.extractSessionMetadata(undefined)).toBeNull();
    });
  });
});

describe('PaymentService', () => {
  let mockStripe: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked Stripe instance
    const Stripe = await import('stripe');
    mockStripe = new (Stripe as any).default();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createStonePackCheckout', () => {
    it('should create checkout session with correct URLs', async () => {
      const mockSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const result = await PaymentService.createStonePackCheckout(
        'user-123',
        'pack-123',
        'Starter Pack',
        999,
        'USD'
      );

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/stones/success?session_id={CHECKOUT_SESSION_ID}',
          cancel_url: 'http://localhost:3000/stones/cancel',
        })
      );
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook with environment secret', async () => {
      const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_WEBHOOK_SECRET = 'test_webhook_secret';

      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = await PaymentService.handleWebhook('payload', 'signature');

      expect(result).toEqual({
        isValid: true,
        event: {
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              payment_status: 'paid',
            },
          },
        },
      });

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'test_webhook_secret'
      );

      // Restore environment
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
    });

    it('should throw error when webhook secret is not configured', async () => {
      const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      await expect(
        PaymentService.handleWebhook('payload', 'signature')
      ).rejects.toThrow('Stripe webhook secret not configured');

      // Restore environment
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
    });
  });

  describe('processCompletedSession', () => {
    it('should process a completed session successfully', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          userId: 'user-123',
          packId: 'pack-123',
        },
        amount_total: 999,
        currency: 'usd',
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await PaymentService.processCompletedSession('cs_test_123');

      expect(result).toEqual({
        userId: 'user-123',
        packId: 'pack-123',
        amountCents: 999,
        currency: 'usd',
      });
    });

    it('should throw error for incomplete session', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'unpaid',
        status: 'open',
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      await expect(
        PaymentService.processCompletedSession('cs_test_123')
      ).rejects.toThrow('Session is not completed or paid');
    });

    it('should throw error for session with invalid metadata', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        status: 'complete',
        metadata: {},
        amount_total: 999,
        currency: 'usd',
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      await expect(
        PaymentService.processCompletedSession('cs_test_123')
      ).rejects.toThrow('Invalid session metadata');
    });
  });
});