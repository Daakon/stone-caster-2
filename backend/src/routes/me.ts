import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toUserDTO } from '../utils/dto-mappers.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiErrorCode } from 'shared';

const router = Router();

// Get current user info
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;
    const user = req.ctx?.user;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    // Return identity information based on authentication state
    const identity = {
      user: isGuest ? null : {
        id: user?.id || userId,
        email: user?.email,
      },
      kind: isGuest ? 'guest' : 'user',
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
