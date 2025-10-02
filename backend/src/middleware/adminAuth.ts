import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase.js';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from 'shared';

// Extend Request type to include admin user context
declare global {
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

// Admin authentication middleware
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Check if user has admin role
    const userRole = user.user_metadata?.role;
    if (userRole !== 'admin') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Admin access required',
        req
      );
    }

    // Set admin user context
    req.ctx = {
      userId: user.id,
      isGuest: false,
      user: {
        id: user.id,
        email: user.email,
        isGuest: false,
        role: userRole,
      },
    };

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}
