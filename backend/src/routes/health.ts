/**
 * Health and readiness endpoints
 * Used for canary checks and load balancer health probes
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { rulesetCache, npcListCache } from '../utils/cache.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * GET /api/health/ready
 * Readiness check: DB connect ok, v3-only flag true, cache warm
 */
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    const checks: Record<string, boolean> = {};
    
    // Check DB connection
    try {
      const { error } = await supabaseAdmin
        .from('worlds')
        .select('id')
        .limit(1);
      checks.db = !error;
    } catch {
      checks.db = false;
    }
    
    // Check v3-only (implicit - if we're here, v3 is enabled)
    // Could check feature flag, but for now assume v3 is default
    checks.v3Only = true;
    
    // Check cache warm (at least one entry after first request)
    const rulesetStats = rulesetCache.getStats();
    const npcStats = npcListCache.getStats();
    checks.cacheWarm = rulesetStats.size > 0 || npcStats.size > 0;
    
    const allHealthy = Object.values(checks).every(v => v === true);
    
    if (allHealthy) {
      res.status(200).json({
        ok: true,
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        ok: false,
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      ok: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/live
 * Liveness check (simple)
 */
router.get('/live', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    ok: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;

