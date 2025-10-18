// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// API routes for autoplay system

import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { FuzzRunner } from '../autoplay/fuzz-runner.js';
import { ScenarioMatrixGenerator } from '../autoplay/fuzz-runner.js';
import { BaselineManager } from '../autoplay/baselines.js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize services
const fuzzRunner = new FuzzRunner(supabase);
const matrixGenerator = new ScenarioMatrixGenerator(supabase);
const baselineManager = new BaselineManager(supabase);

// Request schemas
const MatrixRunSchema = z.object({
  worlds: z.array(z.string()),
  adventures: z.array(z.string()),
  locales: z.array(z.string()),
  experiments: z.array(z.string()).optional(),
  variations: z.array(z.string()).optional(),
  module_toggles: z.record(z.array(z.boolean())).optional(),
  seeds_per_scenario: z.number().min(1).max(50),
  max_turns: z.number().min(10).max(200),
  timeout_ms: z.number().min(60000).max(3600000),
  parallel_shards: z.number().min(1).max(20),
  bot_modes: z.array(z.enum(['objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max']))
});

const BaselineSaveSchema = z.object({
  key: z.string(),
  metrics: z.object({
    coverage: z.object({
      quest_graph: z.number(),
      dialogue: z.number(),
      mechanics: z.number(),
      economy: z.number(),
      world_sim: z.number(),
      mods: z.number(),
      overall: z.number()
    }),
    performance: z.object({
      avg_turn_latency_ms: z.number(),
      p95_turn_latency_ms: z.number(),
      avg_tokens_per_turn: z.number(),
      max_tokens_per_turn: z.number(),
      turns_per_second: z.number()
    }),
    oracles: z.object({
      soft_locks: z.number(),
      budget_violations: z.number(),
      validator_retries: z.number(),
      fallback_engagements: z.number(),
      safety_violations: z.number(),
      performance_violations: z.number(),
      integrity_violations: z.number()
    }),
    behavior: z.object({
      avg_turns_to_completion: z.number(),
      exploration_efficiency: z.number(),
      dialogue_engagement_rate: z.number(),
      economic_activity_rate: z.number(),
      risk_taking_rate: z.number()
    })
  })
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
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to verify admin access' }
    });
  }
};

/**
 * POST /api/admin/autoplay/run-matrix
 * Start a matrix run with the given configuration
 */
