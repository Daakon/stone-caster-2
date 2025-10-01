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
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    // Mock user data - in real implementation, this would come from database
    const user = {
      id: userId,
      email: isGuest ? undefined : 'user@example.com',
      isGuest: isGuest || false,
      castingStones: {
        shard: 10,
        crystal: 5,
        relic: 1,
      },
      subscription: isGuest ? undefined : {
        status: 'active',
        currentPeriodEnd: '2023-12-31T23:59:59Z',
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    const userDTO = toUserDTO(user);
    sendSuccess(res, userDTO, req);
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
