/**
 * Telemetry Admin Routes
 * GET /api/admin/telemetry/summary
 * GET /api/admin/telemetry/timeseries
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { getTelemetrySummary, getTelemetryTimeseries } from '../services/telemetry-read.service.js';

const router = Router();

// Cache for 30 seconds
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30 * 1000;

function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return Promise.resolve(cached.data);
  }
  
  return fetcher().then(data => {
    cache.set(key, { data, expires: Date.now() + CACHE_TTL });
    return data;
  });
}

/**
 * GET /api/admin/telemetry/summary
 * Get aggregated telemetry summary
 */
router.get(
  '/summary',
  authenticateToken,
  requireRole('viewer'),
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  async (req, res) => {
    try {
      const from = req.query.from 
        ? new Date(req.query.from as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
      const to = req.query.to 
        ? new Date(req.query.to as string)
        : new Date();
      const storyId = req.query.storyId as string | undefined;

      const cacheKey = `summary:${from.toISOString()}:${to.toISOString()}:${storyId || 'all'}`;
      
      const summary = await getCached(cacheKey, () => 
        getTelemetrySummary(from, to, storyId)
      );

      res.json({
        ok: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching telemetry summary:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch telemetry summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/admin/telemetry/timeseries
 * Get timeseries data for a metric
 */
router.get(
  '/timeseries',
  authenticateToken,
  requireRole('viewer'),
  rateLimit({ windowMs: 60 * 1000, max: 60 }),
  async (req, res) => {
    try {
      const metric = (req.query.metric as 'tokens_after' | 'latency_ms') || 'tokens_after';
      const bucket = (req.query.bucket as 'hour' | 'day') || 'day';
      const from = req.query.from 
        ? new Date(req.query.from as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const to = req.query.to 
        ? new Date(req.query.to as string)
        : new Date();
      const storyId = req.query.storyId as string | undefined;

      if (!['tokens_after', 'latency_ms'].includes(metric)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid metric. Must be tokens_after or latency_ms',
        });
      }

      if (!['hour', 'day'].includes(bucket)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid bucket. Must be hour or day',
        });
      }

      const cacheKey = `timeseries:${metric}:${bucket}:${from.toISOString()}:${to.toISOString()}:${storyId || 'all'}`;
      
      const timeseries = await getCached(cacheKey, () =>
        getTelemetryTimeseries(metric, bucket, from, to, storyId)
      );

      res.json({
        ok: true,
        data: timeseries,
      });
    } catch (error) {
      console.error('Error fetching telemetry timeseries:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch telemetry timeseries',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;

