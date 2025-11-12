/**
 * Rate Limiting Middleware
 * Per-user rate limits for admin actions
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (for MVP; consider Redis for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const key = config.keyGenerator
      ? config.keyGenerator(req)
      : `rate-limit:${userId}:${req.path}`;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Clean up expired entries
    if (entry && entry.resetAt < now) {
      rateLimitStore.delete(key);
    }

    const current = rateLimitStore.get(key);

    if (!current) {
      // First request in window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      next();
    } else if (current.count < config.maxRequests) {
      // Within limit
      current.count++;
      next();
    } else {
      // Rate limit exceeded
      const resetIn = Math.ceil((current.resetAt - now) / 1000);
      res.status(429).json({
        ok: false,
        error: 'Rate limit exceeded',
        retryAfter: resetIn,
        resetAt: new Date(current.resetAt).toISOString(),
      });
    }
  };
}

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

