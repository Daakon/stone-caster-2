/**
 * Simple in-memory cache with TTL for v3 micro-caching
 * Safe for per-entry-point ruleset and NPC list caching
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Get value from cache (returns undefined if expired or not found)
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value in cache with optional custom TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTtl;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all entries (cache bust)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Bust entries matching a pattern (for prefix-based invalidation)
   */
  bust(pattern: string | ((key: string) => boolean)): number {
    let count = 0;
    if (typeof pattern === 'string') {
      // Prefix match
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
          count++;
        }
      }
    } else {
      // Custom predicate
      for (const key of this.cache.keys()) {
        if (pattern(key)) {
          this.cache.delete(key);
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; expiresIn: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; expiresIn: number }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const expiresIn = entry.expiresAt - now;
      if (expiresIn > 0) {
        entries.push({ key, expiresIn });
      }
    }

    return {
      size: entries.length,
      entries: entries.sort((a, b) => a.expiresIn - b.expiresIn),
    };
  }
}

// Global cache instances
export const rulesetCache = new SimpleCache<string>(60000); // 60s
export const npcListCache = new SimpleCache<Array<{ slug: string; sort_order: number }>>(60000); // 60s

/**
 * Cache busting API for admin operations
 */
export function bustCache(pattern?: string): number {
  if (pattern) {
    const rulesetCount = rulesetCache.bust(pattern);
    const npcCount = npcListCache.bust(pattern);
    return rulesetCount + npcCount;
  } else {
    rulesetCache.clear();
    npcListCache.clear();
    return -1; // Indicates full clear
  }
}

