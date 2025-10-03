import { Request, Response, NextFunction } from 'express';
import { sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from 'shared';

/**
 * Middleware that requires authenticated user (no guests)
 * Returns REQUIRES_AUTH error code for gating behavior
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.ctx?.userId || req.ctx.isGuest) {
    return sendErrorWithStatus(
      res,
      ApiErrorCode.REQUIRES_AUTH,
      'Authentication required for this action',
      req
    );
  }
  next();
}

/**
 * Middleware that requires guest user
 */
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


