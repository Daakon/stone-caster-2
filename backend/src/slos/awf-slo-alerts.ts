// Phase 24: SLO Alerts & Thresholds
// Evaluate thresholds and trigger alerts with suggested actions

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Alert configuration schemas
const SLOThresholdSchema = z.object({
  id: z.string(),
  scope: z.string(),
  scope_ref: z.string().optional(),
  kpi_name: z.string(),
  threshold_value: z.number(),
  threshold_operator: z.enum(['>', '<', '>=', '<=', '=', '!=']),
  severity: z.enum(['warning', 'critical']),
  enabled: z.boolean(),
  suggested_actions: z.array(z.string()).optional(),
});

const AlertResultSchema = z.object({
  threshold_id: z.string(),
  severity: z.string(),
  kpi_name: z.string(),
  current_value: z.number(),
  threshold_value: z.number(),
  scope: z.string(),
  scope_ref: z.string().optional(),
  suggested_actions: z.array(z.string()).optional(),
  status: z.enum(['new', 'acknowledged', 'resolved']),
});

const IncidentSchema = z.object({
  id: z.string(),
  threshold_id: z.string(),
  severity: z.string(),
  kpi_name: z.string(),
  current_value: z.number(),
  threshold_value: z.number(),
  scope: z.string(),
  scope_ref: z.string().optional(),
  suggested_actions: z.array(z.string()).optional(),
  status: z.enum(['new', 'acknowledged', 'resolved']),
  created_at: z.string(),
});

export class SLOAlerts {
  private webhookUrl: string | null = null;
  private emailFrom: string | null = null;
  private emailTo: string | null = null;

  constructor() {
    this.webhookUrl = process.env.ALERTS_WEBHOOK_URL || null;
    this.emailFrom = process.env.ALERTS_EMAIL_FROM || null;
    this.emailTo = process.env.ALERTS_EMAIL_TO || null;
  }

