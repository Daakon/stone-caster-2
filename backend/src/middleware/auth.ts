import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { AuthUser, AuthState } from '@shared/types/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { CookieUserLinkingService } from '../services/cookie-user-linking.service.js';
import { ensureProfile } from '../services/profileBootstrap.js';

// Extend Request type to include user context
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
      ctx?: {
        userId?: string;
        isGuest?: boolean;
        user?: {
          id: string;
          email?: string;
          isGuest: boolean;
          role?: string;
        };
      };
    }
  }
}

// Create Supabase client for JWT verification
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// JWT auth middleware
export async function jwtAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header - check for guest cookie
      const guestId = req.cookies?.guestId || req.headers['x-guest-cookie-id'] as string;
      if (guestId) {
        // Use the actual guest cookie ID as the userId for guest users
        req.ctx = {
          userId: guestId,
          isGuest: true,
          user: {
            id: guestId,
            isGuest: true,
          },
        };
        return next();
      }
      
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Invalid or expired token',
        req
      );
    }

    // Set user context
    req.ctx = {
      userId: user.id,
      isGuest: false,
      user: {
        id: user.id,
        email: user.email,
        isGuest: false,
      },
    };

    // Bootstrap profile row if it doesn't exist (idempotent)
    try {
      await ensureProfile(user.id);
    } catch (error) {
      // Log but don't fail the request - profile bootstrap is best-effort
      console.error('[Auth] Failed to bootstrap profile:', error);
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}

// Optional auth middleware (allows both authenticated and guest users)
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    console.log('[optionalAuth] Processing request:', req.path, 'headers:', {
      authorization: req.headers.authorization ? 'present' : 'absent',
      cookie: req.cookies?.guestId ? 'present' : 'absent',
      'x-guest-cookie-id': req.headers['x-guest-cookie-id'] ? 'present' : 'absent'
    });
    
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Try JWT auth first
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.ctx = {
          userId: user.id,
          isGuest: false,
          user: {
            id: user.id,
            email: user.email,
            isGuest: false,
          },
        };
        
        // Bootstrap profile row if it doesn't exist (idempotent)
        try {
          await ensureProfile(user.id);
        } catch (error) {
          // Log but don't fail the request - profile bootstrap is best-effort
          console.error('[Auth] Failed to bootstrap profile:', error);
        }
        
        return next();
      }
    }
    
    // Fall back to guest auth
    const guestId = req.cookies?.guestId || req.headers['x-guest-cookie-id'] as string;
    if (guestId) {
      // Check if this cookie is linked to an authenticated user
      const linkedUserId = await CookieUserLinkingService.getUserIdFromCookie(guestId);
      
      if (linkedUserId) {
        // Cookie is linked to an authenticated user - use the linked user ID
        req.ctx = {
          userId: linkedUserId,
          isGuest: false,
          user: {
            id: linkedUserId,
            isGuest: false,
          },
        };
      } else {
        // Use the actual guest cookie ID as the userId for guest users
        req.ctx = {
          userId: guestId,
          isGuest: true,
          user: {
            id: guestId,
            isGuest: true,
          },
        };
      }
    } else {
      // No guest cookie found - create a new guest ID
      const { v4: uuidv4 } = await import('uuid');
      const newGuestId = uuidv4();
      req.ctx = {
        userId: newGuestId,
        isGuest: true,
        user: {
          id: newGuestId,
          isGuest: true,
        },
      };
    }
    
    console.log('[optionalAuth] Final context:', {
      userId: req.ctx?.userId,
      isGuest: req.ctx?.isGuest,
      user: req.ctx?.user
    });
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't fail on optional auth errors, but ensure we have a user context
    if (!req.ctx) {
      // Create a fallback guest context if none exists
      const { v4: uuidv4 } = await import('uuid');
      const fallbackGuestId = uuidv4();
      req.ctx = {
        userId: fallbackGuestId,
        isGuest: true,
        user: {
          id: fallbackGuestId,
          isGuest: true,
        },
      };
    }
    next();
  }
}

// Require authenticated user (no guests)
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.ctx?.userId || req.ctx.isGuest) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.UNAUTHORIZED,
      'Authenticated user required',
      req
    );
  }
  next();
}

// Require guest user
export function requireGuest(req: Request, res: Response, next: NextFunction): void {
  if (!req.ctx?.userId || !req.ctx.isGuest) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.UNAUTHORIZED,
      'Guest user required',
      req
    );
  }
  next();
}

// New auth middleware using abstraction
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const guestCookie = req.headers['x-guest-cookie'] as string;

  if (authHeader?.startsWith('Bearer ')) {
    // Authenticated user - extract token for later verification
    const token = authHeader.substring(7);
    req.auth = {
      state: AuthState.AUTHENTICATED,
      id: 'pending-verification', // Will be set after JWT verification
      key: token
    };
  } else if (guestCookie) {
    // Guest or cookied user
    req.auth = {
      state: AuthState.COOKIED,
      id: guestCookie
    };
  } else {
    // No auth - create new guest
    const newGuestId = uuidv4();
    req.auth = {
      state: AuthState.GUEST,
      id: newGuestId
    };
  }

  next();
}

// Enhanced JWT verification middleware
export async function verifyJWT(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.auth?.state === AuthState.AUTHENTICATED && req.auth.key) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(req.auth.key);
      
      if (error || !user) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Invalid or expired token',
          req
        );
      }

      // Update auth with verified user data
      req.auth = {
        state: AuthState.AUTHENTICATED,
        id: user.id,
        key: req.auth.key,
        email: user.email,
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0]
      };

      // Also set legacy ctx for backward compatibility
      req.ctx = {
        userId: user.id,
        isGuest: false,
        user: {
          id: user.id,
          email: user.email,
          isGuest: false,
        },
      };
    } catch (error) {
      console.error('JWT verification error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Authentication failed',
        req
      );
    }
  }

  next();
}

// Token authentication middleware for admin routes
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Invalid or expired token',
        req
      );
    }

    // Set user context with role information
    req.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role
    };

    next();
  } catch (error) {
    console.error('Token auth middleware error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}
