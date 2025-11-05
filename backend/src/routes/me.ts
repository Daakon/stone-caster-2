import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toUserDTO } from '../utils/dto-mappers.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';
import type { AppRole } from '@shared/types/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import type { AppRole } from '@shared/types/auth.js';

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

    // Get role and role_version from profiles table if authenticated
    let role: AppRole | null = null;
    let roleVersion: number = 1;
    if (!isGuest && userId) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, role_version')
          .eq('id', userId)
          .single();
        
        role = (profile?.role || 'pending') as AppRole;
        roleVersion = profile?.role_version || 1;
      } catch (error) {
        // If profile doesn't exist, default to 'pending'
        role = 'pending';
        roleVersion = 1;
      }
    }

    // Return identity information based on authentication state
    const identity = {
      user: isGuest ? null : {
        id: user?.id || userId,
        email: user?.email,
        role: role || undefined,
        roleVersion,
      },
      kind: isGuest ? 'guest' as const : 'user' as const,
    };

    // Set role headers for cache invalidation (Phase B3)
    if (!isGuest && role) {
      res.setHeader('x-role', role);
      res.setHeader('x-role-version', String(roleVersion));
    }

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
