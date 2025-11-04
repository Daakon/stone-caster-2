/**
 * Early Access Middleware for Cloudflare Worker
 * Tags requests with early access mode header
 * Phase 0: No redirects yet - just tagging and logging
 */

import { isEarlyAccessOn } from '../config/featureFlags.js';

export interface EarlyAccessContext {
  mode: 'on' | 'off';
  isAuthenticated: boolean;
  route: string;
}

/**
 * Early access middleware
 * Tags requests with x-early-access-mode header
 * Logs route and authentication status
 * 
 * @param request - Incoming request
 * @param env - Worker environment
 * @returns Modified request with early access headers
 */
export function earlyAccessMiddleware(
  request: Request,
  env: { EARLY_ACCESS_MODE?: string }
): Request {
  const mode = isEarlyAccessOn(env) ? 'on' : 'off';
  const url = new URL(request.url);
  const route = url.pathname;
  
  // Determine if request is authenticated (has Authorization header)
  const isAuthenticated = request.headers.get('Authorization')?.startsWith('Bearer ') ?? false;
  
  // Log for debugging (Phase 0: just logging, no routing changes)
  console.log('[EarlyAccess]', {
    route,
    mode,
    isAuthenticated,
    method: request.method,
  });
  
  // Create new request with early access header
  const headers = new Headers(request.headers);
  headers.set('x-early-access-mode', mode);
  
  return new Request(request, {
    headers,
  });
}

