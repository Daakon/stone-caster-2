import Stripe from 'stripe';
import { config, configService } from '../config/index.js';

// Initialize Stripe with configuration
const env = configService.getEnv();
const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
});

export interface CreateCheckoutSessionParams {
  userId: string;
  packId: string;
  packName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  sessionUrl: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: WebhookEvent;
  error?: string;
}

/**
 * Payment wrapper service - the only place where Stripe SDK is used
 * All payment operations must go through this wrapper
 */
export class PaymentWrapper {
  /**
   * Create a Stripe checkout session for stone pack purchase
   */
  static async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              product_data: {
                name: params.packName,
                description: `Stone pack purchase for user ${params.userId}`,
              },
              unit_amount: params.amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        client_reference_id: params.userId,
        metadata: {
          userId: params.userId,
          packId: params.packId,
        },
      });

      if (!session.id || !session.url) {
        throw new Error('Failed to create checkout session');
      }

      return {
        sessionId: session.id,
        sessionUrl: session.url,
      };
    } catch (error) {
      console.error('Payment wrapper error creating checkout session:', error);
      throw new Error(`Payment session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify Stripe webhook signature and parse event
   */
  static async verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Promise<WebhookVerificationResult> {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      
      return {
        isValid: true,
        event: {
          id: event.id,
          type: event.type,
          data: {
            object: event.data.object,
          },
        },
      };
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
      };
    }
  }

  /**
   * Retrieve a checkout session by ID
   */
  static async getCheckoutSession(sessionId: string): Promise<any> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.error('Payment wrapper error retrieving session:', error);
      throw new Error(`Failed to retrieve session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a checkout session is completed and paid
   */
  static isSessionCompleted(session: any): boolean {
    return session?.payment_status === 'paid' && session?.status === 'complete';
  }

  /**
   * Extract user and pack information from session metadata
   */
  static extractSessionMetadata(session: any): { userId: string; packId: string } | null {
    const metadata = session?.metadata;
    if (!metadata?.userId || !metadata?.packId) {
      return null;
    }
    
    return {
      userId: metadata.userId,
      packId: metadata.packId,
    };
  }
}

/**
 * Payment service that uses the wrapper
 * This is the service layer that routes/services should use
 */
export class PaymentService {
  /**
   * Create a checkout session for stone pack purchase
   */
  static async createStonePackCheckout(
    userId: string,
    packId: string,
    packName: string,
    amountCents: number,
    currency: string = 'USD'
  ): Promise<CheckoutSessionResult> {
    const baseUrl = config.cors.origin || 'http://localhost:3000';
    
    return PaymentWrapper.createCheckoutSession({
      userId,
      packId,
      packName,
      amountCents,
      currency,
      successUrl: `${baseUrl}/stones/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/stones/cancel`,
    });
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<WebhookVerificationResult> {
    const env = configService.getEnv();
    const webhookSecret = env.stripeWebhookSecret;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return PaymentWrapper.verifyWebhookSignature(payload, signature, webhookSecret);
  }

  /**
   * Process a completed checkout session
   */
  static async processCompletedSession(sessionId: string): Promise<{
    userId: string;
    packId: string;
    amountCents: number;
    currency: string;
  }> {
    const session = await PaymentWrapper.getCheckoutSession(sessionId);
    
    if (!PaymentWrapper.isSessionCompleted(session)) {
      throw new Error('Session is not completed or paid');
    }

    const metadata = PaymentWrapper.extractSessionMetadata(session);
    if (!metadata) {
      throw new Error('Invalid session metadata');
    }

    return {
      userId: metadata.userId,
      packId: metadata.packId,
      amountCents: session.amount_total,
      currency: session.currency,
    };
  }
}
