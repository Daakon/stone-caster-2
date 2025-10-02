import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from 'shared';

// Extend Request type to include user context
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
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
      const guestId = req.cookies?.guestId;
      if (guestId) {
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
        return next();
      }
    }
    
    // Fall back to guest auth
    const guestId = req.cookies?.guestId;
    if (guestId) {
      req.ctx = {
        userId: guestId,
        isGuest: true,
        user: {
          id: guestId,
          isGuest: true,
        },
      };
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't fail on optional auth errors, just continue without user context
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
