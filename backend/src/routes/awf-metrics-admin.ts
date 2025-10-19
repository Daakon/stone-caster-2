// Phase 24: Metrics Admin API
// Balance queries API with filters, pagination, and exports

import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request schemas
const MetricsOverviewQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  world: z.string().optional(),
  adventure: z.string().optional(),
  locale: z.string().optional(),
  model: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  granularity: z.enum(['hour', 'day']).default('day'),
});

const KPIsQuerySchema = z.object({
  scope: z.enum(['global', 'world', 'adventure', 'variation']),
  ref: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const FunnelQuerySchema = z.object({
  adventure: z.string().optional(),
  world: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const ExperimentQuerySchema = z.object({
  experiment: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const TimeSeriesQuerySchema = z.object({
  measure: z.string(),
  granularity: z.enum(['hour', 'day']).default('day'),
  from: z.string().optional(),
  to: z.string().optional(),
  world: z.string().optional(),
  adventure: z.string().optional(),
  locale: z.string().optional(),
  model: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
});

// Response schemas
const MetricsOverviewResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    total_sessions: z.number(),
    total_turns: z.number(),
    avg_latency_p95: z.number(),
    retry_rate: z.number(),
    fallback_rate: z.number(),
    stuck_rate: z.number(),
    incidents_count: z.number(),
    trends: z.object({
      sessions: z.array(z.object({
        date: z.string(),
        value: z.number(),
      })),
      latency: z.array(z.object({
        date: z.string(),
        value: z.number(),
      })),
      retry_rate: z.array(z.object({
        date: z.string(),
        value: z.number(),
      })),
    }),
  }),
});

const KPIsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    completion_rate: z.number(),
    stuck_rate: z.number(),
    economy_velocity: z.number(),
    craft_success_rate: z.number(),
    vendor_trade_rate: z.number(),
    party_recruits_rate: z.number(),
    dialogue_diversity: z.number(),
    romance_consent_rate: z.number(),
    event_trigger_rate: z.number(),
  }),
});

const FunnelResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    adventure: z.string(),
    start_count: z.number(),
    first_choice_count: z.number(),
    first_npc_join_count: z.number(),
    first_craft_count: z.number(),
    first_vendor_count: z.number(),
    first_boss_count: z.number(),
    completion_count: z.number(),
    conversion_rates: z.object({
      start_to_choice: z.number(),
      choice_to_npc: z.number(),
      npc_to_craft: z.number(),
      craft_to_vendor: z.number(),
      vendor_to_boss: z.number(),
      boss_to_completion: z.number(),
      overall_completion: z.number(),
    }),
  }),
});

const ExperimentResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    experiment: z.string(),
    variations: z.array(z.object({
      variation: z.string(),
      sessions: z.number(),
      completion_rate: z.number(),
      avg_latency: z.number(),
      retry_rate: z.number(),
      stuck_rate: z.number(),
      economy_velocity: z.number(),
      significance: z.object({
        completion_rate: z.boolean(),
        latency: z.boolean(),
        retry_rate: z.boolean(),
      }),
    })),
    overall_stats: z.object({
      total_sessions: z.number(),
      avg_completion_rate: z.number(),
      avg_latency: z.number(),
      avg_retry_rate: z.number(),
    }),
  }),
});

const TimeSeriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    timestamp: z.string(),
    value: z.number(),
    metadata: z.record(z.any()).optional(),
  })),
});

/**
 * GET /metrics/overview
 * Get overview metrics with trends
 */
