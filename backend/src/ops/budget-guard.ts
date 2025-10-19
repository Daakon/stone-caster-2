// Phase 25: Budget Guardrails System
// Month-to-date estimate, alert thresholds, hard stop, and model downgrade

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Budget configuration schemas
const BudgetConfigSchema = z.object({
  monthly_budget_usd: z.number().min(0),
  alert_threshold_80: z.boolean().default(false),
  alert_threshold_95: z.boolean().default(false),
  hard_stop_threshold: z.number().min(0).max(1).default(1.0),
  model_downgrade_threshold: z.number().min(0).max(1).default(0.8),
  model_downgrade_allowed: z.boolean().default(true),
});

const BudgetTrackingSchema = z.object({
  month_year: z.string(),
  budget_usd: z.number(),
  spent_usd: z.number(),
  projected_spend: z.number(),
  alert_threshold_80: z.boolean(),
  alert_threshold_95: z.boolean(),
  hard_stop_triggered: z.boolean(),
  model_downgrade_active: z.boolean(),
});

const ModelDowngradePlanSchema = z.object({
  current_model: z.string(),
  downgrade_target: z.string(),
  estimated_savings: z.number(),
  quality_impact: z.enum(['low', 'medium', 'high']),
  recommended: z.boolean(),
});

export class BudgetGuard {
  private static instance: BudgetGuard;
  private config: z.infer<typeof BudgetConfigSchema>;
  private currentMonth: string;

  constructor() {
    this.loadConfig();
    this.currentMonth = this.getCurrentMonth();
  }

  static getInstance(): BudgetGuard {
    if (!BudgetGuard.instance) {
      BudgetGuard.instance = new BudgetGuard();
    }
    return BudgetGuard.instance;
  }

