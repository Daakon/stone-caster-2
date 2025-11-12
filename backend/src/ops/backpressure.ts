// Phase 25: Backpressure System
// Monitors p95 latency, queue depths and triggers degradation actions

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RedisClientLike = {
  incr?: (key: string) => Promise<number>;
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

// Backpressure configuration schemas
const BackpressureConfigSchema = z.object({
  latency_p95_threshold: z.number().min(1000),
  queue_depth_threshold: z.number().min(10),
  token_queue_threshold: z.number().min(100),
  actions: z.array(z.enum([
    'reduce_input_tokens',
    'disable_tool_calls',
    'disable_mod_slices',
    'switch_compact_slices',
    'downgrade_model'
  ])),
});

const BackpressureActionSchema = z.object({
  action: z.string(),
  enabled: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.string(),
  metadata: z.record(z.any()),
});

const BackpressureStateSchema = z.object({
  metric_name: z.string(),
  current_value: z.number(),
  threshold_value: z.number(),
  is_active: z.boolean(),
  actions_taken: z.array(BackpressureActionSchema),
});

export class BackpressureManager {
  private static instance: BackpressureManager;
  private config: z.infer<typeof BackpressureConfigSchema>;
  private metrics: Map<string, number> = new Map();
  private activeActions: Set<string> = new Set();

  constructor() {
    this.loadConfig();
  }

  static getInstance(): BackpressureManager {
    if (!BackpressureManager.instance) {
      BackpressureManager.instance = new BackpressureManager();
    }
    return BackpressureManager.instance;
  }

  private loadConfig(): void {
    this.config = {
      latency_p95_threshold: parseInt(process.env.OPS_BACKPRESSURE_LATENCY_P95_MS || '8000'),
      queue_depth_threshold: parseInt(process.env.OPS_BACKPRESSURE_QUEUE_MAX || '200'),
      token_queue_threshold: parseInt(process.env.OPS_BACKPRESSURE_TOKEN_QUEUE_MAX || '1000'),
      actions: [
        'reduce_input_tokens',
        'disable_tool_calls',
        'disable_mod_slices',
        'switch_compact_slices',
        'downgrade_model'
      ],
    };
  }

  /**
   * Update metric value and check for backpressure triggers
   */
  async updateMetric(
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<{
    triggered: boolean;
    actions: Array<z.infer<typeof BackpressureActionSchema>>;
  }> {
    try {
      this.metrics.set(metricName, value);
      
      const threshold = this.getThresholdForMetric(metricName);
      const triggered = value > threshold;
      
      let actions: Array<z.infer<typeof BackpressureActionSchema>> = [];
      
      if (triggered) {
        actions = await this.triggerBackpressureActions(metricName, value, metadata);
        await this.updateBackpressureState(metricName, value, threshold, true, actions);
      } else {
        // Check if we should recover from backpressure
        const shouldRecover = await this.checkRecovery(metricName, value);
        if (shouldRecover) {
          actions = await this.recoverFromBackpressure(metricName);
          await this.updateBackpressureState(metricName, value, threshold, false, actions);
        }
      }
      
      return { triggered, actions };
    } catch (error) {
      console.error('Failed to update metric:', error);
      return { triggered: false, actions: [] };
    }
  }

  /**
   * Get threshold for specific metric
   */
  private getThresholdForMetric(metricName: string): number {
    switch (metricName) {
      case 'latency_p95':
        return this.config.latency_p95_threshold;
      case 'queue_depth':
        return this.config.queue_depth_threshold;
      case 'token_queue':
        return this.config.token_queue_threshold;
      default:
        return 1000; // Default threshold
    }
  }

  /**
   * Trigger backpressure actions based on metric severity
   */
  private async triggerBackpressureActions(
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ): Promise<Array<z.infer<typeof BackpressureActionSchema>>> {
    const actions: Array<z.infer<typeof BackpressureActionSchema>> = [];
    const severity = this.calculateSeverity(metricName, value);
    
    // Determine which actions to take based on severity
    const actionsToTake = this.getActionsForSeverity(severity);
    
    for (const action of actionsToTake) {
      if (!this.activeActions.has(action)) {
        const actionResult = await this.executeAction(action, severity, metadata);
        if (actionResult.success) {
          actions.push({
            action,
            enabled: true,
            severity,
            timestamp: new Date().toISOString(),
            metadata: actionResult.metadata || {},
          });
          this.activeActions.add(action);
        }
      }
    }
    
    return actions;
  }

  /**
   * Calculate severity based on metric value and threshold
   */
  private calculateSeverity(metricName: string, value: number): 'low' | 'medium' | 'high' | 'critical' {
    const threshold = this.getThresholdForMetric(metricName);
    const ratio = value / threshold;
    
    if (ratio >= 2.0) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  /**
   * Get actions to take based on severity
   */
  private getActionsForSeverity(severity: string): string[] {
    switch (severity) {
      case 'critical':
        return this.config.actions; // All actions
      case 'high':
        return this.config.actions.slice(0, 4); // All except model downgrade
      case 'medium':
        return this.config.actions.slice(0, 3); // First 3 actions
      case 'low':
        return this.config.actions.slice(0, 2); // First 2 actions
      default:
        return [];
    }
  }

  /**
   * Execute specific backpressure action
   */
  private async executeAction(
    action: string,
    severity: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    try {
      switch (action) {
        case 'reduce_input_tokens':
          return await this.reduceInputTokens(severity);
        case 'disable_tool_calls':
          return await this.disableToolCalls(severity);
        case 'disable_mod_slices':
          return await this.disableModSlices(severity);
        case 'switch_compact_slices':
          return await this.switchCompactSlices(severity);
        case 'downgrade_model':
          return await this.downgradeModel(severity);
        default:
          return { success: false };
      }
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
      return { success: false };
    }
  }

  /**
   * Reduce input token cap by 10-20%
   */
  private async reduceInputTokens(severity: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    const reductionPercent = severity === 'critical' ? 20 : 10;
    const currentCap = parseInt(process.env.AWF_MAX_INPUT_TOKENS || '4000');
    const newCap = Math.max(1000, currentCap - (currentCap * reductionPercent / 100));
    
    // Update environment variable (in production, this would update a config store)
    process.env.AWF_MAX_INPUT_TOKENS = newCap.toString();
    
    return {
      success: true,
      metadata: {
        old_cap: currentCap,
        new_cap: newCap,
        reduction_percent: reductionPercent,
      },
    };
  }

  /**
   * Disable tool calls temporarily
   */
  private async disableToolCalls(severity: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    const duration = severity === 'critical' ? 300 : 60; // 5 minutes or 1 minute
    
    // Update feature toggle
    await supabase
      .from('awf_feature_toggles')
      .upsert({
        feature_name: 'tool_calls',
        enabled: false,
        conditions: { backpressure: true, duration_seconds: duration },
      });
    
    return {
      success: true,
      metadata: {
        duration_seconds: duration,
        disabled_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Disable mod micro-slices temporarily
   */
  private async disableModSlices(severity: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    const duration = severity === 'critical' ? 600 : 120; // 10 minutes or 2 minutes
    
    await supabase
      .from('awf_feature_toggles')
      .upsert({
        feature_name: 'mod_slices',
        enabled: false,
        conditions: { backpressure: true, duration_seconds: duration },
      });
    
    return {
      success: true,
      metadata: {
        duration_seconds: duration,
        disabled_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Switch to compact assembler slices
   */
  private async switchCompactSlices(severity: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    const compactMode = severity === 'critical' ? 'minimal' : 'compact';
    
    await supabase
      .from('awf_feature_toggles')
      .upsert({
        feature_name: 'assembler_mode',
        enabled: true,
        conditions: { mode: compactMode, backpressure: true },
      });
    
    return {
      success: true,
      metadata: {
        mode: compactMode,
        switched_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Downgrade model (e.g., GPT-4 → GPT-4-mini)
   */
  private async downgradeModel(severity: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    const downgradeTarget = severity === 'critical' ? 'gpt-4o-mini' : 'gpt-4o';
    
    await supabase
      .from('awf_feature_toggles')
      .upsert({
        feature_name: 'model_downgrade',
        enabled: true,
        conditions: { target_model: downgradeTarget, backpressure: true },
      });
    
    return {
      success: true,
      metadata: {
        target_model: downgradeTarget,
        downgraded_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if we should recover from backpressure
   */
  private async checkRecovery(metricName: string, value: number): Promise<boolean> {
    const threshold = this.getThresholdForMetric(metricName);
    const recoveryThreshold = threshold * 0.8; // Recover when 20% below threshold
    
    return value < recoveryThreshold && this.activeActions.size > 0;
  }

  /**
   * Recover from backpressure by reversing actions
   */
  private async recoverFromBackpressure(metricName: string): Promise<Array<z.infer<typeof BackpressureActionSchema>>> {
    const actions: Array<z.infer<typeof BackpressureActionSchema>> = [];
    
    for (const action of this.activeActions) {
      const recoveryResult = await this.recoverAction(action);
      if (recoveryResult.success) {
        actions.push({
          action: `recover_${action}`,
          enabled: false,
          severity: 'low',
          timestamp: new Date().toISOString(),
          metadata: recoveryResult.metadata || {},
        });
        this.activeActions.delete(action);
      }
    }
    
    return actions;
  }

  /**
   * Recover specific action
   */
  private async recoverAction(action: string): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    try {
      switch (action) {
        case 'reduce_input_tokens':
          // Restore original token cap
          process.env.AWF_MAX_INPUT_TOKENS = '4000';
          return { success: true, metadata: { restored_cap: 4000 } };
          
        case 'disable_tool_calls':
          await supabase
            .from('awf_feature_toggles')
            .upsert({ feature_name: 'tool_calls', enabled: true });
          return { success: true, metadata: { restored: true } };
          
        case 'disable_mod_slices':
          await supabase
            .from('awf_feature_toggles')
            .upsert({ feature_name: 'mod_slices', enabled: true });
          return { success: true, metadata: { restored: true } };
          
        case 'switch_compact_slices':
          await supabase
            .from('awf_feature_toggles')
            .upsert({ feature_name: 'assembler_mode', enabled: true, conditions: { mode: 'normal' } });
          return { success: true, metadata: { restored_mode: 'normal' } };
          
        case 'downgrade_model':
          await supabase
            .from('awf_feature_toggles')
            .upsert({ feature_name: 'model_downgrade', enabled: false });
          return { success: true, metadata: { restored: true } };
          
        default:
          return { success: false };
      }
    } catch (error) {
      console.error(`Failed to recover action ${action}:`, error);
      return { success: false };
    }
  }

  /**
   * Update backpressure state in database
   */
  private async updateBackpressureState(
    metricName: string,
    currentValue: number,
    thresholdValue: number,
    isActive: boolean,
    actions: Array<z.infer<typeof BackpressureActionSchema>>
  ): Promise<void> {
    try {
      await supabase
        .from('awf_backpressure_state')
        .upsert({
          metric_name: metricName,
          current_value: currentValue,
          threshold_value: thresholdValue,
          is_active: isActive,
          actions_taken: actions,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to update backpressure state:', error);
    }
  }

  /**
   * Get current backpressure state
   */
  async getBackpressureState(): Promise<Array<z.infer<typeof BackpressureStateSchema>>> {
    try {
      const { data, error } = await supabase
        .from('awf_backpressure_state')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get backpressure state:', error);
      return [];
    }
  }

  /**
   * Get backpressure statistics
   */
  async getBackpressureStats(): Promise<{
    active_metrics: number;
    total_actions: number;
    by_severity: Record<string, number>;
    recent_actions: Array<z.infer<typeof BackpressureActionSchema>>;
  }> {
    try {
      const states = await this.getBackpressureState();
      
      const active_metrics = states.filter(s => s.is_active).length;
      const total_actions = states.reduce((sum, s) => sum + s.actions_taken.length, 0);
      
      const by_severity: Record<string, number> = {};
      const recent_actions: Array<z.infer<typeof BackpressureActionSchema>> = [];
      
      for (const state of states) {
        for (const action of state.actions_taken) {
          by_severity[action.severity] = (by_severity[action.severity] || 0) + 1;
          recent_actions.push(action);
        }
      }
      
      return {
        active_metrics,
        total_actions,
        by_severity,
        recent_actions: recent_actions
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get backpressure stats:', error);
      return {
        active_metrics: 0,
        total_actions: 0,
        by_severity: {},
        recent_actions: [],
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): z.infer<typeof BackpressureConfigSchema> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<z.infer<typeof BackpressureConfigSchema>>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const backpressureManager = BackpressureManager.getInstance();

export class BackpressureService {
  constructor(
    private readonly supabaseClient: SupabaseClientLike = supabase,
    private readonly redisClient: RedisClientLike | null = null
  ) {}

  async monitorMetrics(metrics: {
    model_latency_p95: number;
    token_queue_depth: number;
    error_rate: number;
    throughput: number;
  }): Promise<{ success: boolean; data: { metrics: typeof metrics; actions_taken: string[] } }> {
    const actions: string[] = [];
    if (metrics.model_latency_p95 >= 1500) {
      actions.push('reduce_input_tokens', 'disable_tool_calls');
    }
    if (metrics.token_queue_depth >= 400) {
      actions.push('switch_compact_slices', 'downgrade_model');
    }

    if (actions.length > 0 && this.supabaseClient?.from) {
      await this.supabaseClient.from('awf_incidents').insert({
        severity: metrics.model_latency_p95 > 2000 ? 'critical' : 'high',
        scope: 'model',
        metric: 'latency_p95',
        observed_value: metrics.model_latency_p95,
        threshold_value: 1500,
        suggested_actions: actions,
        created_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      data: {
        metrics,
        actions_taken: actions,
      },
    };
  }

  async createIncident(incident: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    scope: string;
    metric: string;
    observed_value: number;
    threshold_value: number;
    suggested_actions: string[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabaseClient.from('awf_incidents').insert({
        ...incident,
        created_at: new Date().toISOString(),
      });
      if (error) {
        throw new Error(error.message);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getBackpressureStatus(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const query = this.supabaseClient.from('awf_backpressure_state').select('*');
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) {
        throw new Error(error.message || 'Failed to fetch backpressure state');
      }

      return {
        success: true,
        data: data?.[0] || { active_metrics: 0, total_actions: 0 },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
