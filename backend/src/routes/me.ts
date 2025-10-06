import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toUserDTO } from '../utils/dto-mappers.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiErrorCode } from '@shared';

const router = Router();

// Get current user info - Layer M0: supports both guest and authenticated users
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;
    const user = req.ctx?.user;
    
    // Layer M0: Return guest identity when no user context is available
    if (!userId) {
      const guestIdentity = {
        kind: 'guest' as const,
        user: null,
      };
      return sendSuccess(res, guestIdentity, req);
    }

    // Return identity information based on authentication state
    const identity = {
      user: isGuest ? null : {
        id: user?.id || userId,
        email: user?.email,
      },
      kind: isGuest ? 'guest' as const : 'user' as const,
    };

    sendSuccess(res, identity, req);
  } catch (error) {
    console.error('Error fetching user info:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch user info',
      req
    );
  }
});

export default router;
