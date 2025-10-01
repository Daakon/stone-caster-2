import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toStonesWalletDTO, toStonesPackDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { jwtAuth, requireAuth } from '../middleware/auth.js';
import { ConvertStonesRequestSchema, PurchaseStonesRequestSchema } from 'shared';
import { ApiErrorCode } from 'shared';

const router = Router();

// Get stones wallet
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    // Mock wallet data - in real implementation, this would come from database
    const wallet = {
      shard: 15,
      crystal: 8,
      relic: 2,
      dailyRegen: 5,
      lastRegenAt: '2023-01-01T00:00:00Z',
    };

    const walletDTO = toStonesWalletDTO(wallet);
    sendSuccess(res, walletDTO, req);
  } catch (error) {
    console.error('Error fetching stones wallet:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch stones wallet',
      req
    );
  }
});

// Convert stones (auth only)
router.post('/convert', jwtAuth, requireAuth, validateRequest(ConvertStonesRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { amount, fromType, toType } = req.body;

    // Mock conversion logic - in real implementation, this would handle the conversion
    const conversionResult = {
      from: { type: fromType, amount },
      to: { type: toType, amount: amount * 10 }, // Mock conversion rate
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, conversionResult, req);
  } catch (error) {
    console.error('Error converting stones:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to convert stones',
      req
    );
  }
});

// Get stones packs
router.get('/packs', async (req: Request, res: Response) => {
  try {
    // Mock packs data - in real implementation, this would come from database
    const packs = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
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
    ];

    const packDTOs = packs.map(toStonesPackDTO);
    sendSuccess(res, packDTOs, req);
  } catch (error) {
    console.error('Error fetching stones packs:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch stones packs',
      req
    );
  }
});

// Purchase stones (auth only)
router.post('/purchase', jwtAuth, requireAuth, validateRequest(PurchaseStonesRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { packId, paymentMethodId } = req.body;

    // Mock purchase logic - in real implementation, this would handle payment processing
    const purchaseResult = {
      packId,
      paymentMethodId,
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, purchaseResult, req);
  } catch (error) {
    console.error('Error purchasing stones:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to purchase stones',
      req
    );
  }
});

export default router;
