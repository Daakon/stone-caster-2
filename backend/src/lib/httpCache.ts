/**
 * HTTP Caching Utilities
 * Phase A4: Strong ETag generation and conditional request handling
 */

import crypto from 'crypto';
import type { Response } from 'express';

/**
 * SHA256 hash in base64
 */
export function sha256Base64(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('base64');
}

/**
 * Build a stable strong ETag from:
 * - a resource key (e.g., npc id or list query signature)
 * - a version timestamp (e.g., updated_at max ISO)
 * Keep it short and cache-friendly.
 * Returns quoted strong ETag.
 */
export function buildETag(key: string, versionISO: string): string {
  let etag = `sc:${sha256Base64(`${key}:${versionISO}`).slice(0, 27)}`;
  // Ensure quoted strong ETag
  if (!/^".+"$/.test(etag)) {
    etag = `"${etag}"`;
  }
  return etag;
}

/**
 * Parse If-None-Match header into a Set of tags
 */
export function parseIfNoneMatch(h?: string | null): Set<string> {
  if (!h) return new Set();
  return new Set(h.split(',').map((s) => s.trim()));
}

/**
 * Compare ETag and optionally Last-Modified to decide 304
 */
export function shouldReturnNotModified(
  reqETags: Set<string>,
  currentETag: string,
  ifModifiedSince?: string | null,
  lastModifiedISO?: string
): boolean {
  // Check ETag match
  if (reqETags.has('*') || reqETags.has(currentETag)) {
    return true;
  }

  // Check Last-Modified if both are present
  if (ifModifiedSince && lastModifiedISO) {
    const ims = Date.parse(ifModifiedSince);
    const lm = Date.parse(lastModifiedISO);
    if (!Number.isNaN(ims) && !Number.isNaN(lm) && lm <= ims) {
      return true;
    }
  }

  return false;
}

/**
 * Standard cache headers for anon traffic
 * s-maxage for proxies/CDN; SWR enables resilience
 */
export function setSharedCache(res: Response, { seconds = 60 } = {}): void {
  res.setHeader(
    'Cache-Control',
    `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=300, stale-if-error=600`
  );
}

