/**
 * AWF Experiments Admin Routes
 * CRUD operations for experiments and reporting
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const ExperimentSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  status: z.enum(['draft', 'running', 'stopped']),
  startAt: z.string().optional(),
  stopAt: z.string().optional(),
  hashBasis: z.enum(['session', 'player']),
  allocations: z.array(z.object({
    variation: z.string(),
    percent: z.number().min(0).max(100),
  })),
  guardrails: z.record(z.any()),
});

const ExperimentVariationSchema = z.object({
  experimentKey: z.string(),
  variationKey: z.string(),
  params: z.record(z.any()),
});

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', req.user?.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/awf/experiments
 * List all experiments
 */
router.get('/experiments', async (req, res) => {
  try {
    const { data: experiments, error } = await supabase
      .from('experiments')
      .select(`
        *,
        experiment_variations (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch experiments' });
    }

    res.json({ experiments });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/experiments
 * Create a new experiment
 */
router.post('/experiments', async (req, res) => {
  try {
    const experimentData = ExperimentSchema.parse(req.body);

    // Validate allocations sum to 100
    const totalPercent = experimentData.allocations.reduce((sum, alloc) => sum + alloc.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      return res.status(400).json({ error: 'Allocations must sum to 100%' });
    }

    const { data: experiment, error } = await supabase
      .from('experiments')
      .insert(experimentData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create experiment' });
    }

    res.json({ experiment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid experiment data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/awf/experiments/:key
 * Update an experiment
 */
router.put('/experiments/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const experimentData = ExperimentSchema.parse(req.body);

    // Validate allocations sum to 100
    const totalPercent = experimentData.allocations.reduce((sum, alloc) => sum + alloc.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      return res.status(400).json({ error: 'Allocations must sum to 100%' });
    }

    const { data: experiment, error } = await supabase
      .from('experiments')
      .update(experimentData)
      .eq('key', key)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update experiment' });
    }

    res.json({ experiment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid experiment data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/awf/experiments/:key
 * Delete an experiment
 */
router.delete('/experiments/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('key', key);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete experiment' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/experiments/:key/start
 * Start an experiment
 */
router.post('/experiments/:key/start', async (req, res) => {
  try {
    const { key } = req.params;

    const { data: experiment, error } = await supabase
      .from('experiments')
      .update({ 
        status: 'running',
        start_at: new Date().toISOString(),
        stop_at: null
      })
      .eq('key', key)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to start experiment' });
    }

    res.json({ experiment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/experiments/:key/stop
 * Stop an experiment
 */
router.post('/experiments/:key/stop', async (req, res) => {
  try {
    const { key } = req.params;

    const { data: experiment, error } = await supabase
      .from('experiments')
      .update({ 
        status: 'stopped',
        stop_at: new Date().toISOString()
      })
      .eq('key', key)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to stop experiment' });
    }

    res.json({ experiment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/experiments/:key/variations
 * Get variations for an experiment
 */
router.get('/experiments/:key/variations', async (req, res) => {
  try {
    const { key } = req.params;

    const { data: variations, error } = await supabase
      .from('experiment_variations')
      .select('*')
      .eq('experiment_key', key);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch variations' });
    }

    res.json({ variations });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/experiments/:key/variations
 * Create a variation for an experiment
 */
router.post('/experiments/:key/variations', async (req, res) => {
  try {
    const { key } = req.params;
    const variationData = ExperimentVariationSchema.parse({
      ...req.body,
      experimentKey: key,
    });

    const { data: variation, error } = await supabase
      .from('experiment_variations')
      .insert(variationData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create variation' });
    }

    res.json({ variation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid variation data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/awf/experiments/:key/variations/:variationKey
 * Update a variation
 */
router.put('/experiments/:key/variations/:variationKey', async (req, res) => {
  try {
    const { key, variationKey } = req.params;
    const variationData = ExperimentVariationSchema.parse({
      ...req.body,
      experimentKey: key,
      variationKey,
    });

    const { data: variation, error } = await supabase
      .from('experiment_variations')
      .update(variationData)
      .eq('experiment_key', key)
      .eq('variation_key', variationKey)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update variation' });
    }

    res.json({ variation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid variation data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/awf/experiments/:key/variations/:variationKey
 * Delete a variation
 */
router.delete('/experiments/:key/variations/:variationKey', async (req, res) => {
  try {
    const { key, variationKey } = req.params;

    const { error } = await supabase
      .from('experiment_variations')
      .delete()
      .eq('experiment_key', key)
      .eq('variation_key', variationKey);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete variation' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/experiments/:key/report
 * Get experiment report
 */
router.get('/experiments/:key/report', async (req, res) => {
  try {
    const { key } = req.params;
    const { from, to, format = 'json' } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }

    // Build analytics query
    let query = supabase
      .from('analytics_events')
      .select('*')
      .eq('experiment_key', key)
      .gte('ts', from)
      .lte('ts', to);

    const { data: events, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch analytics data' });
    }

    // Aggregate metrics by variation and locale
    const aggregated = aggregateMetrics(events || []);

    if (format === 'csv') {
      const csv = generateCSV(aggregated);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="experiment-${key}-report.csv"`);
      res.send(csv);
    } else {
      res.json({ 
        experimentKey: key,
        dateRange: { from, to },
        aggregated 
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Aggregate metrics by variation and locale
 */
function aggregateMetrics(events: any[]) {
  const byVariation: Record<string, any> = {};
  const byLocale: Record<string, any> = {};

  for (const event of events) {
    const { variation_key, locale, metrics } = event;

    // Aggregate by variation
    if (variation_key) {
      if (!byVariation[variation_key]) {
        byVariation[variation_key] = {
          variation: variation_key,
          totalEvents: 0,
          avgLatency: 0,
          avgTokens: 0,
          totalRetries: 0,
          totalFallbacks: 0,
          avgActs: 0,
          avgChoices: 0,
        };
      }

      const agg = byVariation[variation_key];
      agg.totalEvents++;
      agg.avgLatency = (agg.avgLatency * (agg.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / agg.totalEvents;
      agg.avgTokens = (agg.avgTokens * (agg.totalEvents - 1) + (metrics.outputTokens || 0)) / agg.totalEvents;
      agg.totalRetries += metrics.retries || 0;
      agg.totalFallbacks += metrics.fallbacks || 0;
      agg.avgActs = (agg.avgActs * (agg.totalEvents - 1) + (metrics.actsCount || 0)) / agg.totalEvents;
      agg.avgChoices = (agg.avgChoices * (agg.totalEvents - 1) + (metrics.choicesCount || 0)) / agg.totalEvents;
    }

    // Aggregate by locale
    if (locale) {
      if (!byLocale[locale]) {
        byLocale[locale] = {
          locale,
          totalEvents: 0,
          avgLatency: 0,
          avgTokens: 0,
        };
      }

      const agg = byLocale[locale];
      agg.totalEvents++;
      agg.avgLatency = (agg.avgLatency * (agg.totalEvents - 1) + (metrics.turnLatencyMs || 0)) / agg.totalEvents;
      agg.avgTokens = (agg.avgTokens * (agg.totalEvents - 1) + (metrics.outputTokens || 0)) / agg.totalEvents;
    }
  }

  return {
    byVariation: Object.values(byVariation),
    byLocale: Object.values(byLocale),
  };
}

/**
 * Generate CSV from aggregated data
 */
function generateCSV(aggregated: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Type,Key,Total Events,Avg Latency,Avg Tokens,Total Retries,Total Fallbacks,Avg Acts,Avg Choices');
  
  // Variations
  for (const item of aggregated.byVariation) {
    lines.push([
      'variation',
      item.variation,
      item.totalEvents,
      item.avgLatency.toFixed(2),
      item.avgTokens.toFixed(2),
      item.totalRetries,
      item.totalFallbacks,
      item.avgActs.toFixed(2),
      item.avgChoices.toFixed(2),
    ].join(','));
  }
  
  // Locales
  for (const item of aggregated.byLocale) {
    lines.push([
      'locale',
      item.locale,
      item.totalEvents,
      item.avgLatency.toFixed(2),
      item.avgTokens.toFixed(2),
      '',
      '',
      '',
      '',
    ].join(','));
  }
  
  return lines.join('\n');
}

export default router;


