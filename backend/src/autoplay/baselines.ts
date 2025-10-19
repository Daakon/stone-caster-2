// Phase 27: Autonomous Playtesting Bots and Fuzz Harness
// Baseline comparison and diff system

import { createClient } from '@supabase/supabase-js';

export interface BaselineMetrics {
  coverage: {
    quest_graph: number;
    dialogue: number;
    mechanics: number;
    economy: number;
    world_sim: number;
    mods: number;
    overall: number;
  };
  performance: {
    avg_turn_latency_ms: number;
    p95_turn_latency_ms: number;
    avg_tokens_per_turn: number;
    max_tokens_per_turn: number;
    turns_per_second: number;
  };
  oracles: {
    soft_locks: number;
    budget_violations: number;
    validator_retries: number;
    fallback_engagements: number;
    safety_violations: number;
    performance_violations: number;
    integrity_violations: number;
  };
  behavior: {
    avg_turns_to_completion: number;
    exploration_efficiency: number;
    dialogue_engagement_rate: number;
    economic_activity_rate: number;
    risk_taking_rate: number;
  };
}

export interface BaselineComparison {
  baseline_key: string;
  current_metrics: BaselineMetrics;
  baseline_metrics: BaselineMetrics;
  deltas: {
    coverage: Record<string, number>;
    performance: Record<string, number>;
    oracles: Record<string, number>;
    behavior: Record<string, number>;
  };
  verdict: 'pass' | 'fail' | 'warning';
  tolerance_exceeded: string[];
  significant_changes: string[];
  summary: string;
}

export interface BaselineConfig {
  coverage_tolerance: number; // 0.05 = 5%
  performance_tolerance: number; // 0.1 = 10%
  oracle_tolerance: number; // 0.0 = no tolerance for new failures
  behavior_tolerance: number; // 0.15 = 15%
  critical_thresholds: {
    coverage_drop: number; // 0.1 = 10% drop is critical
    performance_degradation: number; // 0.2 = 20% degradation is critical
    new_failures: number; // 1 = any new failure is critical
  };
}

export class BaselineManager {
  private supabase: any;
  private config: BaselineConfig;

  constructor(supabase: any, config?: Partial<BaselineConfig>) {
    this.supabase = supabase;
    this.config = {
      coverage_tolerance: 0.05,
      performance_tolerance: 0.1,
      oracle_tolerance: 0.0,
      behavior_tolerance: 0.15,
      critical_thresholds: {
        coverage_drop: 0.1,
        performance_degradation: 0.2,
        new_failures: 1
      },
      ...config
    };
  }

