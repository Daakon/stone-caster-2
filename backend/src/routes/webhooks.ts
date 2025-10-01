import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { PaymentService } from '../wrappers/payments.js';
import { WalletService } from '../services/wallet.service.js';
import { supabaseAdmin } from '../services/supabase.js';
import { ApiErrorCode } from 'shared';

const router = Router();

// Stripe webhook handler (internal, server-to-server)
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = req.body;

    if (!signature) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Missing Stripe signature',
        req
      );
    }

    // Verify webhook signature
    const verificationResult = await PaymentService.handleWebhook(payload, signature);
    
    if (!verificationResult.isValid) {
      console.error('Invalid webhook signature:', verificationResult.error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Invalid webhook signature',
        req
      );
    }

    const event = verificationResult.event!;

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      try {
        // Process the completed session
        const sessionData = await PaymentService.processCompletedSession(session.id);
        
        // Apply the purchase to user's wallet
        const purchaseResult = await WalletService.applyPurchase(
          sessionData.userId,
          sessionData.packId
        );

        // Update payment session status in database
        await supabaseAdmin
          .from('payment_sessions')
          .update({
            status: 'completed',
            metadata: {
              ...session,
              purchaseResult,
            },
          })
          .eq('session_id', session.id);

        console.log('Successfully processed payment:', {
          userId: sessionData.userId,
          packId: sessionData.packId,
          amountCents: sessionData.amountCents,
          currency: sessionData.currency,
        });

        return sendSuccess(res, { status: 'processed' }, req);
      } catch (error) {
        console.error('Error processing payment:', error);
        
        // Update payment session status to failed
        await supabaseAdmin
          .from('payment_sessions')
          .update({
            status: 'failed',
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          })
          .eq('session_id', session.id);

        return sendErrorWithStatus(
          res,
          ApiErrorCode.PAYMENT_FAILED,
          'Failed to process payment',
          req
        );
      }
    }

    // Handle other webhook events (optional)
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      
      // Update payment session status to cancelled
      await supabaseAdmin
        .from('payment_sessions')
        .update({
          status: 'cancelled',
          metadata: {
            reason: 'session_expired',
          },
        })
        .eq('session_id', session.id);

      console.log('Payment session expired:', session.id);
    }

    // Return success for unhandled events
    return sendSuccess(res, { status: 'received' }, req);
  } catch (error) {
    console.error('Webhook handler error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Webhook processing failed',
      req
    );
  }
});

export default router;