router.get('/overview', async (req, res) => {
  try {
    const query = MetricsOverviewQuerySchema.parse(req.query);
    
    // Build base query
    let rollupQuery = supabase.from('awf_rollup_daily').select('*');
    
    // Apply filters
    if (query.from) {
      rollupQuery = rollupQuery.gte('date', query.from);
    }
    if (query.to) {
      rollupQuery = rollupQuery.lte('date', query.to);
    }
    if (query.world) {
      rollupQuery = rollupQuery.eq('world', query.world);
    }
    if (query.adventure) {
      rollupQuery = rollupQuery.eq('adventure', query.adventure);
    }
    if (query.locale) {
      rollupQuery = rollupQuery.eq('locale', query.locale);
    }
    if (query.model) {
      rollupQuery = rollupQuery.eq('model', query.model);
    }
    if (query.experiment) {
      rollupQuery = rollupQuery.eq('experiment', query.experiment);
    }
    if (query.variation) {
      rollupQuery = rollupQuery.eq('variation', query.variation);
    }
    
    const { data: rollupData, error } = await rollupQuery.order('date', { ascending: true });
    if (error) throw error;
    
    // Get incident count
    const { data: incidents, error: incidentError } = await supabase
      .from('awf_incidents')
      .select('id')
      .eq('status', 'new');
    if (incidentError) throw incidentError;
    
    // Calculate overview metrics
    const totalSessions = rollupData?.reduce((sum, d) => sum + (d.sessions || 0), 0) || 0;
    const totalTurns = rollupData?.reduce((sum, d) => sum + (d.turns || 0), 0) || 0;
    const avgLatencyP95 = rollupData?.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.p95_latency_ms || 0), 0) / rollupData.length 
      : 0;
    const retryRate = rollupData?.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.retry_rate || 0), 0) / rollupData.length 
      : 0;
    const fallbackRate = rollupData?.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.fallback_rate || 0), 0) / rollupData.length 
      : 0;
    const stuckRate = rollupData?.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.stuck_rate || 0), 0) / rollupData.length 
      : 0;
    
    // Build trends
    const trends = {
      sessions: rollupData?.map(d => ({
        date: d.date,
        value: d.sessions || 0,
      })) || [],
      latency: rollupData?.map(d => ({
        date: d.date,
        value: d.p95_latency_ms || 0,
      })) || [],
      retry_rate: rollupData?.map(d => ({
        date: d.date,
        value: d.retry_rate || 0,
      })) || [],
    };
    
    const response = MetricsOverviewResponseSchema.parse({
      success: true,
      data: {
        total_sessions: totalSessions,
        total_turns: totalTurns,
        avg_latency_p95: Math.round(avgLatencyP95),
        retry_rate: Math.round(retryRate * 10000) / 10000,
        fallback_rate: Math.round(fallbackRate * 10000) / 10000,
        stuck_rate: Math.round(stuckRate * 10000) / 10000,
        incidents_count: incidents?.length || 0,
        trends,
      },
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('Overview metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview metrics',
    });
  }
});

/**
 * GET /metrics/kpis
 * Get KPI metrics for specific scope
 */
router.get('/kpis', async (req, res) => {
  try {
    const query = KPIsQuerySchema.parse(req.query);
    
    // Build query based on scope
    let rollupQuery = supabase.from('awf_rollup_daily').select('*');
    
    if (query.scope === 'world' && query.ref) {
      rollupQuery = rollupQuery.eq('world', query.ref);
    } else if (query.scope === 'adventure' && query.ref) {
      rollupQuery = rollupQuery.eq('adventure', query.ref);
    } else if (query.scope === 'variation' && query.ref) {
      rollupQuery = rollupQuery.eq('variation', query.ref);
    }
    
    if (query.from) {
      rollupQuery = rollupQuery.gte('date', query.from);
    }
    if (query.to) {
      rollupQuery = rollupQuery.lte('date', query.to);
    }
    
    const { data: rollupData, error } = await rollupQuery;
    if (error) throw error;
    
    if (!rollupData || rollupData.length === 0) {
      return res.json({
        success: true,
        data: {
          completion_rate: 0,
          stuck_rate: 0,
          economy_velocity: 0,
          craft_success_rate: 0,
          vendor_trade_rate: 0,
          party_recruits_rate: 0,
          dialogue_diversity: 0,
          romance_consent_rate: 0,
          event_trigger_rate: 0,
        },
      });
    }
    
    // Calculate KPIs
    const completionRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.completion_rate || 0), 0) / rollupData.length 
      : 0;
    const stuckRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.stuck_rate || 0), 0) / rollupData.length 
      : 0;
    const economyVelocity = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.econ_velocity || 0), 0) / rollupData.length 
      : 0;
    const craftSuccessRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.craft_success_rate || 0), 0) / rollupData.length 
      : 0;
    const vendorTradeRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.vendor_trade_rate || 0), 0) / rollupData.length 
      : 0;
    const partyRecruitsRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.party_recruits_rate || 0), 0) / rollupData.length 
      : 0;
    const dialogueDiversity = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.dialogue_candidate_avg || 0), 0) / rollupData.length 
      : 0;
    const romanceConsentRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.romance_consent_rate || 0), 0) / rollupData.length 
      : 0;
    const eventTriggerRate = rollupData.length > 0 
      ? rollupData.reduce((sum, d) => sum + (d.event_trigger_rate || 0), 0) / rollupData.length 
      : 0;
    
    const response = KPIsResponseSchema.parse({
      success: true,
      data: {
        completion_rate: Math.round(completionRate * 10000) / 10000,
        stuck_rate: Math.round(stuckRate * 10000) / 10000,
        economy_velocity: Math.round(economyVelocity * 100) / 100,
        craft_success_rate: Math.round(craftSuccessRate * 10000) / 10000,
        vendor_trade_rate: Math.round(vendorTradeRate * 10000) / 10000,
        party_recruits_rate: Math.round(partyRecruitsRate * 10000) / 10000,
        dialogue_diversity: Math.round(dialogueDiversity * 100) / 100,
        romance_consent_rate: Math.round(romanceConsentRate * 10000) / 10000,
        event_trigger_rate: Math.round(eventTriggerRate * 10000) / 10000,
      },
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KPIs',
    });
  }
});

