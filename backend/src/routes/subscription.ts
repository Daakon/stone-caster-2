import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toSubscriptionDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { jwtAuth, requireAuth } from '../middleware/auth.js';
import { CreateSubscriptionRequestSchema, CancelSubscriptionRequestSchema } from '@shared';
import { ApiErrorCode } from '@shared';

const router = Router();

// Get subscription info (auth only)
router.get('/', jwtAuth, requireAuth, async (req: Request, res: Response) => {
  try {
    // Mock subscription data - in real implementation, this would come from database
    const subscription = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'active',
      currentPeriodStart: '2023-01-01T00:00:00Z',
      currentPeriodEnd: '2023-02-01T00:00:00Z',
      cancelAtPeriodEnd: false,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const subscriptionDTO = toSubscriptionDTO(subscription);
    sendSuccess(res, subscriptionDTO, req);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch subscription',
      req
    );
  }
});

// Create subscription (auth only)
router.post('/create', jwtAuth, requireAuth, validateRequest(CreateSubscriptionRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    // const { priceId, paymentMethodId } = req.body; // TODO: Implement subscription creation

    // Mock subscription creation - in real implementation, this would handle payment processing
    const subscription = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const subscriptionDTO = toSubscriptionDTO(subscription);
    sendSuccess(res, subscriptionDTO, req, 201);
  } catch (error) {
    console.error('Error creating subscription:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create subscription',
      req
    );
  }
});

// Cancel subscription (auth only)
router.post('/cancel', jwtAuth, requireAuth, validateRequest(CancelSubscriptionRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.body;

    // Mock subscription cancellation - in real implementation, this would handle the cancellation
    const subscription = {
      id: subscriptionId,
      status: 'canceled',
      currentPeriodStart: '2023-01-01T00:00:00Z',
      currentPeriodEnd: '2023-02-01T00:00:00Z',
      cancelAtPeriodEnd: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    };

    const subscriptionDTO = toSubscriptionDTO(subscription);
    sendSuccess(res, subscriptionDTO, req);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to cancel subscription',
      req
    );
  }
});

// Get subscription portal (auth only)
router.post('/portal', jwtAuth, requireAuth, async (req: Request, res: Response) => {
  try {
    // Mock portal URL - in real implementation, this would generate a Stripe portal URL
    const portalUrl = 'https://billing.stripe.com/p/login/test_portal';

    sendSuccess(res, { url: portalUrl }, req);
  } catch (error) {
    console.error('Error creating subscription portal:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create subscription portal',
      req
    );
  }
});

export default router;
