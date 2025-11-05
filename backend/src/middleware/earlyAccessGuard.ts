/**
 * Early Access Guard Middleware
 * Phase B3: Block gameplay APIs when EARLY_ACCESS_MODE='on' unless caller's role is early_access or admin
 * Includes telemetry for monitoring
 */

import type { Request, Response, NextFunction } from 'express';
import { isEarlyAccessOn } from '../config/featureFlags.js';
import { resolveRole } from '../services/roleResolver.js';

/**
 * Emit telemetry event (non-blocking)
 * Phase B3: Track guard actions for monitoring
 */
function emit(name: string, fields: Record<string, any> = {}): void {
  // Plug into your logger/metrics sink
  // For now, use structured console.log (replace with your logger)
  console.log(
    JSON.stringify({
      event: name,
      ts: Date.now(),
      ...fields,
    })
  );
}

/**
 * Routes that should always be accessible regardless of Early Access mode
 */
const ALLOWLIST = [
  /^\/api\/health(?:\/.*)?$/,
  /^\/api\/openapi\.json$/,
  /^\/api\/docs(?:\/.*)?$/,
  /^\/api\/catalog(?:\/.*)?$/,
  /^\/api\/me(?:\/.*)?$/,
  /^\/api\/auth(?:\/.*)?$/,
  /^\/api\/config(?:\/.*)?$/,
];

/**
 * Routes that should be protected when Early Access mode is on
 */
const PROTECTED = [
  /^\/api\/games(?:\/.*)?$/,
  /^\/api\/turns(?:\/.*)?$/,
  /^\/api\/saves(?:\/.*)?$/,
  /^\/api\/progress(?:\/.*)?$/,
  /^\/api\/story(?:\/.*)?$/,
  /^\/api\/adventures(?:\/.*)?$/,
  /^\/api\/characters(?:\/.*)?$/,
  /^\/api\/players-v3(?:\/.*)?$/,
  /^\/api\/premades(?:\/.*)?$/,
  /^\/api\/stones(?:\/.*)?$/,
  /^\/api\/subscription(?:\/.*)?$/,
  /^\/api\/telemetry(?:\/.*)?$/,
];

/**
 * Check if a path matches any of the regex patterns
 */
function matches(path: string, rules: RegExp[]): boolean {
  return rules.some((rx) => rx.test(path));
}

/**
 * Early Access Guard Middleware
 * Enforces Early Access mode on protected routes
 */
export async function earlyAccessGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const path = req.path || req.url;

  // Skip when feature flag off or route is allowlisted
  if (!isEarlyAccessOn() || matches(path, ALLOWLIST)) {
    return next();
  }

  // Only enforce for protected routes
  if (!matches(path, PROTECTED)) {
    return next();
  }

  // Resolve user role
  const { role, authed } = await resolveRole(req);

  // Not authed → 401 so the client knows to sign in
  if (!authed) {
    emit('ea_block_401', { path });
    res.setHeader('WWW-Authenticate', 'Bearer realm="StoneCaster API"');
    return res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Sign in required.',
    });
  }

  // Check if role allows access
  const allowed = role === 'early_access' || role === 'admin';

  if (allowed) {
    return next();
  }

  // Log denial (minimal PII - no tokens, only aud, path, reason)
  emit('ea_block_403', {
    path,
    role: role || 'unknown',
    aud: 'auth',
  });

  // Return 403 with EARLY_ACCESS_REQUIRED code
  res.setHeader('x-reason', 'EARLY_ACCESS_REQUIRED');
  return res.status(403).json({
    ok: false,
    code: 'EARLY_ACCESS_REQUIRED',
    message: 'Early access approval required.',
  });
}

