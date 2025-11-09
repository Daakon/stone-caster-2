/**
 * Mustache Template Cache
 * LRU cache for compiled Mustache templates
 */

import Mustache from 'mustache';

interface CompiledTemplate {
  template: Mustache.Template;
  body: string;
}

// Simple LRU cache (max 100 entries)
const cache = new Map<string, CompiledTemplate>();
const MAX_SIZE = 100;
const accessOrder: string[] = [];

function getCacheKey(body: string): string {
  // Use a hash of the body as the key
  // In production, you might want to use a proper hash function
  return body;
}

function touch(key: string): void {
  const index = accessOrder.indexOf(key);
  if (index >= 0) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(key);
}

function evict(): void {
  if (accessOrder.length >= MAX_SIZE) {
    const oldest = accessOrder.shift();
    if (oldest) {
      cache.delete(oldest);
    }
  }
}

/**
 * Get or compile a Mustache template
 */
export function getCompiledTemplate(body: string): Mustache.Template {
  const key = getCacheKey(body);
  const cached = cache.get(key);

  if (cached && cached.body === body) {
    touch(key);
    return cached.template;
  }

  // Compile template
  const template = Mustache.parse(body);
  const compiled = {
    template,
    body,
  };

  evict();
  cache.set(key, compiled);
  touch(key);

  return template;
}

/**
 * Render using cached compiled template
 */
export function renderCached(body: string, context: Record<string, unknown>): string {
  const template = getCompiledTemplate(body);
  return Mustache.render(body, context, {}, template);
}

/**
 * Invalidate cache (call after template publish)
 */
export function invalidateCache(): void {
  cache.clear();
  accessOrder.length = 0;
}

