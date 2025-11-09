/**
 * Rate Limit Tests
 * CI gate: Ensure rate limiting works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../src/middleware/rate-limit.js';

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow requests within limit', async () => {
    const req = {
      user: { id: 'test-user' },
      path: '/test',
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn() as NextFunction;

    const middleware = rateLimit({ maxRequests: 10, windowMs: 3600000 });
    
    // Make 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      await middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it('should block requests over limit', async () => {
    const req = {
      user: { id: 'test-user' },
      path: '/test',
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn() as NextFunction;

    const middleware = rateLimit({ maxRequests: 5, windowMs: 3600000 });
    
    // Make 6 requests (over limit)
    for (let i = 0; i < 6; i++) {
      await middleware(req, res, next);
    }

    // Last request should be blocked
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

