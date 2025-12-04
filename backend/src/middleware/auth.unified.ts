/**
 * Unified Authentication Middleware
 * Replaces: jwtAuth, optionalAuth, authenticateToken, adminGuard, requireAdmin, requireRole
 * 
 * Uses AuthService to abstract Supabase dependencies
 * Reference: CHIMERA_ARCHITECTURE_SPEC.md Section 3.1 (Routes -> Service -> Repo)
 */

import type { Request, Response, NextFunction } from 'express';
import type { Client } from 'pg';
import { authService, type AuthUser } from '../services/auth/auth.service.js';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';

// Extend Request type to include standardized user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      // Legacy ctx for backward compatibility (will be deprecated)
      ctx?: {
        userId?: string;
        isGuest?: boolean;
        user?: any;
        dbTxClient?: Client; // For testTx middleware compatibility
      };
    }
  }
}

/**
 * Require authenticated user (no guests)
 * Replaces: jwtAuth, authenticateToken, requireAuth
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const token = authHeader.substring(7);
    const result = await authService.validateToken(token);

    if (!result.valid || !result.user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        result.error || 'Invalid or expired token',
        req
      );
    }

    // Set standardized user context
    req.user = result.user;

    // Set legacy ctx for backward compatibility
    req.ctx = {
      userId: result.user.id,
      isGuest: false,
      user: {
        id: result.user.id,
        email: result.user.email,
        isGuest: false,
        role: result.user.roles[0] // First role for legacy compatibility
      }
    };

    // Bootstrap profile
    await authService.bootstrapProfile(result.user.id);

    next();
  } catch (error) {
    console.error('[requireAuth] Error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}

/**
 * Optional auth middleware (allows both authenticated and guest users)
 * Replaces: optionalAuth
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const context = await authService.getAuthContext(req);

    if (context.user) {
      // Set standardized user context
      req.user = context.user;

      // Set legacy ctx for backward compatibility
      req.ctx = {
        userId: context.user.id,
        isGuest: context.user.isGuest,
        user: {
          id: context.user.id,
          email: context.user.email,
          isGuest: context.user.isGuest,
          role: context.user.roles[0] // First role for legacy compatibility
        }
      };

      // Bootstrap profile if authenticated
      if (!context.user.isGuest) {
        await authService.bootstrapProfile(context.user.id);
      }
    } else {
      // No user - create guest context
      const guestId = req.cookies?.guestId || req.headers['x-guest-cookie-id'] as string || 'anonymous';
      req.ctx = {
        userId: guestId,
        isGuest: true,
        user: {
          id: guestId,
          isGuest: true
        }
      };
    }

    next();
  } catch (error) {
    console.error('[optionalAuth] Error:', error);
    // Don't fail on optional auth errors - create fallback guest context
    if (!req.ctx) {
      req.ctx = {
        userId: 'anonymous',
        isGuest: true,
        user: {
          id: 'anonymous',
          isGuest: true
        }
      };
    }
    next();
  }
}

/**
 * Require admin role
 * Replaces: requireAdmin, adminGuard
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // First require authentication
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    const token = authHeader.substring(7);
    const result = await authService.validateToken(token);

    if (!result.valid || !result.user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        result.error || 'Invalid or expired token',
        req
      );
    }

    // Check admin role
    const isAdmin = await authService.isAdmin(result.user.id);

    if (!isAdmin) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'Admin access required',
        req
      );
    }

    // Set standardized user context
    req.user = result.user;

    // Set legacy ctx for backward compatibility
    req.ctx = {
      userId: result.user.id,
      isGuest: false,
      user: {
        id: result.user.id,
        email: result.user.email,
        isGuest: false,
        role: 'admin'
      }
    };

    // Bootstrap profile
    await authService.bootstrapProfile(result.user.id);

    next();
  } catch (error) {
    console.error('[requireAdmin] Error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Authentication failed',
      req
    );
  }
}

/**
 * Require specific role(s)
 * Replaces: requireRole from rbac.ts
 * 
 * @param roles - Single role or array of roles (user must have at least one)
 */
export function requireRole(roles: string | string[]): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // First require authentication
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const token = authHeader.substring(7);
      const result = await authService.validateToken(token);

      if (!result.valid || !result.user) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          result.error || 'Invalid or expired token',
          req
        );
      }

      // Check if user has at least one of the required roles
      const userRoles = result.user.roles;
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          `Access denied. Required role: ${requiredRoles.join(' or ')}`,
          req
        );
      }

      // Set standardized user context
      req.user = result.user;

      // Set legacy ctx for backward compatibility
      req.ctx = {
        userId: result.user.id,
        isGuest: false,
        user: {
          id: result.user.id,
          email: result.user.email,
          isGuest: false,
          role: result.user.roles[0] // First role for legacy compatibility
        }
      };

      // Bootstrap profile
      await authService.bootstrapProfile(result.user.id);

      next();
    } catch (error) {
      console.error('[requireRole] Error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Authentication failed',
        req
      );
    }
  };
}

/**
 * Legacy alias for requireAdmin (for backward compatibility)
 * @deprecated Use requireAdmin instead
 */
export const requireAdminRole = requireAdmin;

/**
 * Check if the current user is an admin (helper function)
 * Replaces: isAdmin from auth-admin.ts
 * @param req Express request with user context
 * @returns true if user has admin role
 */
export async function isAdmin(req: Request): Promise<boolean> {
  const userId = req.user?.id || req.ctx?.userId;
  if (!userId) {
    return false;
  }
  return await authService.isAdmin(userId);
}

/**
 * Check if debug fields should be included in response
 * Replaces: allowDebug from auth-admin.ts
 * @param req Express request
 * @returns true if isAdmin(req) and ?debug=1 query param is present
 */
export async function allowDebug(req: Request): Promise<boolean> {
  // Check query param first (faster)
  const debugParam = req.query.debug;
  if (debugParam !== '1' && debugParam !== 'true') {
    return false;
  }

  // If debug param is present, check admin status
  return await isAdmin(req);
}

