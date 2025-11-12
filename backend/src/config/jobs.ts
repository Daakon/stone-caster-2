/**
 * Background Job Configuration
 * Phase 4: Configuration for dependency monitoring and other background jobs
 */

/**
 * Dependency monitor cron interval in milliseconds
 * Default: 5 minutes (300000ms)
 */
export const MONITOR_CRON_MS = Number.parseInt(
  process.env.MONITOR_CRON_MS ?? '300000',
  10
);

/**
 * Job lock TTL in milliseconds
 * Default: 10 minutes (600000ms)
 */
export const JOB_LOCK_TTL_MS = Number.parseInt(
  process.env.JOB_LOCK_TTL_MS ?? '600000',
  10
);

/**
 * Try to acquire a distributed lock
 * Returns true if lock was acquired, false if already held
 */
export async function tryAcquireLock(
  key: string,
  ttlMs: number = JOB_LOCK_TTL_MS
): Promise<{ acquired: boolean; holder?: string }> {
  const { supabaseAdmin } = await import('../services/supabase.js');
  const holder = `${process.pid}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    // Try to insert lock (will fail if key already exists)
    const { error } = await supabaseAdmin
      .from('job_locks')
      .insert({
        key,
        holder,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      // Check if lock exists and is expired
      const { data: existingLock } = await supabaseAdmin
        .from('job_locks')
        .select('expires_at')
        .eq('key', key)
        .single();

      if (existingLock) {
        const expiresAt = new Date(existingLock.expires_at);
        if (expiresAt < new Date()) {
          // Lock expired, try to update it
          const { error: updateError } = await supabaseAdmin
            .from('job_locks')
            .update({
              holder,
              expires_at: expiresAt.toISOString(),
            })
            .eq('key', key)
            .lt('expires_at', new Date().toISOString());

          if (!updateError) {
            return { acquired: true, holder };
          }
        }
      }

      return { acquired: false };
    }

    return { acquired: true, holder };
  } catch (error) {
    console.error(`[jobs] Error acquiring lock ${key}:`, error);
    return { acquired: false };
  }
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string, holder: string): Promise<void> {
  const { supabaseAdmin } = await import('../services/supabase.js');

  try {
    await supabaseAdmin
      .from('job_locks')
      .delete()
      .eq('key', key)
      .eq('holder', holder);
  } catch (error) {
    console.error(`[jobs] Error releasing lock ${key}:`, error);
  }
}

/**
 * Clean up expired locks (best-effort maintenance)
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const { supabaseAdmin } = await import('../services/supabase.js');

  try {
    const { count, error } = await supabaseAdmin
      .from('job_locks')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[jobs] Error cleaning up expired locks:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[jobs] Error cleaning up expired locks:', error);
    return 0;
  }
}

