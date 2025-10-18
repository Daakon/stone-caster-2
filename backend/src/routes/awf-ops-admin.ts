// Phase 25: Operations Admin API
// Admin endpoints for rate limits, quotas, circuits, backpressure, and budget controls

import { Router } from 'express';
import { z } from 'zod';
import { rateLimiter } from '../ops/rate-limit';
import { quotaManager } from '../ops/quotas';
import { backpressureManager } from '../ops/backpressure';
import { CircuitBreaker } from '../ops/circuit';
import { budgetGuard } from '../ops/budget-guard';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request schemas
const RateLimitUpdateSchema = z.object({
  scope: z.enum(['user', 'session', 'device', 'ip', 'global']),
  window_seconds: z.number().min(1),
  max_requests: z.number().min(1),
  burst_limit: z.number().min(0).optional(),
});

const QuotaUpdateSchema = z.object({
  user_hash: z.string().optional(),
  session_id: z.string().optional(),
  daily_turn_cap: z.number().min(1).optional(),
  tool_cap: z.number().min(1).optional(),
  bytes_cap: z.number().min(1).optional(),
});

const FeatureToggleSchema = z.object({
  feature_name: z.string(),
  enabled: z.boolean(),
  rollout_percentage: z.number().min(0).max(100).optional(),
  conditions: z.record(z.any()).optional(),
});

const IncidentResolveSchema = z.object({
  resolution_notes: z.string(),
});

/**
 * GET /ops/status
 * Get overall operations status
 */
router.get('/status', async (req, res) => {
  try {
    // Get rate limit stats
    const rateLimitStats = await rateLimiter.getRateLimitStats();
    
    // Get quota stats
    const quotaStats = await quotaManager.getQuotaStats();
    
    // Get backpressure state
    const backpressureState = await backpressureManager.getBackpressureState();
    
    // Get circuit breaker stats
    const circuitStats = await CircuitBreaker.getInstance('model_provider').getStats();
    
    // Get budget stats
    const budgetStats = await budgetGuard.getBudgetStats();
    
    // Get active incidents
    const { data: incidents, error: incidentError } = await supabase
      .from('awf_incidents')
      .select('*')
      .eq('status', 'open')
      .order('timestamp', { ascending: false });

    if (incidentError) throw incidentError;

    const response = {
      success: true,
      data: {
        rate_limits: {
          total_limits: rateLimitStats.total_limits,
          by_scope: rateLimitStats.by_scope,
          top_limited: rateLimitStats.top_limited,
        },
        quotas: {
          total_quotas: quotaStats.total_quotas,
          by_type: quotaStats.by_type,
          top_users: quotaStats.top_users,
        },
        backpressure: {
          active_metrics: backpressureState.filter(s => s.is_active).length,
          total_actions: backpressureState.reduce((sum, s) => sum + s.actions_taken.length, 0),
        },
        circuit_breakers: {
          total_circuits: circuitStats.total_circuits,
          by_state: circuitStats.by_state,
          top_failures: circuitStats.top_failures,
        },
        budget: {
          current_month: budgetStats.current_month,
          budget_usd: budgetStats.budget_usd,
          spent_usd: budgetStats.spent_usd,
          remaining_usd: budgetStats.remaining_usd,
          spend_ratio: budgetStats.spend_ratio,
          status: budgetStats.status,
        },
        incidents: {
          total: incidents?.length || 0,
          by_severity: {
            low: incidents?.filter(i => i.severity === 'low').length || 0,
            medium: incidents?.filter(i => i.severity === 'medium').length || 0,
            high: incidents?.filter(i => i.severity === 'high').length || 0,
            critical: incidents?.filter(i => i.severity === 'critical').length || 0,
          },
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to get ops status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operations status',
    });
  }
});

/**
 * POST /ops/limits
 * Update rate limits and quotas
 */
router.post('/limits', async (req, res) => {
  try {
    const { rate_limits, quotas } = req.body;

    // Update rate limits
    if (rate_limits) {
      for (const limit of rate_limits) {
        const validated = RateLimitUpdateSchema.parse(limit);
        await rateLimiter.updateRateLimitConfig(
          validated.scope,
          {
            window_seconds: validated.window_seconds,
            max_requests: validated.max_requests,
            burst_limit: validated.burst_limit,
          }
        );
      }
    }

    // Update quotas
    if (quotas) {
      for (const quota of quotas) {
        const validated = QuotaUpdateSchema.parse(quota);
        await quotaManager.setQuota(
          validated.user_hash || null,
          validated.session_id || null,
          {
            daily_turn_cap: validated.daily_turn_cap,
            tool_cap: validated.tool_cap,
            bytes_cap: validated.bytes_cap,
          }
        );
      }
    }

    res.json({
      success: true,
      message: 'Rate limits and quotas updated successfully',
    });
  } catch (error) {
    console.error('Failed to update limits:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update rate limits and quotas',
    });
  }
});

/**
 * POST /ops/toggles
 * Update feature toggles and model settings
 */
