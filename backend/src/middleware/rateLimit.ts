/**
 * Phase 8: Simple rate limiting middleware
 * Sliding window per game_id (default: 5 requests per 10 seconds)
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

// In-memory store (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitWindow>();

const DEFAULT_LIMIT = parseInt(process.env.RATE_LIMIT_REQUESTS || '5', 10);
const DEFAULT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '10000', 10);

/**
 * Rate limit middleware for send-turn endpoint
 * Limits requests per game_id
 */
export function rateLimitSendTurn(req: Request, res: Response, next: NextFunction) {
  const gameId = req.params?.id;
  
  if (!gameId) {
    return next(); // No game ID, skip rate limiting
  }

  const key = `send-turn:${gameId}`;
  const now = Date.now();
  const window = rateLimitStore.get(key);

  // Check if window exists and is still valid
  if (window && window.resetAt > now) {
    // Window active, check count
    if (window.count >= DEFAULT_LIMIT) {
      return res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Maximum ${DEFAULT_LIMIT} requests per ${DEFAULT_WINDOW_MS / 1000} seconds.`,
        },
        meta: {
          traceId: (req as any).traceId || '',
        },
      });
    }
    // Increment count
    window.count++;
  } else {
    // Create new window
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + DEFAULT_WINDOW_MS,
    });
  }

  // Cleanup old windows periodically (every 100 requests or 5 minutes)
  if (Math.random() < 0.01 || rateLimitStore.size > 1000) {
    const cutoff = now - DEFAULT_WINDOW_MS;
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < cutoff) {
        rateLimitStore.delete(k);
      }
    }
  }

  next();
}

/**
 * Reset rate limit for testing
 */
export function resetRateLimit(): void {
  rateLimitStore.clear();
}

