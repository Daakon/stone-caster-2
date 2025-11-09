/**
 * Templates Cache
 * In-memory cache for active templates with invalidation
 */

import { getActiveTemplates } from './templates.service.js';
import type { SlotType } from '../slots/registry.js';

interface CacheEntry {
  templates: Awaited<ReturnType<typeof getActiveTemplates>>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000; // 60 seconds

/**
 * Get cached active templates or fetch from DB
 */
export async function getCachedActiveTemplates(
  type?: SlotType,
  templatesVersion?: number
): Promise<Awaited<ReturnType<typeof getActiveTemplates>>> {
  const cacheKey = `${type || 'all'}:${templatesVersion || 'latest'}`;
  const entry = cache.get(cacheKey);

  if (entry && entry.expiresAt > Date.now()) {
    return entry.templates;
  }

  // Fetch from DB
  const templates = await getActiveTemplates(type, templatesVersion);

  // Cache it
  cache.set(cacheKey, {
    templates,
    expiresAt: Date.now() + TTL_MS,
  });

  return templates;
}

/**
 * Invalidate cache (call after publish)
 */
export function invalidateCache(): void {
  cache.clear();
}

/**
 * Invalidate cache for specific type/version
 */
export function invalidateCacheFor(type?: SlotType, templatesVersion?: number): void {
  if (!type && !templatesVersion) {
    cache.clear();
    return;
  }

  // Remove matching entries
  for (const key of cache.keys()) {
    const [keyType, keyVersion] = key.split(':');
    if (
      (!type || keyType === type || keyType === 'all') &&
      (!templatesVersion || keyVersion === String(templatesVersion) || keyVersion === 'latest')
    ) {
      cache.delete(key);
    }
  }
}

