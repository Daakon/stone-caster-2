/**
 * Cache Provider Interface
 * Phase 6: Performance & Cost Controls - Pluggable caching abstraction
 */

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, val: T, opts?: { ttlSec?: number }): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export interface CacheOptions {
  maxSize?: number;
  defaultTtlSec?: number;
  redisUrl?: string;
}

/**
 * In-Memory Cache Provider using LRU eviction
 */
export class InMemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, { value: any; expiresAt?: number }>();
  private maxSize: number;
  private defaultTtlSec: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtlSec = options.defaultTtlSec || 3600; // 1 hour default
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  async set<T>(key: string, val: T, opts?: { ttlSec?: number }): Promise<void> {
    // Remove oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }

    const ttlSec = opts?.ttlSec ?? this.defaultTtlSec;
    const expiresAt = ttlSec > 0 ? Date.now() + (ttlSec * 1000) : undefined;

    this.cache.set(key, { value: val, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());
    if (!pattern) {
      return allKeys;
    }
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  // Additional methods for monitoring
  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Redis Cache Provider
 */
export class RedisCacheProvider implements CacheProvider {
  private client: any;
  private defaultTtlSec: number;

  constructor(options: CacheOptions = {}) {
    this.defaultTtlSec = options.defaultTtlSec || 3600; // 1 hour default
    
    if (!options.redisUrl) {
      throw new Error('Redis URL is required for RedisCacheProvider');
    }

    // Dynamic import to avoid requiring redis in all environments
    this.initializeRedis(options.redisUrl);
  }

  private async initializeRedis(redisUrl: string | undefined): Promise<void> {
    try {
      // Dynamic import to avoid requiring redis in all environments
      const redis = await import('redis') as any;
      this.client = redis.createClient({ url: redisUrl! });
      
      this.client.on('error', (err: Error) => {
        console.error('[Cache] Redis client error:', err);
      });

      await this.client.connect();
      console.log('[Cache] Redis client connected');
    } catch (error) {
      console.error('[Cache] Failed to initialize Redis:', error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Cache] Failed to get key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, val: T, opts?: { ttlSec?: number }): Promise<void> {
    try {
      const ttlSec = opts?.ttlSec ?? this.defaultTtlSec;
      const serialized = JSON.stringify(val);
      
      if (ttlSec > 0) {
        await this.client.setEx(key, ttlSec, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error(`[Cache] Failed to set key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`[Cache] Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushDb();
    } catch (error) {
      console.error('[Cache] Failed to clear cache:', error);
      throw error;
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern || '*';
      return await this.client.keys(searchPattern);
    } catch (error) {
      console.error(`[Cache] Failed to get keys with pattern ${pattern}:`, error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
  }
}

/**
 * Create cache provider based on environment configuration
 */
export function createCacheProvider(options: CacheOptions = {}): CacheProvider {
  const redisUrl = process.env.REDIS_URL || options.redisUrl;
  
  if (redisUrl) {
    console.log('[Cache] Using Redis cache provider');
    return new RedisCacheProvider({ ...options, redisUrl });
  } else {
    console.log('[Cache] Using in-memory cache provider');
    return new InMemoryCacheProvider(options);
  }
}

/**
 * Cache key utilities
 */
export class CacheKeyBuilder {
  static core(id: string, version: string, hash: string): string {
    return `awf:core:${id}:${version}:${hash}`;
  }

  static world(id: string, version: string, hash: string): string {
    return `awf:world:${id}:${version}:${hash}`;
  }

  static adventure(id: string, version: string, hash: string): string {
    return `awf:adv:${id}:${version}:${hash}`;
  }

  static adventureStart(id: string, hash: string): string {
    return `awf:advstart:${id}:${hash}`;
  }

  static slice(docId: string, version: string, hash: string, sliceName: string): string {
    return `awf:slice:${docId}:${version}:${hash}:${sliceName}`;
  }

  static sceneSlicePolicy(sceneId: string): string {
    return `awf:scene:${sceneId}:policy`;
  }

  /**
   * Extract hash from cache key
   */
  static extractHash(key: string): string | null {
    const parts = key.split(':');
    return parts.length >= 4 ? parts[parts.length - 1] : null;
  }

  /**
   * Get all keys for a specific document type and ID
   */
  static getDocumentKeys(provider: CacheProvider, docType: string, docId: string): Promise<string[]> {
    const pattern = `awf:${docType}:${docId}:*`;
    return provider.keys(pattern);
  }
}
