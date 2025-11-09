/**
 * Dependency Monitor Background Job
 * Phase 4: Periodic cron job to maintain dependency_invalid flags
 */

import { isDependencyMonitorEnabled } from '../config/featureFlags.js';
import { MONITOR_CRON_MS, tryAcquireLock, releaseLock, cleanupExpiredLocks } from '../config/jobs.js';
import { recomputeDependenciesForAllWorlds } from '../dal/dependencyMonitor.js';

const LOCK_KEY = 'dependency_monitor';
let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Run the dependency monitor job
 * Acquires lock, recomputes dependencies, then releases lock
 */
async function runDependencyMonitor(): Promise<void> {
  if (isRunning) {
    console.log('[dependencyMonitor] Job already running, skipping');
    return;
  }

  if (!isDependencyMonitorEnabled()) {
    console.log('[dependencyMonitor] Feature flag disabled, skipping');
    return;
  }

  isRunning = true;

  try {
    // Clean up expired locks first
    await cleanupExpiredLocks();

    // Try to acquire lock
    const { acquired, holder } = await tryAcquireLock(LOCK_KEY);

    if (!acquired || !holder) {
      console.log('[dependencyMonitor] Lock already held by another instance, skipping');
      return;
    }

    console.log(`[dependencyMonitor] Starting dependency recompute (holder: ${holder})`);

    const startTime = Date.now();
    const result = await recomputeDependenciesForAllWorlds({
      concurrency: 4,
      batch: 1000,
    });

    const duration = Date.now() - startTime;

    console.log(
      `[dependencyMonitor] Completed in ${duration}ms:`,
      `worlds=${result.worldsProcessed},`,
      `stories=${result.storiesUpdated},`,
      `npcs=${result.npcsUpdated}`
    );

    // Release lock
    await releaseLock(LOCK_KEY, holder);
  } catch (error) {
    console.error('[dependencyMonitor] Error running job:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the dependency monitor cron job
 * Only starts if feature flag is enabled
 */
export function startDependencyMonitor(): void {
  if (!isDependencyMonitorEnabled()) {
    console.log('[dependencyMonitor] Feature flag disabled, not starting cron');
    return;
  }

  if (intervalId !== null) {
    console.log('[dependencyMonitor] Already started');
    return;
  }

  console.log(`[dependencyMonitor] Starting cron job (interval: ${MONITOR_CRON_MS}ms)`);

  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    runDependencyMonitor().catch((error) => {
      console.error('[dependencyMonitor] Error in initial run:', error);
    });
  }, 10000); // 10 second delay

  // Then run on schedule
  intervalId = setInterval(() => {
    runDependencyMonitor().catch((error) => {
      console.error('[dependencyMonitor] Error in scheduled run:', error);
    });
  }, MONITOR_CRON_MS);
}

/**
 * Stop the dependency monitor cron job
 */
export function stopDependencyMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[dependencyMonitor] Stopped cron job');
  }
}

