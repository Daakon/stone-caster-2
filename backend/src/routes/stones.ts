import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toStonesWalletDTO, toStonesPackDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { optionalAuth, requireAuth, jwtAuth } from '../middleware/auth.js';
import { ConvertStonesRequestSchema, PurchaseStonesRequestSchema } from '@shared';
import { ApiErrorCode } from '@shared';
import { WalletService } from '../services/wallet.service.js';
import { StonePacksService } from '../services/stonePacks.service.js';
import { PaymentService } from '../wrappers/payments.js';

const router = Router();

// Get stones wallet - Layer M1: supports both guest and authenticated users
router.get('/wallet', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.REQUIRES_AUTH,
        'Authentication required to view stone balance',
        req
      );
    }

    // Both guest and authenticated users can read wallet balance
    const wallet = await WalletService.getWallet(userId, isGuest || false);
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
    const { type, amount } = req.body;
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'User not authenticated', req);
    }

    const conversionResult = await WalletService.convertStones(userId, type, amount);
    
    sendSuccess(res, conversionResult, req);
  } catch (error) {
    console.error('Error converting stones:', error);
    
    if (error instanceof Error && error.message.includes('Insufficient')) {
      sendErrorWithStatus(
        res,
        ApiErrorCode.INSUFFICIENT_INVENTORY,
        error.message,
        req
      );
    } else {
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to convert stones',
        req
      );
    }
  }
});

// Get stones packs (auth only)
router.get('/packs', jwtAuth, requireAuth, async (req: Request, res: Response) => {
  try {
    const packs = await StonePacksService.getActivePacks();
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
    const { packId } = req.body;
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'User not authenticated', req);
    }

    // Validate pack exists and is active
    const pack = await StonePacksService.getPackById(packId);
    if (!pack) {
      sendErrorWithStatus(
        res,
        ApiErrorCode.INVALID_PACK,
        'Invalid or inactive stone pack',
        req
      );
      return;
    }

    // Create checkout session
    const checkoutSession = await PaymentService.createStonePackCheckout(
      userId,
      packId,
      pack.name,
      pack.priceCents,
      pack.currency
    );

    sendSuccess(res, { sessionUrl: checkoutSession.sessionUrl }, req);
  } catch (error) {
    console.error('Error purchasing stones:', error);
    
    if (error instanceof Error && error.message.includes('Payment')) {
      sendErrorWithStatus(
        res,
        ApiErrorCode.PAYMENT_FAILED,
        error.message,
        req
      );
    } else {
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to purchase stones',
        req
      );
    }
  }
});

export default router;