router.post('/run-matrix', requireAdmin, async (req, res) => {
  try {
    const config = MatrixRunSchema.parse(req.body);
    
    // Generate scenario matrix
    const scenarios = await matrixGenerator.generateMatrix({
      worlds: config.worlds,
      adventures: config.adventures,
      locales: config.locales,
      experiments: config.experiments,
      variations: config.variations,
      module_toggles: config.module_toggles,
      seeds_per_scenario: config.seeds_per_scenario
    });

    // Create run configuration
    const runConfig = {
      scenarios,
      parallel_shards: config.parallel_shards,
      max_concurrent: Math.min(config.parallel_shards, 3),
      artifact_output: true,
      resume_from_checkpoint: true
    };

    // Start matrix run
    const results = await fuzzRunner.runMatrix(runConfig);

    res.json({
      ok: true,
      data: {
        run_id: `matrix-${Date.now()}`,
        scenarios_count: scenarios.length,
        results_count: results.length,
        results
      }
    });

  } catch (error) {
    console.error('Matrix run error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'MATRIX_RUN_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/admin/autoplay/runs
 * Get all autoplay runs
 */
router.get('/runs', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('autoplay_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get runs error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'GET_RUNS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/admin/autoplay/runs/:runId
 * Get specific run details
 */
router.get('/runs/:runId', requireAdmin, async (req, res) => {
  try {
    const { runId } = req.params;

    const { data, error } = await supabase
      .from('autoplay_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: { code: 'RUN_NOT_FOUND', message: 'Run not found' }
      });
    }

    // Get artifacts for this run
    const { data: artifacts } = await supabase
      .from('autoplay_artifacts')
      .select('*')
      .eq('run_id', runId);

    res.json({
      ok: true,
      data: {
        ...data,
        artifacts: artifacts || []
      }
    });

  } catch (error) {
    console.error('Get run error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'GET_RUN_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/admin/autoplay/runs/:runId/stop
 * Stop a running autoplay run
 */
router.post('/runs/:runId/stop', requireAdmin, async (req, res) => {
  try {
    const { runId } = req.params;

    // Update run status to cancelled
    const { error } = await supabase
      .from('autoplay_runs')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString()
      })
      .eq('id', runId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      ok: true,
      data: { message: 'Run stopped successfully' }
    });

  } catch (error) {
    console.error('Stop run error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'STOP_RUN_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/admin/autoplay/runs/:runId/compare-baseline
 * Compare run results with baseline
 */
router.post('/runs/:runId/compare-baseline', requireAdmin, async (req, res) => {
  try {
    const { runId } = req.params;
    const { baseline_key } = req.body;

    // Get run data
    const { data: runData, error: runError } = await supabase
      .from('autoplay_runs')
      .select('metrics')
      .eq('id', runId)
      .single();

    if (runError || !runData) {
      throw new Error('Run not found');
    }

    // Compare with baseline
    const comparison = await baselineManager.compareWithBaseline(
      baseline_key || 'default',
      runData.metrics
    );

    res.json({
      ok: true,
      data: comparison
    });

  } catch (error) {
    console.error('Compare baseline error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'COMPARE_BASELINE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/admin/autoplay/artifacts/:runId/:artifactPath
 * Download artifact file
 */
router.get('/artifacts/:runId/:artifactPath', requireAdmin, async (req, res) => {
  try {
    const { runId, artifactPath } = req.params;

    // Get artifact info
    const { data: artifact, error } = await supabase
      .from('autoplay_artifacts')
      .select('*')
      .eq('run_id', runId)
      .eq('path', artifactPath)
      .single();

    if (error || !artifact) {
      return res.status(404).json({
        ok: false,
        error: { code: 'ARTIFACT_NOT_FOUND', message: 'Artifact not found' }
      });
    }

    // In a real implementation, you would stream the file from storage
    // For now, return a placeholder response
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${artifactPath.split('/').pop()}"`);
    res.send('Artifact content would be streamed here');

  } catch (error) {
    console.error('Download artifact error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'DOWNLOAD_ARTIFACT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/admin/autoplay/baselines
 * Save a new baseline
 */
router.post('/baselines', requireAdmin, async (req, res) => {
  try {
    const data = BaselineSaveSchema.parse(req.body);
    
    const result = await baselineManager.saveBaseline(data.key, data.metrics);

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      ok: true,
      data: { message: 'Baseline saved successfully' }
    });

  } catch (error) {
    console.error('Save baseline error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'SAVE_BASELINE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/admin/autoplay/baselines
 * List all baselines
 */
router.get('/baselines', requireAdmin, async (req, res) => {
  try {
    const result = await baselineManager.listBaselines();

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      ok: true,
      data: result.data || []
    });

  } catch (error) {
    console.error('List baselines error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'LIST_BASELINES_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * DELETE /api/admin/autoplay/baselines/:key
 * Delete a baseline
 */
router.delete('/baselines/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await baselineManager.deleteBaseline(key);

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      ok: true,
      data: { message: 'Baseline deleted successfully' }
    });

  } catch (error) {
    console.error('Delete baseline error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'DELETE_BASELINE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/admin/autoplay/status
 * Get autoplay system status
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    // Get recent runs count
    const { count: recentRuns } = await supabase
      .from('autoplay_runs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Get baselines count
    const { count: baselinesCount } = await supabase
      .from('autoplay_baselines')
      .select('*', { count: 'exact', head: true });

    // Get artifacts count
    const { count: artifactsCount } = await supabase
      .from('autoplay_artifacts')
      .select('*', { count: 'exact', head: true });

    res.json({
      ok: true,
      data: {
        recent_runs: recentRuns || 0,
        baselines: baselinesCount || 0,
        artifacts: artifactsCount || 0,
        system_status: 'operational'
      }
    });

  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'GET_STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export default router;
