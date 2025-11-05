/**
 * /me Fetch Service with Role Caching
 * Phase B3: Fetch user role from /api/me with KV caching, jittered TTL, backoff, and telemetry
 */

import { extractAuth } from '../lib/auth.js';
import { getRole, setRole, type AppRole } from '../kv/roleCache.js';
import { track } from '../lib/telemetry.js';

type MeResponse =
  | {
      ok: true;
      data: {
        kind: 'user' | 'guest';
        user: { id: string; email?: string; role?: AppRole; roleVersion?: number } | null;
      };
      meta?: { traceId?: string };
    }
  | { ok: false; error?: { code: string; message?: string } };

/**
 * Convert ArrayBuffer to base64 string
 */
function bToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * Generate TTL with ±20% jitter to smooth stampedes
 * @param base - Base TTL in seconds (default: 30)
 * @returns TTL with jitter (minimum 10 seconds)
 */
function ttlWithJitter(base = 30): number {
  const jitter = Math.floor(base * (0.8 + Math.random() * 0.4));
  return Math.max(10, jitter);
}

/**
 * Fetch with exponential backoff for transient errors
 * @param url - URL to fetch
 * @param init - Fetch options
 * @param attempts - Number of retry attempts (default: 2)
 * @returns Response
 */
async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  attempts = 2
): Promise<Response> {
  let lastErr: any;
  let lastResponse: Response | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;

      // 5xx retryable, 4xx not
      if (r.status >= 500) {
        lastResponse = r;
        lastErr = r;
        if (i < attempts - 1) {
          await new Promise((res) => setTimeout(res, (i + 1) * 150));
        }
        continue;
      }

      return r;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, (i + 1) * 150));
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastErr;
}

/**
 * Fetch user role with caching
 * Uses bearer fingerprint for cache key to avoid per-user DB hits
 * @param req - Incoming request
 * @param env - Worker environment
 * @param ctx - Execution context
 * @returns Role and optional userId
 */
export async function fetchRoleWithCache(
  req: Request,
  env: { API_BASE_URL?: string; ROLE_CACHE?: KVNamespace },
  ctx: ExecutionContext
): Promise<{ role: AppRole; userId?: string }> {
  const { bearer, audience } = extractAuth(req);

  // Anonymous users are always treated as 'pending' during Early Access
  if (audience === 'anon') {
    return { role: 'pending' };
  }

  if (!bearer) {
    return { role: 'pending' };
  }

  // Cache by bearer fingerprint rather than userId, because at the edge
  // we may not know the user id before calling /api/me.
  // This avoids per-user DB hits on every nav while keeping leakage risk low (token-bound cache).
  const bearerHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer));
  const bearerFingerprint = bToBase64(bearerHash).slice(0, 16);

  // Try to fetch from /api/me to get roleVersion (needed for cache key)
  // We'll check cache after we know the roleVersion, but fetch first to get it
  const apiBaseUrl = env.API_BASE_URL || 'https://stonecaster-api.fly.dev';
  const url = new URL('/api/me', apiBaseUrl);

  let meResponse: MeResponse | null = null;
  let roleVersion: number | undefined;

  try {
    const r = await fetchWithBackoff(
      url.toString(),
      {
        headers: { authorization: `Bearer ${bearer}` },
      },
      2
    );

    if (!r.ok) {
      // Track error and fail-safe
      ctx.waitUntil(
        track(env, 'me_error', {
          status: r.status,
          path: url.pathname,
        })
      );
      return { role: 'pending' };
    }

    meResponse = (await r.json()) as MeResponse;

    if (!meResponse.ok) {
      ctx.waitUntil(track(env, 'me_error', { reason: 'not_ok' }));
      return { role: 'pending' };
    }

    // If guest or no user, treat as pending
    if (meResponse.data.kind === 'guest' || !meResponse.data.user) {
      return { role: 'pending' };
    }

    roleVersion = meResponse.data.user.roleVersion;
  } catch (error) {
    // Track error and fail-safe
    ctx.waitUntil(
      track(env, 'me_error', {
        reason: 'fetch_failed',
        error: error instanceof Error ? error.message : 'unknown',
      })
    );
    return { role: 'pending' };
  }

  // Build cache key with roleVersion if available
  const cachedKey = roleVersion
    ? `bf:${bearerFingerprint}:v${roleVersion}`
    : `bf:${bearerFingerprint}`;

  // Check cache (now that we have roleVersion)
  if (env.ROLE_CACHE) {
    const cachedRole = (await getRole(env.ROLE_CACHE, cachedKey)) as AppRole | null;
    if (cachedRole) {
      ctx.waitUntil(track(env, 'role_cache_hit'));
      return { role: cachedRole };
    }
    ctx.waitUntil(track(env, 'role_cache_miss'));
  }

  // Extract role from response (already fetched above)
  if (!meResponse || !meResponse.ok || !meResponse.data.user) {
    return { role: 'pending' };
  }

  const role = meResponse.data.user.role || 'pending';

  // Cache with jittered TTL (24-36s approximate)
  if (env.ROLE_CACHE) {
    const ttl = ttlWithJitter(30);
    ctx.waitUntil(setRole(env.ROLE_CACHE, cachedKey, role, ttl));
  }

  return {
    role,
    userId: meResponse.data.user.id,
  };
}

