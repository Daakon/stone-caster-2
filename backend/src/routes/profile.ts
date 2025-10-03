import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { validateRequest } from '../middleware/validation.js';
import { jwtAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/validation.js';
import { ProfileService } from '../services/profile.service.js';
import { UpdateProfileRequestSchema, RevokeSessionsRequestSchema, ApiErrorCode } from 'shared';

const router = Router();

// Apply authentication to all profile routes
router.use(jwtAuth);

// Get current user's profile
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const profile = await ProfileService.getProfile(userId);
    sendSuccess(res, profile, req);
  } catch (error) {
    console.error('Error fetching profile:', error);
    
    if (error instanceof Error && error.message === 'Profile not found') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Profile not found',
        req
      );
    }
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch profile',
      req
    );
  }
});

// Update current user's profile
router.put('/', 
  rateLimit(60000, 10), // 10 requests per minute for profile updates
  validateRequest(UpdateProfileRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User authentication required',
          req
        );
      }

      const updateData = req.body;
      const profile = await ProfileService.updateProfile(userId, updateData);
      
      // Log profile update for audit
      console.log(`Profile updated for user ${userId}`, {
        traceId: req.traceId,
        updatedFields: Object.keys(updateData),
      });
      
      sendSuccess(res, profile, req);
    } catch (error) {
      console.error('Error updating profile:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Display name must be between') ||
            error.message.includes('Invalid avatar URL') ||
            error.message.includes('Invalid theme value')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            error.message,
            req
          );
        }
        
        if (error.message === 'Profile not found') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Profile not found',
            req
          );
        }
      }
      
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to update profile',
        req
      );
    }
  }
);

// Revoke other sessions (requires CSRF token)
router.post('/revoke-sessions',
  rateLimit(300000, 5), // 5 requests per 5 minutes for session revocation
  validateRequest(RevokeSessionsRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      const { csrfToken } = req.body;
      
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User authentication required',
          req
        );
      }

      // Validate CSRF token
      const isValidToken = await ProfileService.validateCSRFToken(userId, csrfToken);
      if (!isValidToken) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.CSRF_TOKEN_INVALID,
          'Invalid or expired CSRF token',
          req
        );
      }

      // Get current session ID from JWT (this would need to be extracted from the token)
      const currentSessionId = req.headers['x-session-id'] as string || 'current-session';
      
      const result = await ProfileService.revokeOtherSessions(userId, currentSessionId);
      
      // Log session revocation for audit
      console.log(`Sessions revoked for user ${userId}`, {
        traceId: req.traceId,
        revokedCount: result.revokedCount,
        currentSessionPreserved: result.currentSessionPreserved,
      });
      
      sendSuccess(res, result, req);
    } catch (error) {
      console.error('Error revoking sessions:', error);
      
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to revoke sessions',
        req
      );
    }
  }
);

// Generate CSRF token for profile updates
router.post('/csrf-token', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const csrfToken = await ProfileService.generateCSRFToken(userId);
    
    sendSuccess(res, { csrfToken }, req);
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to generate CSRF token',
      req
    );
  }
});

// Guest profile routes (no authentication required)
// Get guest profile by cookie ID
router.get('/guest/:cookieId', async (req: Request, res: Response) => {
  try {
    const { cookieId } = req.params;
    
    if (!cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Cookie ID is required',
        req
      );
    }

    const guestProfile = await ProfileService.getGuestProfile(cookieId);
    sendSuccess(res, guestProfile, req);
  } catch (error) {
    console.error('Error fetching guest profile:', error);
    
    if (error instanceof Error && error.message === 'Guest profile not found') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Guest profile not found',
        req
      );
    }
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch guest profile',
      req
    );
  }
});

// Create new guest profile
router.post('/guest', async (req: Request, res: Response) => {
  try {
    const { cookieId, deviceLabel } = req.body;
    
    if (!cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Cookie ID is required',
        req
      );
    }

    const guestProfile = await ProfileService.createGuestProfile(cookieId, deviceLabel);
    sendSuccess(res, guestProfile, req);
  } catch (error) {
    console.error('Error creating guest profile:', error);
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create guest profile',
      req
    );
  }
});

// Link guest account to authenticated user
router.post('/link-guest', 
  rateLimit(300000, 5), // 5 requests per 5 minutes for account linking
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      const { cookieGroupId } = req.body;
      
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User authentication required',
          req
        );
      }

      if (!cookieGroupId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Cookie group ID is required',
          req
        );
      }

      await ProfileService.linkCookieGroupToUser(userId, cookieGroupId);
      
      // Log account linking for audit
      console.log(`Guest account linked to user ${userId}`, {
        traceId: req.traceId,
        cookieGroupId,
      });
      
      sendSuccess(res, { success: true }, req);
    } catch (error) {
      console.error('Error linking guest account:', error);
      
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to link guest account',
        req
      );
    }
  }
);

export default router;
