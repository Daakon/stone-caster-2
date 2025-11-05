/**
 * Simple LRU Cache Implementation
 * Phase B3: In-process cache for role lookups to reduce DB calls
 */

type Entry<T> = { v: T; exp: number };

/**
 * Simple LRU cache with TTL support
 * @template T - Type of cached values
 */
export class SimpleLRU<T> {
  private map = new Map<string, Entry<T>>();

  constructor(private max = 1000) {}

  /**
   * Get a value from cache
   * @param k - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(k: string): T | undefined {
    const e = this.map.get(k);
    if (!e) return undefined;

    if (e.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }

    return e.v;
  }

  /**
   * Set a value in cache
   * @param k - Cache key
   * @param v - Value to cache
   * @param ttlMs - Time to live in milliseconds
   */
  set(k: string, v: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.map.size >= this.max) {
      this.map.delete(this.map.keys().next().value);
    }

    this.map.set(k, { v, exp: Date.now() + ttlMs });
  }

  /**
   * Delete a value from cache
   * @param k - Cache key
   */
  delete(k: string): void {
    this.map.delete(k);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.map.size;
  }
}

