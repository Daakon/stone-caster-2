/**
 * KV Role Cache for Cloudflare Worker
 * Phase B1: Cache user roles in KV with TTL to reduce /api/me calls
 */

export type AppRole = 'pending' | 'early_access' | 'member' | 'admin';

/**
 * Get user role from KV cache
 * @param kv - Cloudflare KV namespace
 * @param userId - User ID (or bearer fingerprint key)
 * @returns Cached role or null if not cached/not found
 */
export async function getRole(kv: KVNamespace, userId: string): Promise<AppRole | null> {
  const cached = await kv.get(`role:${userId}`, 'text');
  if (!cached) return null;
  return cached as AppRole;
}

/**
 * Set user role in KV cache
 * @param kv - Cloudflare KV namespace
 * @param userId - User ID (or bearer fingerprint key)
 * @param role - User role
 * @param ttlSeconds - Time to live in seconds (default: 30)
 */
export async function setRole(
  kv: KVNamespace,
  userId: string,
  role: AppRole,
  ttlSeconds = 30
): Promise<void> {
  await kv.put(`role:${userId}`, role, { expirationTtl: ttlSeconds });
}
