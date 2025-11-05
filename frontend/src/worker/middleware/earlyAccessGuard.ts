/**
 * Early Access Guard Middleware
 * Phase B1: Block navigation to app routes when EARLY_ACCESS_MODE='on'
 * unless user's role is early_access or admin
 */

import { isEarlyAccessOn } from '../config/featureFlags.js';
import { fetchRoleWithCache } from '../services/me.js';
import { track } from '../lib/telemetry.js';

/**
 * Public paths that should remain accessible regardless of Early Access mode
 */
const PUBLIC_PATHS = [
  /^\/$/, // home
  /^\/privacy\/?$/, // privacy policy
  /^\/terms\/?$/, // terms of service
  /^\/request-access\/?$/, // request access page
  /^\/auth(\/.*)?$/, // auth routes
  /^\/assets(\/.*)?$/, // static assets
  /^\/api\/health\/?$/, // health check
  /^\/api\/openapi\.json$/, // OpenAPI spec
  /^\/api\/docs(?:\/.*)?$/, // Swagger UI
];

/**
 * Check if a pathname is in the public allowlist
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((rx) => rx.test(pathname));
}

/**
 * Early Access Guard
 * Returns a redirect Response if access should be blocked, null if allowed
 */
export async function earlyAccessGuard(
  req: Request,
  env: { EARLY_ACCESS_MODE?: string; API_BASE_URL?: string; ROLE_CACHE?: KVNamespace; LOG?: any },
  ctx: ExecutionContext
): Promise<Response | null> {
  const url = new URL(req.url);

  // Allow public paths
  if (isPublicPath(url.pathname)) {
    return null;
  }

  // If Early Access mode is off, allow all
  if (!isEarlyAccessOn(env)) {
    return null;
  }

  // Only gate navigations and HTML routes; allow API/CDN if needed
  const accept = req.headers.get('accept') || '';
  const isHtmlNav = accept.includes('text/html');

  // Guard only HTML navigations by default
  if (!isHtmlNav) {
    return null;
  }

  // Fetch role with caching
  const { role } = await fetchRoleWithCache(req, env, ctx);
  const allowed = role === 'early_access' || role === 'admin';

  if (!allowed) {
    // Telemetry log (non-PII)
    ctx.waitUntil(
      track(env, 'ea_redirect', {
        path: url.pathname,
        reason: 'pending_role',
        aud: role === 'pending' ? 'auth' : 'anon',
      })
    );

    // Redirect to request access page
    const target = new URL('/request-access', url.origin);
    return Response.redirect(target.toString(), 302);
  }

  return null; // allowed
}