  async saveBaseline(
    key: string,
    metrics: BaselineMetrics
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('autoplay_baselines')
        .upsert({
          key,
          metrics,
          updated_at: new Date().toISOString()
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async loadBaseline(key: string): Promise<{
    success: boolean;
    data?: BaselineMetrics;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('autoplay_baselines')
        .select('metrics')
        .eq('key', key)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data.metrics };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async compareWithBaseline(
    baselineKey: string,
    currentMetrics: BaselineMetrics
  ): Promise<BaselineComparison> {
    const baselineResult = await this.loadBaseline(baselineKey);
    
    if (!baselineResult.success || !baselineResult.data) {
      throw new Error(`Failed to load baseline: ${baselineResult.error}`);
    }

    const baselineMetrics = baselineResult.data;
    const deltas = this.calculateDeltas(currentMetrics, baselineMetrics);
    const verdict = this.determineVerdict(deltas);
    const toleranceExceeded = this.findToleranceExceeded(deltas);
    const significantChanges = this.findSignificantChanges(deltas);
    const summary = this.generateSummary(deltas, verdict, toleranceExceeded, significantChanges);

    return {
      baseline_key: baselineKey,
      current_metrics: currentMetrics,
      baseline_metrics: baselineMetrics,
      deltas,
      verdict,
      tolerance_exceeded: toleranceExceeded,
      significant_changes: significantChanges,
      summary
    };
  }

  private calculateDeltas(current: BaselineMetrics, baseline: BaselineMetrics): any {
    return {
      coverage: {
        quest_graph: this.calculateDelta(current.coverage.quest_graph, baseline.coverage.quest_graph),
        dialogue: this.calculateDelta(current.coverage.dialogue, baseline.coverage.dialogue),
        mechanics: this.calculateDelta(current.coverage.mechanics, baseline.coverage.mechanics),
        economy: this.calculateDelta(current.coverage.economy, baseline.coverage.economy),
        world_sim: this.calculateDelta(current.coverage.world_sim, baseline.coverage.world_sim),
        mods: this.calculateDelta(current.coverage.mods, baseline.coverage.mods),
        overall: this.calculateDelta(current.coverage.overall, baseline.coverage.overall)
      },
      performance: {
        avg_turn_latency_ms: this.calculateDelta(current.performance.avg_turn_latency_ms, baseline.performance.avg_turn_latency_ms),
        p95_turn_latency_ms: this.calculateDelta(current.performance.p95_turn_latency_ms, baseline.performance.p95_turn_latency_ms),
        avg_tokens_per_turn: this.calculateDelta(current.performance.avg_tokens_per_turn, baseline.performance.avg_tokens_per_turn),
        max_tokens_per_turn: this.calculateDelta(current.performance.max_tokens_per_turn, baseline.performance.max_tokens_per_turn),
        turns_per_second: this.calculateDelta(current.performance.turns_per_second, baseline.performance.turns_per_second)
      },
      oracles: {
        soft_locks: this.calculateDelta(current.oracles.soft_locks, baseline.oracles.soft_locks),
        budget_violations: this.calculateDelta(current.oracles.budget_violations, baseline.oracles.budget_violations),
        validator_retries: this.calculateDelta(current.oracles.validator_retries, baseline.oracles.validator_retries),
        fallback_engagements: this.calculateDelta(current.oracles.fallback_engagements, baseline.oracles.fallback_engagements),
        safety_violations: this.calculateDelta(current.oracles.safety_violations, baseline.oracles.safety_violations),
        performance_violations: this.calculateDelta(current.oracles.performance_violations, baseline.oracles.performance_violations),
        integrity_violations: this.calculateDelta(current.oracles.integrity_violations, baseline.oracles.integrity_violations)
      },
      behavior: {
        avg_turns_to_completion: this.calculateDelta(current.behavior.avg_turns_to_completion, baseline.behavior.avg_turns_to_completion),
        exploration_efficiency: this.calculateDelta(current.behavior.exploration_efficiency, baseline.behavior.exploration_efficiency),
        dialogue_engagement_rate: this.calculateDelta(current.behavior.dialogue_engagement_rate, baseline.behavior.dialogue_engagement_rate),
        economic_activity_rate: this.calculateDelta(current.behavior.economic_activity_rate, baseline.behavior.economic_activity_rate),
        risk_taking_rate: this.calculateDelta(current.behavior.risk_taking_rate, baseline.behavior.risk_taking_rate)
      }
    };
  }

  private calculateDelta(current: number, baseline: number): number {
    if (baseline === 0) return current;
    return (current - baseline) / baseline;
  }

  private determineVerdict(deltas: any): 'pass' | 'fail' | 'warning' {
    // Check critical thresholds first
    const coverageDrop = Math.abs(deltas.coverage.overall);
    if (coverageDrop > this.config.critical_thresholds.coverage_drop) {
      return 'fail';
    }

    const performanceDegradation = Math.abs(deltas.performance.avg_turn_latency_ms);
    if (performanceDegradation > this.config.critical_thresholds.performance_degradation) {
      return 'fail';
    }

    const newFailures = Object.values(deltas.oracles).filter(delta => delta > 0).length;
    if (newFailures >= this.config.critical_thresholds.new_failures) {
      return 'fail';
    }

    // Check tolerance thresholds
    const toleranceExceeded = this.findToleranceExceeded(deltas);
    if (toleranceExceeded.length > 0) {
      return 'warning';
    }

    return 'pass';
  }

  private findToleranceExceeded(deltas: any): string[] {
    const exceeded: string[] = [];

    // Check coverage tolerance
    Object.entries(deltas.coverage).forEach(([key, delta]) => {
      if (Math.abs(delta as number) > this.config.coverage_tolerance) {
        exceeded.push(`coverage.${key}`);
      }
    });

    // Check performance tolerance
    Object.entries(deltas.performance).forEach(([key, delta]) => {
      if (Math.abs(delta as number) > this.config.performance_tolerance) {
        exceeded.push(`performance.${key}`);
      }
    });

    // Check oracle tolerance (no tolerance for new failures)
    Object.entries(deltas.oracles).forEach(([key, delta]) => {
      if (delta > this.config.oracle_tolerance) {
        exceeded.push(`oracles.${key}`);
      }
    });

    // Check behavior tolerance
    Object.entries(deltas.behavior).forEach(([key, delta]) => {
      if (Math.abs(delta as number) > this.config.behavior_tolerance) {
        exceeded.push(`behavior.${key}`);
      }
    });

    return exceeded;
  }

  private findSignificantChanges(deltas: any): string[] {
    const significant: string[] = [];

    // Significant coverage improvements
    Object.entries(deltas.coverage).forEach(([key, delta]) => {
      if (delta > 0.1) { // 10% improvement
        significant.push(`coverage.${key} improved by ${(delta * 100).toFixed(1)}%`);
      }
    });

    // Significant performance improvements
    if (deltas.performance.avg_turn_latency_ms < -0.1) {
      significant.push(`performance.avg_turn_latency improved by ${(Math.abs(deltas.performance.avg_turn_latency_ms) * 100).toFixed(1)}%`);
    }

    if (deltas.performance.turns_per_second > 0.1) {
      significant.push(`performance.turns_per_second improved by ${(deltas.performance.turns_per_second * 100).toFixed(1)}%`);
    }

    // Significant behavior changes
    Object.entries(deltas.behavior).forEach(([key, delta]) => {
      if (Math.abs(delta) > 0.2) { // 20% change
        significant.push(`behavior.${key} changed by ${(delta * 100).toFixed(1)}%`);
      }
    });

    return significant;
  }

  private generateSummary(
    deltas: any,
    verdict: string,
    toleranceExceeded: string[],
    significantChanges: string[]
  ): string {
    const summaryParts: string[] = [];

    // Overall verdict
    summaryParts.push(`Verdict: ${verdict.toUpperCase()}`);

    // Coverage summary
    const coverageDelta = deltas.coverage.overall;
    if (Math.abs(coverageDelta) > 0.01) {
      const direction = coverageDelta > 0 ? 'improved' : 'degraded';
      summaryParts.push(`Overall coverage ${direction} by ${(Math.abs(coverageDelta) * 100).toFixed(1)}%`);
    }

    // Performance summary
    const latencyDelta = deltas.performance.avg_turn_latency_ms;
    if (Math.abs(latencyDelta) > 0.01) {
      const direction = latencyDelta > 0 ? 'increased' : 'decreased';
      summaryParts.push(`Average turn latency ${direction} by ${(Math.abs(latencyDelta) * 100).toFixed(1)}%`);
    }

    // Oracle summary
    const newFailures = Object.values(deltas.oracles).filter(delta => delta > 0).length;
    if (newFailures > 0) {
      summaryParts.push(`${newFailures} new oracle failure(s) detected`);
    }

    // Tolerance exceeded summary
    if (toleranceExceeded.length > 0) {
      summaryParts.push(`${toleranceExceeded.length} metric(s) exceeded tolerance thresholds`);
    }

    // Significant changes summary
    if (significantChanges.length > 0) {
      summaryParts.push(`${significantChanges.length} significant change(s) detected`);
    }

    return summaryParts.join('. ');
  }

  async generateBaselineKey(
    world: string,
    adventure: string,
    version: string,
    locale: string,
    variation: string
  ): Promise<string> {
    return `${world}/${adventure}/${version}/${locale}/${variation}`;
  }

  async listBaselines(): Promise<{
    success: boolean;
    data?: Array<{ key: string; created_at: string; updated_at: string }>;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('autoplay_baselines')
        .select('key, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async deleteBaseline(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('autoplay_baselines')
        .delete()
        .eq('key', key);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  updateConfig(newConfig: Partial<BaselineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): BaselineConfig {
    return { ...this.config };
  }
}
