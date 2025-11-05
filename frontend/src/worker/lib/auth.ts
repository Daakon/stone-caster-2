/**
 * Auth Extraction Utility for Cloudflare Worker
 * Phase B1: Extract auth tokens from Authorization header or Supabase cookies
 */

/**
 * Parse cookie header into an object
 */
function parseCookie(req: Request): Record<string, string> {
  const header = req.headers.get('cookie') || '';
  return Object.fromEntries(
    header
      .split(/;\s*/)
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf('=');
        if (i < 0) return [kv, ''];
        return [decodeURIComponent(kv.slice(0, i)), decodeURIComponent(kv.slice(i + 1))];
      })
  );
}

/**
 * Auth context extracted from request
 */
export type AuthContext = {
  bearer?: string; // access token if present
  userId?: string; // optional if /me returns it; may be unknown prefetch
  audience: 'anon' | 'auth'; // for cache separation
};

/**
 * Extract authentication context from request
 * Handles either Authorization: Bearer <token> or Supabase cookies (sb-access-token / sb-auth-token)
 * Falls back to "anonymous" if none present
 */
export function extractAuth(req: Request): AuthContext {
  const h = req.headers.get('authorization');
  if (h?.toLowerCase().startsWith('bearer ')) {
    return { bearer: h.slice(7).trim(), audience: 'auth' };
  }

  const cookies = parseCookie(req);
  const token = cookies['sb-access-token'] || cookies['sb-auth-token'];
  if (token) {
    return { bearer: token, audience: 'auth' };
  }

  return { audience: 'anon' };
}