  /**
   * Evaluate all enabled thresholds and create alerts
   */
  async evaluateThresholds(): Promise<void> {
    console.log('Evaluating SLO thresholds...');
    
    try {
      // Get all enabled thresholds
      const { data: thresholds, error } = await supabase
        .from('awf_kpi_thresholds')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;
      if (!thresholds || thresholds.length === 0) {
        console.log('No enabled thresholds found');
        return;
      }

      // Evaluate each threshold
      for (const threshold of thresholds) {
        await this.evaluateThreshold(threshold);
      }

      console.log(`Evaluated ${thresholds.length} thresholds`);
      
    } catch (error) {
      console.error('Threshold evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Evaluate a single threshold
   */
  private async evaluateThreshold(threshold: any): Promise<void> {
    try {
      // Get current KPI value
      const currentValue = await this.getCurrentKPIValue(threshold);
      
      // Check if threshold is breached
      const isBreached = this.evaluateCondition(
        currentValue,
        threshold.threshold_value,
        threshold.threshold_operator
      );

      if (isBreached) {
        // Check if there's already an open incident for this threshold
        const existingIncident = await this.getOpenIncident(threshold.id);
        
        if (!existingIncident) {
          // Create new incident
          await this.createIncident(threshold, currentValue);
        }
      } else {
        // Check if there's an open incident that should be resolved
        const existingIncident = await this.getOpenIncident(threshold.id);
        if (existingIncident) {
          await this.resolveIncident(existingIncident.id, 'Threshold no longer breached');
        }
      }
      
    } catch (error) {
      console.error(`Failed to evaluate threshold ${threshold.id}:`, error);
    }
  }

  /**
   * Get current KPI value based on threshold configuration
   */
  private async getCurrentKPIValue(threshold: any): Promise<number> {
    const { kpi_name, scope, scope_ref } = threshold;
    
    // Build query based on scope and KPI
    let query = supabase.from('awf_rollup_daily').select('*');
    
    // Apply scope filters
    if (scope === 'world' && scope_ref) {
      query = query.eq('world', scope_ref);
    } else if (scope === 'adventure' && scope_ref) {
      query = query.eq('adventure', scope_ref);
    } else if (scope === 'variation' && scope_ref) {
      query = query.eq('variation', scope_ref);
    }
    
    // Get recent data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    query = query.gte('date', sevenDaysAgo.toISOString().split('T')[0]);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    // Calculate KPI value based on metric name
    return this.calculateKPIMetric(data, kpi_name);
  }

  /**
   * Calculate specific KPI metric from rollup data
   */
  private calculateKPIMetric(data: any[], kpiName: string): number {
    switch (kpiName) {
      case 'p95_latency_ms':
        return this.calculatePercentile(data.map(d => d.p95_latency_ms || 0), 0.95);
      
      case 'retry_rate':
        return this.calculateAverage(data.map(d => d.retry_rate || 0));
      
      case 'fallback_rate':
        return this.calculateAverage(data.map(d => d.fallback_rate || 0));
      
      case 'validator_retry_rate':
        return this.calculateAverage(data.map(d => d.validator_retry_rate || 0));
      
      case 'stuck_rate':
        return this.calculateAverage(data.map(d => d.stuck_rate || 0));
      
      case 'econ_velocity':
        return this.calculateAverage(data.map(d => d.econ_velocity || 0));
      
      case 'craft_success_rate':
        return this.calculateAverage(data.map(d => d.craft_success_rate || 0));
      
      case 'vendor_trade_rate':
        return this.calculateAverage(data.map(d => d.vendor_trade_rate || 0));
      
      case 'party_recruits_rate':
        return this.calculateAverage(data.map(d => d.party_recruits_rate || 0));
      
      case 'dialogue_candidate_avg':
        return this.calculateAverage(data.map(d => d.dialogue_candidate_avg || 0));
      
      case 'romance_consent_rate':
        return this.calculateAverage(data.map(d => d.romance_consent_rate || 0));
      
      case 'event_trigger_rate':
        return this.calculateAverage(data.map(d => d.event_trigger_rate || 0));
      
      default:
        console.warn(`Unknown KPI: ${kpiName}`);
        return 0;
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateCondition(currentValue: number, thresholdValue: number, operator: string): boolean {
    switch (operator) {
      case '>':
        return currentValue > thresholdValue;
      case '<':
        return currentValue < thresholdValue;
      case '>=':
        return currentValue >= thresholdValue;
      case '<=':
        return currentValue <= thresholdValue;
      case '=':
        return Math.abs(currentValue - thresholdValue) < 0.001;
      case '!=':
        return Math.abs(currentValue - thresholdValue) >= 0.001;
      default:
        return false;
    }
  }

  /**
   * Get open incident for threshold
   */
  private async getOpenIncident(thresholdId: string): Promise<any> {
    const { data, error } = await supabase
      .from('awf_incidents')
      .select('*')
      .eq('threshold_id', thresholdId)
      .in('status', ['new', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data;
  }

  /**
   * Create new incident
   */
  private async createIncident(threshold: any, currentValue: number): Promise<void> {
    const incident = {
      threshold_id: threshold.id,
      severity: threshold.severity,
      kpi_name: threshold.kpi_name,
      current_value: currentValue,
      threshold_value: threshold.threshold_value,
      scope: threshold.scope,
      scope_ref: threshold.scope_ref,
      suggested_actions: threshold.suggested_actions || this.generateSuggestedActions(threshold),
      status: 'new',
    };

    const { error } = await supabase
      .from('awf_incidents')
      .insert(incident);

    if (error) throw error;

    // Send alert notifications
    await this.sendAlertNotifications(incident);
    
    console.log(`Created incident for threshold ${threshold.id}: ${threshold.kpi_name} = ${currentValue}`);
  }

  /**
   * Resolve incident
   */
  private async resolveIncident(incidentId: string, resolutionNotes: string): Promise<void> {
    const { error } = await supabase
      .from('awf_incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes,
      })
      .eq('id', incidentId);

    if (error) throw error;
    
    console.log(`Resolved incident ${incidentId}: ${resolutionNotes}`);
  }

  /**
   * Generate suggested actions based on threshold
   */
  private generateSuggestedActions(threshold: any): string[] {
    const actions: string[] = [];
    const { kpi_name, scope } = threshold;
    
    // General actions based on KPI
    switch (kpi_name) {
      case 'p95_latency_ms':
        actions.push('Reduce AWF_MAX_INPUT_TOKENS by 10%');
        actions.push('Enable response caching');
        actions.push('Scale up model instances');
        break;
      
      case 'retry_rate':
      case 'fallback_rate':
        actions.push('Lower AWF_MAX_INPUT_TOKENS by 15%');
        actions.push('Enable soft-lock auto-hints');
        actions.push('Increase tool quota limits');
        break;
      
      case 'validator_retry_rate':
        actions.push('Relax validation rules');
        actions.push('Increase validator timeout');
        actions.push('Enable fallback validation');
        break;
      
      case 'stuck_rate':
        actions.push('Enable soft-lock hints');
        actions.push('Reduce objective complexity');
        actions.push('Add progress checkpoints');
        break;
      
      case 'econ_velocity':
        actions.push('Adjust gold drop rates');
        actions.push('Modify vendor pricing');
        actions.push('Balance item costs');
        break;
      
      case 'craft_success_rate':
        actions.push('Lower craft difficulty');
        actions.push('Increase material availability');
        actions.push('Add craft hints');
        break;
      
      case 'vendor_trade_rate':
        actions.push('Improve vendor accessibility');
        actions.push('Add vendor hints');
        actions.push('Balance item prices');
        break;
      
      case 'party_recruits_rate':
        actions.push('Improve NPC recruitment flow');
        actions.push('Add recruitment hints');
        actions.push('Balance party size limits');
        break;
      
      case 'dialogue_candidate_avg':
        actions.push('Increase dialogue variety');
        actions.push('Add dialogue hints');
        actions.push('Improve conversation flow');
        break;
      
      case 'romance_consent_rate':
        actions.push('Improve consent flow');
        actions.push('Add consent hints');
        actions.push('Clarify romance options');
        break;
      
      case 'event_trigger_rate':
        actions.push('Increase world event frequency');
        actions.push('Add event hints');
        actions.push('Balance event difficulty');
        break;
    }
    
    // Scope-specific actions
    if (scope === 'world') {
      actions.push('Adjust world-specific parameters');
      actions.push('Review world balance settings');
    } else if (scope === 'adventure') {
      actions.push('Modify adventure difficulty');
      actions.push('Adjust adventure pacing');
    } else if (scope === 'variation') {
      actions.push('Tune experiment parameters');
      actions.push('Review variation settings');
    }
    
    return actions;
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(incident: any): Promise<void> {
    const alertMessage = this.formatAlertMessage(incident);
    
    // Send webhook notification
    if (this.webhookUrl) {
      await this.sendWebhookAlert(alertMessage);
    }
    
    // Send email notification
    if (this.emailFrom && this.emailTo) {
      await this.sendEmailAlert(alertMessage);
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(incident: any): string {
    const timestamp = new Date().toISOString();
    const severity = incident.severity.toUpperCase();
    const scope = incident.scope_ref ? `${incident.scope}:${incident.scope_ref}` : incident.scope;
    
    let message = `🚨 ${severity} ALERT - ${incident.kpi_name}\n`;
    message += `📊 Current: ${incident.current_value} | Threshold: ${incident.threshold_value}\n`;
    message += `🎯 Scope: ${scope}\n`;
    message += `⏰ Time: ${timestamp}\n\n`;
    
    if (incident.suggested_actions && incident.suggested_actions.length > 0) {
      message += `💡 Suggested Actions:\n`;
      incident.suggested_actions.forEach((action: string, index: number) => {
        message += `${index + 1}. ${action}\n`;
      });
    }
    
    return message;
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(message: string): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        console.error(`Webhook alert failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Webhook alert error:', error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(message: string): Promise<void> {
    try {
      // This would integrate with your email service (SendGrid, SES, etc.)
      console.log(`Email alert to ${this.emailTo}: ${message}`);
      // Implementation depends on your email service
    } catch (error) {
      console.error('Email alert error:', error);
    }
  }

  /**
   * Get incident statistics
   */
  async getIncidentStats(): Promise<any> {
    const { data, error } = await supabase
      .from('awf_incidents')
      .select('severity, status, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;
    
    const stats = {
      total: data?.length || 0,
      by_severity: {
        warning: data?.filter(i => i.severity === 'warning').length || 0,
        critical: data?.filter(i => i.severity === 'critical').length || 0,
      },
      by_status: {
        new: data?.filter(i => i.status === 'new').length || 0,
        acknowledged: data?.filter(i => i.status === 'acknowledged').length || 0,
        resolved: data?.filter(i => i.status === 'resolved').length || 0,
      },
    };
    
    return stats;
  }

  // Helper methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

export const sloAlerts = new SLOAlerts();
