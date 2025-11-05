/**
 * Admin Guard Middleware
 * Universal middleware for protecting admin routes
 * Combines authentication + admin role check
 * 
 * This is the standard way to protect admin routes across the codebase.
 */

import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { isAdmin } from './auth-admin.js';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { ensureProfile } from '../services/profileBootstrap.js';

// Create Supabase client for JWT verification
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

/**
 * Universal admin guard middleware
 * 1. Authenticates the user (requires Bearer token, no guest fallback)
 * 2. Sets req.ctx with user information
 * 3. Checks admin role
 * 
 * Usage:
 * router.get('/admin/route', adminGuard, handler);
 */
export async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Require Bearer token authentication (no guest fallback for admin routes)
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
      console.error('[AdminGuard] Failed to bootstrap profile:', error);
    }

    // Check admin role
    const admin = await isAdmin(req);
    if (!admin) {
      // Log for debugging
      console.log('[AdminGuard] Admin check failed', {
        userId: req.ctx?.userId,
        hasCtx: !!req.ctx,
        isGuest: req.ctx?.isGuest,
      });
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Admin access required',
        req
      );
    }

    // All checks passed
    next();
  } catch (error) {
    console.error('[AdminGuard] Error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}