/**
 * GET /metrics/funnel
 * Get funnel analysis for adventures
 */
router.get('/funnel', async (req, res) => {
  try {
    const query = FunnelQuerySchema.parse(req.query);
    
    let funnelQuery = supabase.from('awf_funnels_daily').select('*');
    
    if (query.adventure) {
      funnelQuery = funnelQuery.eq('adventure', query.adventure);
    }
    if (query.world) {
      funnelQuery = funnelQuery.eq('world', query.world);
    }
    if (query.experiment) {
      funnelQuery = funnelQuery.eq('experiment', query.experiment);
    }
    if (query.variation) {
      funnelQuery = funnelQuery.eq('variation', query.variation);
    }
    if (query.from) {
      funnelQuery = funnelQuery.gte('date', query.from);
    }
    if (query.to) {
      funnelQuery = funnelQuery.lte('date', query.to);
    }
    
    const { data: funnelData, error } = await funnelQuery;
    if (error) throw error;
    
    if (!funnelData || funnelData.length === 0) {
      return res.json({
        success: true,
        data: {
          adventure: query.adventure || 'all',
          start_count: 0,
          first_choice_count: 0,
          first_npc_join_count: 0,
          first_craft_count: 0,
          first_vendor_count: 0,
          first_boss_count: 0,
          completion_count: 0,
          conversion_rates: {
            start_to_choice: 0,
            choice_to_npc: 0,
            npc_to_craft: 0,
            craft_to_vendor: 0,
            vendor_to_boss: 0,
            boss_to_completion: 0,
            overall_completion: 0,
          },
        },
      });
    }
    
    // Aggregate funnel data
    const aggregated = funnelData.reduce((acc, d) => ({
      start_count: acc.start_count + (d.start_count || 0),
      first_choice_count: acc.first_choice_count + (d.first_choice_count || 0),
      first_npc_join_count: acc.first_npc_join_count + (d.first_npc_join_count || 0),
      first_craft_count: acc.first_craft_count + (d.first_craft_count || 0),
      first_vendor_count: acc.first_vendor_count + (d.first_vendor_count || 0),
      first_boss_count: acc.first_boss_count + (d.first_boss_count || 0),
      completion_count: acc.completion_count + (d.completion_count || 0),
    }), {
      start_count: 0,
      first_choice_count: 0,
      first_npc_join_count: 0,
      first_craft_count: 0,
      first_vendor_count: 0,
      first_boss_count: 0,
      completion_count: 0,
    });
    
    // Calculate conversion rates
    const conversionRates = {
      start_to_choice: aggregated.start_count > 0 ? aggregated.first_choice_count / aggregated.start_count : 0,
      choice_to_npc: aggregated.first_choice_count > 0 ? aggregated.first_npc_join_count / aggregated.first_choice_count : 0,
      npc_to_craft: aggregated.first_npc_join_count > 0 ? aggregated.first_craft_count / aggregated.first_npc_join_count : 0,
      craft_to_vendor: aggregated.first_craft_count > 0 ? aggregated.first_vendor_count / aggregated.first_craft_count : 0,
      vendor_to_boss: aggregated.first_vendor_count > 0 ? aggregated.first_boss_count / aggregated.first_vendor_count : 0,
      boss_to_completion: aggregated.first_boss_count > 0 ? aggregated.completion_count / aggregated.first_boss_count : 0,
      overall_completion: aggregated.start_count > 0 ? aggregated.completion_count / aggregated.start_count : 0,
    };
    
    const response = FunnelResponseSchema.parse({
      success: true,
      data: {
        adventure: query.adventure || 'all',
        ...aggregated,
        conversion_rates: {
          start_to_choice: Math.round(conversionRates.start_to_choice * 10000) / 10000,
          choice_to_npc: Math.round(conversionRates.choice_to_npc * 10000) / 10000,
          npc_to_craft: Math.round(conversionRates.npc_to_craft * 10000) / 10000,
          craft_to_vendor: Math.round(conversionRates.craft_to_vendor * 10000) / 10000,
          vendor_to_boss: Math.round(conversionRates.vendor_to_boss * 10000) / 10000,
          boss_to_completion: Math.round(conversionRates.boss_to_completion * 10000) / 10000,
          overall_completion: Math.round(conversionRates.overall_completion * 10000) / 10000,
        },
      },
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('Funnel analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funnel analysis',
    });
  }
});

/**
 * GET /metrics/experiment
 * Get experiment analysis with variation comparisons
 */
router.get('/experiment', async (req, res) => {
  try {
    const query = ExperimentQuerySchema.parse(req.query);
    
    let rollupQuery = supabase.from('awf_rollup_daily').select('*')
      .eq('experiment', query.experiment);
    
    if (query.from) {
      rollupQuery = rollupQuery.gte('date', query.from);
    }
    if (query.to) {
      rollupQuery = rollupQuery.lte('date', query.to);
    }
    
    const { data: rollupData, error } = await rollupQuery;
    if (error) throw error;
    
    if (!rollupData || rollupData.length === 0) {
      return res.json({
        success: true,
        data: {
          experiment: query.experiment,
          variations: [],
          overall_stats: {
            total_sessions: 0,
            avg_completion_rate: 0,
            avg_latency: 0,
            avg_retry_rate: 0,
          },
        },
      });
    }
    
    // Group by variation
    const variationGroups = new Map<string, any[]>();
    for (const record of rollupData) {
      const variation = record.variation || 'control';
      if (!variationGroups.has(variation)) {
        variationGroups.set(variation, []);
      }
      variationGroups.get(variation)!.push(record);
    }
    
    // Calculate variation metrics
    const variations = Array.from(variationGroups.entries()).map(([variation, records]) => {
      const sessions = records.reduce((sum, r) => sum + (r.sessions || 0), 0);
      const completionRate = records.length > 0 
        ? records.reduce((sum, r) => sum + (r.completion_rate || 0), 0) / records.length 
        : 0;
      const avgLatency = records.length > 0 
        ? records.reduce((sum, r) => sum + (r.p95_latency_ms || 0), 0) / records.length 
        : 0;
      const retryRate = records.length > 0 
        ? records.reduce((sum, r) => sum + (r.retry_rate || 0), 0) / records.length 
        : 0;
      const stuckRate = records.length > 0 
        ? records.reduce((sum, r) => sum + (r.stuck_rate || 0), 0) / records.length 
        : 0;
      const economyVelocity = records.length > 0 
        ? records.reduce((sum, r) => sum + (r.econ_velocity || 0), 0) / records.length 
        : 0;
      
      // Simple significance test (would need more sophisticated statistical analysis)
      const significance = {
        completion_rate: Math.abs(completionRate - 0.5) > 0.1,
        latency: Math.abs(avgLatency - 1000) > 200,
        retry_rate: Math.abs(retryRate - 0.05) > 0.02,
      };
      
      return {
        variation,
        sessions,
        completion_rate: Math.round(completionRate * 10000) / 10000,
        avg_latency: Math.round(avgLatency),
        retry_rate: Math.round(retryRate * 10000) / 10000,
        stuck_rate: Math.round(stuckRate * 10000) / 10000,
        economy_velocity: Math.round(economyVelocity * 100) / 100,
        significance,
      };
    });
    
    // Calculate overall stats
    const totalSessions = rollupData.reduce((sum, r) => sum + (r.sessions || 0), 0);
    const avgCompletionRate = rollupData.length > 0 
      ? rollupData.reduce((sum, r) => sum + (r.completion_rate || 0), 0) / rollupData.length 
      : 0;
    const avgLatency = rollupData.length > 0 
      ? rollupData.reduce((sum, r) => sum + (r.p95_latency_ms || 0), 0) / rollupData.length 
      : 0;
    const avgRetryRate = rollupData.length > 0 
      ? rollupData.reduce((sum, r) => sum + (r.retry_rate || 0), 0) / rollupData.length 
      : 0;
    
    const response = ExperimentResponseSchema.parse({
      success: true,
      data: {
        experiment: query.experiment,
        variations,
        overall_stats: {
          total_sessions: totalSessions,
          avg_completion_rate: Math.round(avgCompletionRate * 10000) / 10000,
          avg_latency: Math.round(avgLatency),
          avg_retry_rate: Math.round(avgRetryRate * 10000) / 10000,
        },
      },
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('Experiment analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch experiment analysis',
    });
  }
});

/**
 * GET /metrics/timeseries
 * Get time series data for specific measures
 */
router.get('/timeseries', async (req, res) => {
  try {
    const query = TimeSeriesQuerySchema.parse(req.query);
    
    // Determine table based on granularity
    const table = query.granularity === 'hour' ? 'awf_rollup_hourly' : 'awf_rollup_daily';
    const timeColumn = query.granularity === 'hour' ? 'date_hour' : 'date';
    
    let rollupQuery = supabase.from(table).select('*');
    
    // Apply filters
    if (query.from) {
      rollupQuery = rollupQuery.gte(timeColumn, query.from);
    }
    if (query.to) {
      rollupQuery = rollupQuery.lte(timeColumn, query.to);
    }
    if (query.world) {
      rollupQuery = rollupQuery.eq('world', query.world);
    }
    if (query.adventure) {
      rollupQuery = rollupQuery.eq('adventure', query.adventure);
    }
    if (query.locale) {
      rollupQuery = rollupQuery.eq('locale', query.locale);
    }
    if (query.model) {
      rollupQuery = rollupQuery.eq('model', query.model);
    }
    if (query.experiment) {
      rollupQuery = rollupQuery.eq('experiment', query.experiment);
    }
    if (query.variation) {
      rollupQuery = rollupQuery.eq('variation', query.variation);
    }
    
    const { data: rollupData, error } = await rollupQuery.order(timeColumn, { ascending: true });
    if (error) throw error;
    
    // Extract time series data
    const timeSeriesData = rollupData?.map(record => ({
      timestamp: record[timeColumn],
      value: record[query.measure] || 0,
      metadata: {
        world: record.world,
        adventure: record.adventure,
        locale: record.locale,
        model: record.model,
        experiment: record.experiment,
        variation: record.variation,
      },
    })) || [];
    
    const response = TimeSeriesResponseSchema.parse({
      success: true,
      data: timeSeriesData,
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('Time series error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time series data',
    });
  }
});

/**
 * GET /metrics/export
 * Export metrics data as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const { format = 'csv', ...filters } = req.query;
    
    // Apply same filters as overview endpoint
    const query = MetricsOverviewQuerySchema.parse(filters);
    
    let rollupQuery = supabase.from('awf_rollup_daily').select('*');
    
    // Apply filters (same logic as overview endpoint)
    if (query.from) {
      rollupQuery = rollupQuery.gte('date', query.from);
    }
    if (query.to) {
      rollupQuery = rollupQuery.lte('date', query.to);
    }
    if (query.world) {
      rollupQuery = rollupQuery.eq('world', query.world);
    }
    if (query.adventure) {
      rollupQuery = rollupQuery.eq('adventure', query.adventure);
    }
    if (query.locale) {
      rollupQuery = rollupQuery.eq('locale', query.locale);
    }
    if (query.model) {
      rollupQuery = rollupQuery.eq('model', query.model);
    }
    if (query.experiment) {
      rollupQuery = rollupQuery.eq('experiment', query.experiment);
    }
    if (query.variation) {
      rollupQuery = rollupQuery.eq('variation', query.variation);
    }
    
    const { data: rollupData, error } = await rollupQuery.order('date', { ascending: true });
    if (error) throw error;
    
    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'date', 'world', 'adventure', 'locale', 'model', 'experiment', 'variation', 'content_version',
        'turns', 'sessions', 'p50_latency_ms', 'p95_latency_ms', 'avg_in_tokens', 'avg_out_tokens',
        'retry_rate', 'fallback_rate', 'validator_retry_rate', 'stuck_rate', 'avg_ticks',
        'tool_calls_per_turn', 'acts_per_turn', 'choices_per_turn', 'softlock_hints_rate',
        'econ_velocity', 'craft_success_rate', 'vendor_trade_rate', 'party_recruits_rate',
        'dialogue_candidate_avg', 'romance_consent_rate', 'event_trigger_rate'
      ];
      
      const csvRows = rollupData?.map(record => 
        csvHeaders.map(header => record[header] || '').join(',')
      ) || [];
      
      const csv = [csvHeaders.join(','), ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="metrics_export.csv"');
      res.send(csv);
      
    } else {
      // Return JSON
      res.json({
        success: true,
        data: rollupData,
        count: rollupData?.length || 0,
      });
    }
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics data',
    });
  }
});

export default router;
