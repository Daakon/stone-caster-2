/**
 * Rate Limiter Utility
 * Phase B5: In-memory LRU-based rate limiting for access requests
 */

import { SimpleLRU } from './lru.js';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/**
 * Simple rate limiter using LRU cache
 * Tracks requests per key (e.g., ip:email) with TTL
 */
export class RateLimiter {
  private cache: SimpleLRU<RateLimitEntry>;
  private windowMs: number;

  constructor(maxEntries = 10000, windowMs = 3600000) {
    // 1 hour default window
    this.cache = new SimpleLRU<RateLimitEntry>(maxEntries);
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   * @param key - Rate limit key (e.g., "ip:email")
   * @param limit - Maximum requests per window
   * @returns true if allowed, false if rate limited
   */
  check(key: string, limit: number): boolean {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      // First request
      this.cache.set(key, { count: 1, resetAt: now + this.windowMs }, this.windowMs);
      return true;
    }

    if (now >= entry.resetAt) {
      // Window expired, reset
      this.cache.set(key, { count: 1, resetAt: now + this.windowMs }, this.windowMs);
      return true;
    }

    if (entry.count >= limit) {
      // Rate limited
      return false;
    }

    // Increment count
    entry.count++;
    const ttl = entry.resetAt - now;
    this.cache.set(key, entry, ttl);
    return true;
  }

  /**
   * Get time until reset (in seconds)
   * @param key - Rate limit key
   * @returns Seconds until reset, or 0 if not found
   */
  getResetTime(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return 0;
    const remaining = entry.resetAt - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance for access requests (5 requests per hour per IP+email)
export const accessRequestRateLimiter = new RateLimiter(10000, 3600000); // 1 hour window