router.post('/toggles', async (req, res) => {
  try {
    const { toggles, model_downgrade } = req.body;

    // Update feature toggles
    if (toggles) {
      for (const toggle of toggles) {
        const validated = FeatureToggleSchema.parse(toggle);
        
        await supabase
          .from('awf_feature_toggles')
          .upsert({
            feature_name: validated.feature_name,
            enabled: validated.enabled,
            rollout_percentage: validated.rollout_percentage || 100,
            conditions: validated.conditions || {},
            updated_at: new Date().toISOString(),
          });
      }
    }

    // Handle model downgrade
    if (model_downgrade) {
      const { enabled, target_model } = model_downgrade;
      
      await supabase
        .from('awf_feature_toggles')
        .upsert({
          feature_name: 'model_downgrade',
          enabled,
          conditions: {
            target_model: target_model || 'gpt-4o-mini',
            budget_pressure: true,
          },
          updated_at: new Date().toISOString(),
        });
    }

    res.json({
      success: true,
      message: 'Feature toggles updated successfully',
    });
  } catch (error) {
    console.error('Failed to update toggles:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to update feature toggles',
    });
  }
});

/**
 * POST /ops/rotate-keys
 * Rotate secrets and keys
 */
router.post('/rotate-keys', async (req, res) => {
  try {
    const { secret_names } = req.body;
    
    if (!secret_names || !Array.isArray(secret_names)) {
      return res.status(400).json({
        success: false,
        error: 'secret_names array is required',
      });
    }

    const results = [];
    
    for (const secretName of secret_names) {
      try {
        // Generate new key/secret
        const newKey = generateSecret();
        const timestamp = new Date().toISOString();
        
        // Store in secrets rotation table
        await supabase
          .from('awf_secrets_rotation')
          .insert({
            secret_name: secretName,
            current_version: newKey,
            rotated_at: timestamp,
            next_rotation: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            status: 'active',
          });

        // Update environment variable (in production, this would update a secrets store)
        process.env[secretName] = newKey;
        
        results.push({
          secret_name: secretName,
          status: 'rotated',
          rotated_at: timestamp,
        });
      } catch (error) {
        results.push({
          secret_name: secretName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      message: 'Key rotation completed',
      results,
    });
  } catch (error) {
    console.error('Failed to rotate keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate keys',
    });
  }
});

/**
 * GET /ops/incidents
 * List and filter incidents
 */
router.get('/incidents', async (req, res) => {
  try {
    const { 
      severity, 
      scope, 
      status, 
      from, 
      to, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let query = supabase.from('awf_incidents').select('*');

    if (severity) {
      query = query.eq('severity', severity);
    }
    if (scope) {
      query = query.eq('scope', scope);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (from) {
      query = query.gte('timestamp', from);
    }
    if (to) {
      query = query.lte('timestamp', to);
    }

    const { data: incidents, error } = await query
      .order('timestamp', { ascending: false })
      .range(offset as number, (offset as number) + (limit as number) - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: incidents,
      pagination: {
        limit: limit as number,
        offset: offset as number,
        total: incidents?.length || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get incidents',
    });
  }
});

/**
 * POST /ops/incidents/:id/resolve
 * Resolve incident
 */
router.post('/incidents/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = IncidentResolveSchema.parse(req.body);

    const { error } = await supabase
      .from('awf_incidents')
      .update({
        status: 'resolved',
        resolution_notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Incident resolved successfully',
    });
  } catch (error) {
    console.error('Failed to resolve incident:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to resolve incident',
    });
  }
});

/**
 * GET /ops/budget
 * Get budget information and projections
 */
router.get('/budget', async (req, res) => {
  try {
    const budgetStats = await budgetGuard.getBudgetStats();
    const config = budgetGuard.getConfig();

    res.json({
      success: true,
      data: {
        current: budgetStats,
        config: {
          monthly_budget_usd: config.monthly_budget_usd,
          model_downgrade_threshold: config.model_downgrade_threshold,
          hard_stop_threshold: config.hard_stop_threshold,
          model_downgrade_allowed: config.model_downgrade_allowed,
        },
        projections: {
          end_of_month_spend: budgetStats.projected_spend,
          days_remaining: budgetStats.days_remaining,
          daily_average: budgetStats.daily_average,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get budget info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get budget information',
    });
  }
});

/**
 * POST /ops/budget/record-spending
 * Record spending for budget tracking
 */
router.post('/budget/record-spending', async (req, res) => {
  try {
    const { amount, category, metadata } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      });
    }

    const success = await budgetGuard.recordSpending(
      amount,
      category || 'unknown',
      metadata
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to record spending',
      });
    }

    res.json({
      success: true,
      message: 'Spending recorded successfully',
    });
  } catch (error) {
    console.error('Failed to record spending:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record spending',
    });
  }
});

/**
 * GET /ops/health
 * Get health check results
 */
router.get('/health', async (req, res) => {
  try {
    const { data: healthChecks, error } = await supabase
      .from('awf_health_checks')
      .select('*')
      .gte('checked_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('checked_at', { ascending: false });

    if (error) throw error;

    const healthStatus = {
      overall: 'healthy',
      services: {} as Record<string, any>,
    };

    for (const check of healthChecks || []) {
      healthStatus.services[check.service_name] = {
        status: check.status,
        response_time_ms: check.response_time_ms,
        last_checked: check.checked_at,
        error_message: check.error_message,
      };

      if (check.status === 'unhealthy') {
        healthStatus.overall = 'unhealthy';
      } else if (check.status === 'degraded' && healthStatus.overall === 'healthy') {
        healthStatus.overall = 'degraded';
      }
    }

    res.json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    console.error('Failed to get health status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health status',
    });
  }
});

// Helper function to generate secrets
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