  private loadConfig(): void {
    this.config = {
      monthly_budget_usd: parseFloat(process.env.OPS_BUDGET_MONTHLY_USD || '1000'),
      alert_threshold_80: false,
      alert_threshold_95: false,
      hard_stop_threshold: 1.0,
      model_downgrade_threshold: 0.8,
      model_downgrade_allowed: process.env.OPS_MODEL_DOWNGRADE_ALLOWED === 'true',
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Record spending for current month
   */
  async recordSpending(
    amount: number,
    category: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Get current budget tracking
      const tracking = await this.getBudgetTracking();
      
      if (!tracking) {
        // Create new budget tracking for this month
        await this.createBudgetTracking();
      }

      // Update spent amount
      const { error } = await supabase
        .from('awf_budget_tracking')
        .update({
          spent_usd: tracking.spent_usd + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('month_year', this.currentMonth);

      if (error) throw error;

      // Check for threshold breaches
      await this.checkThresholds();

      // Log spending for audit
      await this.logSpending(amount, category, metadata);

      return true;
    } catch (error) {
      console.error('Failed to record spending:', error);
      return false;
    }
  }

  /**
   * Get current budget tracking
   */
  async getBudgetTracking(): Promise<z.infer<typeof BudgetTrackingSchema> | null> {
    try {
      const { data, error } = await supabase
        .from('awf_budget_tracking')
        .select('*')
        .eq('month_year', this.currentMonth)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to get budget tracking:', error);
      return null;
    }
  }

  /**
   * Create budget tracking for current month
   */
  private async createBudgetTracking(): Promise<void> {
    try {
      await supabase
        .from('awf_budget_tracking')
        .insert({
          month_year: this.currentMonth,
          budget_usd: this.config.monthly_budget_usd,
          spent_usd: 0,
          projected_spend: 0,
          alert_threshold_80: false,
          alert_threshold_95: false,
          hard_stop_triggered: false,
          model_downgrade_active: false,
        });
    } catch (error) {
      console.error('Failed to create budget tracking:', error);
    }
  }

  /**
   * Check for threshold breaches and trigger actions
   */
  private async checkThresholds(): Promise<void> {
    const tracking = await this.getBudgetTracking();
    if (!tracking) return;

    const spendRatio = tracking.spent_usd / tracking.budget_usd;

    // Check 80% threshold
    if (spendRatio >= 0.8 && !tracking.alert_threshold_80) {
      await this.triggerAlert('80%', tracking);
      await this.updateBudgetTracking({ alert_threshold_80: true });
    }

    // Check 95% threshold
    if (spendRatio >= 0.95 && !tracking.alert_threshold_95) {
      await this.triggerAlert('95%', tracking);
      await this.updateBudgetTracking({ alert_threshold_95: true });
    }

    // Check model downgrade threshold
    if (spendRatio >= this.config.model_downgrade_threshold && 
        this.config.model_downgrade_allowed && 
        !tracking.model_downgrade_active) {
      await this.triggerModelDowngrade(tracking);
    }

    // Check hard stop threshold
    if (spendRatio >= this.config.hard_stop_threshold && !tracking.hard_stop_triggered) {
      await this.triggerHardStop(tracking);
      await this.updateBudgetTracking({ hard_stop_triggered: true });
    }
  }

  /**
   * Trigger alert for threshold breach
   */
  private async triggerAlert(threshold: string, tracking: z.infer<typeof BudgetTrackingSchema>): Promise<void> {
    try {
      // Create incident
      await supabase
        .from('awf_incidents')
        .insert({
          severity: threshold === '95%' ? 'critical' : 'high',
          scope: 'budget',
          metric: 'spend_ratio',
          observed_value: tracking.spent_usd / tracking.budget_usd,
          threshold_value: threshold === '95%' ? 0.95 : 0.8,
          status: 'new',
          suggested_actions: [
            'Review current spending patterns',
            'Consider reducing token limits',
            'Enable model downgrade if not already active',
            'Review feature usage and disable non-essential features',
          ],
        });

      console.log(`Budget alert triggered: ${threshold} threshold breached`);
    } catch (error) {
      console.error('Failed to trigger budget alert:', error);
    }
  }

  /**
   * Trigger model downgrade
   */
  private async triggerModelDowngrade(tracking: z.infer<typeof BudgetTrackingSchema>): Promise<void> {
    try {
      const downgradePlan = await this.createModelDowngradePlan();
      
      if (downgradePlan.recommended) {
        // Update feature toggle for model downgrade
        await supabase
          .from('awf_feature_toggles')
          .upsert({
            feature_name: 'model_downgrade',
            enabled: true,
            conditions: {
              target_model: downgradePlan.downgrade_target,
              budget_pressure: true,
              estimated_savings: downgradePlan.estimated_savings,
            },
          });

        // Update budget tracking
        await this.updateBudgetTracking({ model_downgrade_active: true });

        // Create incident
        await supabase
          .from('awf_incidents')
          .insert({
            severity: 'medium',
            scope: 'budget',
            metric: 'model_downgrade',
            observed_value: tracking.spent_usd / tracking.budget_usd,
            threshold_value: this.config.model_downgrade_threshold,
            status: 'new',
            suggested_actions: [
              `Model downgraded to ${downgradePlan.downgrade_target}`,
              `Estimated savings: $${downgradePlan.estimated_savings.toFixed(2)}`,
              'Monitor quality metrics for impact',
              'Consider reverting if quality degrades significantly',
            ],
          });

        console.log(`Model downgrade triggered: ${downgradePlan.downgrade_target}`);
      }
    } catch (error) {
      console.error('Failed to trigger model downgrade:', error);
    }
  }

  /**
   * Create model downgrade plan
   */
  private async createModelDowngradePlan(): Promise<z.infer<typeof ModelDowngradePlanSchema>> {
    const currentModel = process.env.AWF_MODEL || 'gpt-4o';
    const downgradeTarget = currentModel.includes('4o') ? 'gpt-4o-mini' : 'gpt-3.5-turbo';
    
    // Estimate savings based on model pricing (simplified)
    const savingsRate = currentModel.includes('4o') ? 0.6 : 0.3; // 60% or 30% savings
    const estimatedSavings = this.config.monthly_budget_usd * savingsRate;
    
    // Determine quality impact
    const qualityImpact = downgradeTarget.includes('mini') ? 'low' : 'medium';
    
    return {
      current_model: currentModel,
      downgrade_target: downgradeTarget,
      estimated_savings: estimatedSavings,
      quality_impact: qualityImpact,
      recommended: true,
    };
  }

  /**
   * Trigger hard stop
   */
  private async triggerHardStop(tracking: z.infer<typeof BudgetTrackingSchema>): Promise<void> {
    try {
      // Disable all non-essential features
      const featuresToDisable = [
        'tool_calls',
        'mod_slices',
        'preview_mode',
        'authoring_mode',
      ];

      for (const feature of featuresToDisable) {
        await supabase
          .from('awf_feature_toggles')
          .upsert({
            feature_name: feature,
            enabled: false,
            conditions: { budget_hard_stop: true },
          });
      }

      // Create critical incident
      await supabase
        .from('awf_incidents')
        .insert({
          severity: 'critical',
          scope: 'budget',
          metric: 'hard_stop',
          observed_value: tracking.spent_usd / tracking.budget_usd,
          threshold_value: this.config.hard_stop_threshold,
          status: 'new',
          suggested_actions: [
            'BUDGET HARD STOP TRIGGERED',
            'All non-essential features disabled',
            'Only core turn processing allowed',
            'Review budget and increase if needed',
            'Contact finance team immediately',
          ],
        });

      console.log('Budget hard stop triggered - all non-essential features disabled');
    } catch (error) {
      console.error('Failed to trigger hard stop:', error);
    }
  }

  /**
   * Update budget tracking
   */
  private async updateBudgetTracking(updates: Partial<z.infer<typeof BudgetTrackingSchema>>): Promise<void> {
    try {
      await supabase
        .from('awf_budget_tracking')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('month_year', this.currentMonth);
    } catch (error) {
      console.error('Failed to update budget tracking:', error);
    }
  }

  /**
   * Log spending for audit
   */
  private async logSpending(
    amount: number,
    category: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // This would typically go to an audit log table
      console.log(`Budget spending: $${amount} for ${category}`, metadata);
    } catch (error) {
      console.error('Failed to log spending:', error);
    }
  }

  /**
   * Get budget statistics
   */
  async getBudgetStats(): Promise<{
    current_month: string;
    budget_usd: number;
    spent_usd: number;
    remaining_usd: number;
    spend_ratio: number;
    projected_spend: number;
    days_remaining: number;
    daily_average: number;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    try {
      const tracking = await this.getBudgetTracking();
      if (!tracking) {
        return {
          current_month: this.currentMonth,
          budget_usd: this.config.monthly_budget_usd,
          spent_usd: 0,
          remaining_usd: this.config.monthly_budget_usd,
          spend_ratio: 0,
          projected_spend: 0,
          days_remaining: 30,
          daily_average: 0,
          status: 'healthy',
        };
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysInMonth = monthEnd.getDate();
      const daysPassed = now.getDate();
      const daysRemaining = daysInMonth - daysPassed;

      const dailyAverage = tracking.spent_usd / daysPassed;
      const projectedSpend = dailyAverage * daysInMonth;
      const spendRatio = tracking.spent_usd / tracking.budget_usd;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (spendRatio >= 0.95) status = 'critical';
      else if (spendRatio >= 0.8) status = 'warning';

      return {
        current_month: this.currentMonth,
        budget_usd: tracking.budget_usd,
        spent_usd: tracking.spent_usd,
        remaining_usd: tracking.budget_usd - tracking.spent_usd,
        spend_ratio: spendRatio,
        projected_spend: projectedSpend,
        days_remaining: daysRemaining,
        daily_average: dailyAverage,
        status,
      };
    } catch (error) {
      console.error('Failed to get budget stats:', error);
      return {
        current_month: this.currentMonth,
        budget_usd: this.config.monthly_budget_usd,
        spent_usd: 0,
        remaining_usd: this.config.monthly_budget_usd,
        spend_ratio: 0,
        projected_spend: 0,
        days_remaining: 30,
        daily_average: 0,
        status: 'healthy',
      };
    }
  }

  /**
   * Check if operation is allowed based on budget
   */
  async isOperationAllowed(estimatedCost: number): Promise<{
    allowed: boolean;
    reason?: string;
    remaining_budget: number;
  }> {
    try {
      const stats = await this.getBudgetStats();
      
      if (stats.remaining_usd < estimatedCost) {
        return {
          allowed: false,
          reason: 'Insufficient budget remaining',
          remaining_budget: stats.remaining_usd,
        };
      }

      if (stats.spend_ratio >= this.config.hard_stop_threshold) {
        return {
          allowed: false,
          reason: 'Hard stop threshold reached',
          remaining_budget: stats.remaining_usd,
        };
      }

      return {
        allowed: true,
        remaining_budget: stats.remaining_usd,
      };
    } catch (error) {
      console.error('Failed to check operation allowance:', error);
      return {
        allowed: true, // Fail open
        remaining_budget: this.config.monthly_budget_usd,
      };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): z.infer<typeof BudgetConfigSchema> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<z.infer<typeof BudgetConfigSchema>>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const budgetGuard = BudgetGuard.getInstance();
