// Phase 24: Experiment Reporting Integration
// Join variations to rollups and compute significance

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Experiment reporting schemas
const ExperimentReportQuerySchema = z.object({
  experiment: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  include_significance: z.boolean().default(true),
  confidence_level: z.number().default(0.95),
});

const VariationComparisonSchema = z.object({
  variation: z.string(),
  sessions: z.number(),
  completion_rate: z.number(),
  avg_latency: z.number(),
  retry_rate: z.number(),
  fallback_rate: z.number(),
  stuck_rate: z.number(),
  economy_velocity: z.number(),
  craft_success_rate: z.number(),
  vendor_trade_rate: z.number(),
  party_recruits_rate: z.number(),
  dialogue_diversity: z.number(),
  romance_consent_rate: z.number(),
  event_trigger_rate: z.number(),
  significance: z.object({
    completion_rate: z.boolean(),
    latency: z.boolean(),
    retry_rate: z.boolean(),
    fallback_rate: z.boolean(),
    stuck_rate: z.boolean(),
    economy_velocity: z.boolean(),
    craft_success_rate: z.boolean(),
    vendor_trade_rate: z.boolean(),
    party_recruits_rate: z.boolean(),
    dialogue_diversity: z.boolean(),
    romance_consent_rate: z.boolean(),
    event_trigger_rate: z.boolean(),
  }),
  p_values: z.object({
    completion_rate: z.number(),
    latency: z.number(),
    retry_rate: z.number(),
    fallback_rate: z.number(),
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

const ExperimentReportSchema = z.object({
  experiment: z.string(),
  total_sessions: z.number(),
  date_range: z.object({
    from: z.string(),
    to: z.string(),
  }),
  variations: z.array(VariationComparisonSchema),
  overall_stats: z.object({
    avg_completion_rate: z.number(),
    avg_latency: z.number(),
    avg_retry_rate: z.number(),
    avg_fallback_rate: z.number(),
    avg_stuck_rate: z.number(),
    avg_economy_velocity: z.number(),
  }),
  significance_summary: z.object({
    significant_metrics: z.array(z.string()),
    most_impactful_variation: z.string().optional(),
    recommended_action: z.string().optional(),
  }),
});

export class ExperimentReporter {
  
  /**
   * Generate comprehensive experiment report
   */
  async generateReport(query: z.infer<typeof ExperimentReportQuerySchema>): Promise<z.infer<typeof ExperimentReportSchema>> {
    const { experiment, from, to, include_significance, confidence_level } = query;
    
    // Get rollup data for experiment
    let rollupQuery = supabase.from('awf_rollup_daily').select('*')
      .eq('experiment', experiment);
    
    if (from) {
      rollupQuery = rollupQuery.gte('date', from);
    }
    if (to) {
      rollupQuery = rollupQuery.lte('date', to);
    }
    
    const { data: rollupData, error } = await rollupQuery;
    if (error) throw error;
    
    if (!rollupData || rollupData.length === 0) {
      throw new Error(`No data found for experiment: ${experiment}`);
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
      const metrics = this.calculateVariationMetrics(records);
      const significance = include_significance 
        ? this.calculateSignificance(variation, records, variationGroups, confidence_level)
        : this.getDefaultSignificance();
      
      return {
        variation,
        ...metrics,
        significance: significance.significance,
        p_values: significance.p_values,
      };
    });
    
    // Calculate overall stats
    const overallStats = this.calculateOverallStats(rollupData);
    
    // Generate significance summary
    const significanceSummary = this.generateSignificanceSummary(variations);
    
    // Determine date range
    const dates = rollupData.map(r => r.date).sort();
    const dateRange = {
      from: dates[0],
      to: dates[dates.length - 1],
    };
    
    return ExperimentReportSchema.parse({
      experiment,
      total_sessions: rollupData.reduce((sum, r) => sum + (r.sessions || 0), 0),
      date_range: dateRange,
      variations,
      overall_stats: overallStats,
      significance_summary: significanceSummary,
    });
  }
  
  /**
   * Calculate metrics for a variation
   */
  private calculateVariationMetrics(records: any[]): any {
    const sessions = records.reduce((sum, r) => sum + (r.sessions || 0), 0);
    const turns = records.reduce((sum, r) => sum + (r.turns || 0), 0);
    
    return {
      sessions,
      completion_rate: this.calculateAverage(records, 'completion_rate'),
      avg_latency: this.calculateAverage(records, 'p95_latency_ms'),
      retry_rate: this.calculateAverage(records, 'retry_rate'),
      fallback_rate: this.calculateAverage(records, 'fallback_rate'),
      stuck_rate: this.calculateAverage(records, 'stuck_rate'),
      economy_velocity: this.calculateAverage(records, 'econ_velocity'),
      craft_success_rate: this.calculateAverage(records, 'craft_success_rate'),
      vendor_trade_rate: this.calculateAverage(records, 'vendor_trade_rate'),
      party_recruits_rate: this.calculateAverage(records, 'party_recruits_rate'),
      dialogue_diversity: this.calculateAverage(records, 'dialogue_candidate_avg'),
      romance_consent_rate: this.calculateAverage(records, 'romance_consent_rate'),
      event_trigger_rate: this.calculateAverage(records, 'event_trigger_rate'),
    };
  }
  
  /**
   * Calculate significance for a variation
   */
  private calculateSignificance(
    variation: string, 
    records: any[], 
    allVariations: Map<string, any[]>, 
    confidenceLevel: number
  ): any {
    const controlVariation = allVariations.get('control') || allVariations.get('baseline');
    if (!controlVariation) {
      return this.getDefaultSignificance();
    }
    
    const significance = {
      completion_rate: this.testSignificance(records, controlVariation, 'completion_rate', confidenceLevel),
      latency: this.testSignificance(records, controlVariation, 'p95_latency_ms', confidenceLevel),
      retry_rate: this.testSignificance(records, controlVariation, 'retry_rate', confidenceLevel),
      fallback_rate: this.testSignificance(records, controlVariation, 'fallback_rate', confidenceLevel),
      stuck_rate: this.testSignificance(records, controlVariation, 'stuck_rate', confidenceLevel),
      economy_velocity: this.testSignificance(records, controlVariation, 'econ_velocity', confidenceLevel),
      craft_success_rate: this.testSignificance(records, controlVariation, 'craft_success_rate', confidenceLevel),
      vendor_trade_rate: this.testSignificance(records, controlVariation, 'vendor_trade_rate', confidenceLevel),
      party_recruits_rate: this.testSignificance(records, controlVariation, 'party_recruits_rate', confidenceLevel),
      dialogue_diversity: this.testSignificance(records, controlVariation, 'dialogue_candidate_avg', confidenceLevel),
      romance_consent_rate: this.testSignificance(records, controlVariation, 'romance_consent_rate', confidenceLevel),
      event_trigger_rate: this.testSignificance(records, controlVariation, 'event_trigger_rate', confidenceLevel),
    };
    
    return {
      significance: {
        completion_rate: significance.completion_rate.isSignificant,
        latency: significance.latency.isSignificant,
        retry_rate: significance.retry_rate.isSignificant,
        fallback_rate: significance.fallback_rate.isSignificant,
        stuck_rate: significance.stuck_rate.isSignificant,
        economy_velocity: significance.economy_velocity.isSignificant,
        craft_success_rate: significance.craft_success_rate.isSignificant,
        vendor_trade_rate: significance.vendor_trade_rate.isSignificant,
        party_recruits_rate: significance.party_recruits_rate.isSignificant,
        dialogue_diversity: significance.dialogue_diversity.isSignificant,
        romance_consent_rate: significance.romance_consent_rate.isSignificant,
        event_trigger_rate: significance.event_trigger_rate.isSignificant,
      },
      p_values: {
        completion_rate: significance.completion_rate.p_value,
        latency: significance.latency.p_value,
        retry_rate: significance.retry_rate.p_value,
        fallback_rate: significance.fallback_rate.p_value,
        stuck_rate: significance.stuck_rate.p_value,
        economy_velocity: significance.economy_velocity.p_value,
        craft_success_rate: significance.craft_success_rate.p_value,
        vendor_trade_rate: significance.vendor_trade_rate.p_value,
        party_recruits_rate: significance.party_recruits_rate.p_value,
        dialogue_diversity: significance.dialogue_diversity.p_value,
        romance_consent_rate: significance.romance_consent_rate.p_value,
        event_trigger_rate: significance.event_trigger_rate.p_value,
      },
    };
  }
  
  /**
   * Test significance between two groups
   */
  private testSignificance(
    group1: any[], 
    group2: any[], 
    metric: string, 
    confidenceLevel: number
  ): { isSignificant: boolean; p_value: number } {
    const values1 = group1.map(r => r[metric] || 0);
    const values2 = group2.map(r => r[metric] || 0);
    
    if (values1.length === 0 || values2.length === 0) {
      return { isSignificant: false, p_value: 1.0 };
    }
    
    // Simple t-test implementation
    const mean1 = values1.reduce((sum, v) => sum + v, 0) / values1.length;
    const mean2 = values2.reduce((sum, v) => sum + v, 0) / values2.length;
    
    const var1 = values1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (values1.length - 1);
    const var2 = values2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (values2.length - 1);
    
    const pooledVar = ((values1.length - 1) * var1 + (values2.length - 1) * var2) / 
                     (values1.length + values2.length - 2);
    
    const se = Math.sqrt(pooledVar * (1/values1.length + 1/values2.length));
    const t = (mean1 - mean2) / se;
    
    const df = values1.length + values2.length - 2;
    const p_value = this.tTestPValue(t, df);
    
    const alpha = 1 - confidenceLevel;
    const isSignificant = p_value < alpha;
    
    return { isSignificant, p_value };
  }
  
  /**
   * Calculate overall experiment stats
   */
  private calculateOverallStats(records: any[]): any {
    return {
      avg_completion_rate: this.calculateAverage(records, 'completion_rate'),
      avg_latency: this.calculateAverage(records, 'p95_latency_ms'),
      avg_retry_rate: this.calculateAverage(records, 'retry_rate'),
      avg_fallback_rate: this.calculateAverage(records, 'fallback_rate'),
      avg_stuck_rate: this.calculateAverage(records, 'stuck_rate'),
      avg_economy_velocity: this.calculateAverage(records, 'econ_velocity'),
    };
  }
  
  /**
   * Generate significance summary
   */
  private generateSignificanceSummary(variations: any[]): any {
    const significantMetrics = new Set<string>();
    const variationImpacts = new Map<string, number>();
    
    for (const variation of variations) {
      if (variation.variation === 'control' || variation.variation === 'baseline') {
        continue;
      }
      
      let impactScore = 0;
      const metrics = [
        'completion_rate', 'latency', 'retry_rate', 'fallback_rate', 'stuck_rate',
        'economy_velocity', 'craft_success_rate', 'vendor_trade_rate', 'party_recruits_rate',
        'dialogue_diversity', 'romance_consent_rate', 'event_trigger_rate'
      ];
      
      for (const metric of metrics) {
        if (variation.significance[metric]) {
          significantMetrics.add(metric);
          impactScore++;
        }
      }
      
      variationImpacts.set(variation.variation, impactScore);
    }
    
    const mostImpactfulVariation = Array.from(variationImpacts.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    let recommendedAction = 'Continue monitoring experiment';
    if (significantMetrics.size > 0) {
      if (significantMetrics.has('completion_rate')) {
        recommendedAction = 'Consider promoting successful variation';
      } else if (significantMetrics.has('stuck_rate') || significantMetrics.has('retry_rate')) {
        recommendedAction = 'Investigate performance issues in variations';
      } else if (significantMetrics.has('economy_velocity')) {
        recommendedAction = 'Review economic balance in variations';
      }
    }
    
    return {
      significant_metrics: Array.from(significantMetrics),
      most_impactful_variation: mostImpactfulVariation,
      recommended_action: recommendedAction,
    };
  }
  
  /**
   * Export experiment report as CSV
   */
  async exportReportCSV(query: z.infer<typeof ExperimentReportQuerySchema>): Promise<string> {
    const report = await this.generateReport(query);
    
    const headers = [
      'variation', 'sessions', 'completion_rate', 'avg_latency', 'retry_rate', 'fallback_rate',
      'stuck_rate', 'economy_velocity', 'craft_success_rate', 'vendor_trade_rate',
      'party_recruits_rate', 'dialogue_diversity', 'romance_consent_rate', 'event_trigger_rate',
      'completion_rate_significant', 'latency_significant', 'retry_rate_significant',
      'fallback_rate_significant', 'stuck_rate_significant', 'economy_velocity_significant',
      'craft_success_rate_significant', 'vendor_trade_rate_significant', 'party_recruits_rate_significant',
      'dialogue_diversity_significant', 'romance_consent_rate_significant', 'event_trigger_rate_significant'
    ];
    
    const rows = report.variations.map(variation => [
      variation.variation,
      variation.sessions,
      variation.completion_rate,
      variation.avg_latency,
      variation.retry_rate,
      variation.fallback_rate,
      variation.stuck_rate,
      variation.economy_velocity,
      variation.craft_success_rate,
      variation.vendor_trade_rate,
      variation.party_recruits_rate,
      variation.dialogue_diversity,
      variation.romance_consent_rate,
      variation.event_trigger_rate,
      variation.significance.completion_rate,
      variation.significance.latency,
      variation.significance.retry_rate,
      variation.significance.fallback_rate,
      variation.significance.stuck_rate,
      variation.significance.economy_velocity,
      variation.significance.craft_success_rate,
      variation.significance.vendor_trade_rate,
      variation.significance.party_recruits_rate,
      variation.significance.dialogue_diversity,
      variation.significance.romance_consent_rate,
      variation.significance.event_trigger_rate,
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csv;
  }
  
  /**
   * Export experiment report as JSON
   */
  async exportReportJSON(query: z.infer<typeof ExperimentReportQuerySchema>): Promise<string> {
    const report = await this.generateReport(query);
    return JSON.stringify(report, null, 2);
  }
  
  // Helper methods
  private calculateAverage(records: any[], metric: string): number {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + (r[metric] || 0), 0);
    return Math.round((sum / records.length) * 10000) / 10000;
  }
  
  private getDefaultSignificance(): any {
    return {
      significance: {
        completion_rate: false,
        latency: false,
        retry_rate: false,
        fallback_rate: false,
        stuck_rate: false,
        economy_velocity: false,
        craft_success_rate: false,
        vendor_trade_rate: false,
        party_recruits_rate: false,
        dialogue_diversity: false,
        romance_consent_rate: false,
        event_trigger_rate: false,
      },
      p_values: {
        completion_rate: 1.0,
        latency: 1.0,
        retry_rate: 1.0,
        fallback_rate: 1.0,
        stuck_rate: 1.0,
        economy_velocity: 1.0,
        craft_success_rate: 1.0,
        vendor_trade_rate: 1.0,
        party_recruits_rate: 1.0,
        dialogue_diversity: 1.0,
        romance_consent_rate: 1.0,
        event_trigger_rate: 1.0,
      },
    };
  }
  
  private tTestPValue(t: number, df: number): number {
    // Simplified t-test p-value calculation
    // In production, use a proper statistical library
    const absT = Math.abs(t);
    if (absT > 3) return 0.001;
    if (absT > 2.5) return 0.01;
    if (absT > 2) return 0.05;
    if (absT > 1.5) return 0.1;
    return 0.5;
  }
}

export const experimentReporter = new ExperimentReporter();
