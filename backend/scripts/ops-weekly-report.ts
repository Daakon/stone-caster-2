// Phase 25: Weekly Operations Report Script
// Generates comprehensive weekly operations report with metrics, incidents, and recommendations

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Environment configuration
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const reportOutputDir = process.env.OPS_REPORT_OUTPUT_DIR || './reports';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Report data schemas
const IncidentSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  scope: z.string(),
  metric: z.string(),
  observed_value: z.number(),
  threshold_value: z.number(),
  status: z.enum(['open', 'investigating', 'resolved', 'closed']),
  suggested_actions: z.array(z.string()).optional(),
});

const RateLimitSchema = z.object({
  id: z.string(),
  scope: z.string(),
  key: z.string(),
  window_seconds: z.number(),
  max_requests: z.number(),
  burst_allowance: z.number(),
  updated_at: z.string(),
});

const QuotaSchema = z.object({
  id: z.string(),
  user_hash: z.string().optional(),
  session_id: z.string().optional(),
  daily_turn_cap: z.number(),
  tool_cap: z.number(),
  bytes_cap: z.number(),
  resets_at: z.string(),
});

interface WeeklyMetrics {
  period: {
    start: string;
    end: string;
  };
  incidents: {
    total: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    avg_resolution_time_hours: number;
    top_incidents: Array<{
      id: string;
      severity: string;
      scope: string;
      metric: string;
      observed_value: number;
      threshold_value: number;
      status: string;
    }>;
  };
  rate_limits: {
    total_limits: number;
    by_scope: Record<string, number>;
    top_limited: Array<{
      scope: string;
      key: string;
      current_count: number;
      max_requests: number;
    }>;
  };
  quotas: {
    total_quotas: number;
    by_type: {
      turns: { total_cap: number; total_used: number; avg_usage: number };
      tools: { total_cap: number; total_used: number; avg_usage: number };
      bytes: { total_cap: number; total_used: number; avg_usage: number };
    };
    top_users: Array<{
      user_hash: string;
      session_id: string;
      turns_usage: number;
      tools_usage: number;
      bytes_usage: number;
    }>;
  };
  budget: {
    current_month: string;
    budget_usd: number;
    spent_usd: number;
    remaining_usd: number;
    spend_ratio: number;
    status: 'healthy' | 'warning' | 'critical';
    daily_average: number;
    projected_month_end: number;
  };
  performance: {
    avg_response_time_ms: number;
    p95_response_time_ms: number;
    error_rate_percent: number;
    uptime_percent: number;
    throughput_rps: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    timeline: string;
  }>;
}

class WeeklyOpsReporter {
  private startDate: Date;
  private endDate: Date;

  constructor(startDate?: Date) {
    // Default to last 7 days if no start date provided
    this.endDate = new Date();
    this.startDate = startDate || new Date(this.endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  async generateReport(): Promise<WeeklyMetrics> {
    console.log(`Generating weekly ops report for ${this.startDate.toISOString()} to ${this.endDate.toISOString()}`);

    // Fetch all data in parallel
    const [
      incidents,
      rateLimits,
      quotas,
      budgetData,
      performanceData
    ] = await Promise.all([
      this.fetchIncidents(),
      this.fetchRateLimits(),
      this.fetchQuotas(),
      this.fetchBudgetData(),
      this.fetchPerformanceData()
    ]);

    // Process and aggregate data
    const metrics: WeeklyMetrics = {
      period: {
        start: this.startDate.toISOString(),
        end: this.endDate.toISOString()
      },
      incidents: this.processIncidents(incidents),
      rate_limits: this.processRateLimits(rateLimits),
      quotas: this.processQuotas(quotas),
      budget: this.processBudgetData(budgetData),
      performance: this.processPerformanceData(performanceData),
      recommendations: this.generateRecommendations(incidents, rateLimits, quotas, budgetData, performanceData)
    };

    return metrics;
  }

  private async fetchIncidents() {
    const { data, error } = await supabase
      .from('awf_incidents')
      .select('*')
      .gte('created_at', this.startDate.toISOString())
      .lte('created_at', this.endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch incidents: ${error.message}`);
    return data || [];
  }

  private async fetchRateLimits() {
    const { data, error } = await supabase
      .from('awf_rate_limits')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch rate limits: ${error.message}`);
    return data || [];
  }

  private async fetchQuotas() {
    const { data, error } = await supabase
      .from('awf_quotas')
      .select('*')
      .order('resets_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch quotas: ${error.message}`);
    return data || [];
  }

  private async fetchBudgetData() {
    // This would typically come from a budget tracking system
    // For now, we'll simulate the data
    return {
      current_month: this.endDate.toISOString().slice(0, 7), // YYYY-MM format
      budget_usd: 10000,
      spent_usd: 7500,
      remaining_usd: 2500,
      spend_ratio: 0.75,
      status: 'warning' as const,
      daily_average: 250,
      projected_month_end: 10000
    };
  }

  private async fetchPerformanceData() {
    // This would typically come from monitoring systems
    // For now, we'll simulate the data
    return {
      avg_response_time_ms: 450,
      p95_response_time_ms: 1200,
      error_rate_percent: 0.15,
      uptime_percent: 99.85,
      throughput_rps: 150
    };
  }

  private processIncidents(incidents: any[]) {
    const bySeverity = incidents.reduce((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = incidents.reduce((acc, incident) => {
      acc[incident.status] = (acc[incident.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average resolution time (simplified)
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
    const avgResolutionTime = resolvedIncidents.length > 0 
      ? resolvedIncidents.reduce((sum, incident) => {
          const created = new Date(incident.created_at);
          const resolved = new Date(incident.updated_at || incident.created_at);
          return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
        }, 0) / resolvedIncidents.length
      : 0;

    const topIncidents = incidents
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 5)
      .map(incident => ({
        id: incident.id,
        severity: incident.severity,
        scope: incident.scope,
        metric: incident.metric,
        observed_value: incident.observed_value,
        threshold_value: incident.threshold_value,
        status: incident.status
      }));

    return {
      total: incidents.length,
      by_severity: bySeverity,
      by_status: byStatus,
      avg_resolution_time_hours: avgResolutionTime,
      top_incidents: topIncidents
    };
  }

  private processRateLimits(rateLimits: any[]) {
    const byScope = rateLimits.reduce((acc, limit) => {
      acc[limit.scope] = (acc[limit.scope] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Simulate current usage (in real implementation, this would come from Redis)
    const topLimited = rateLimits.slice(0, 5).map(limit => ({
      scope: limit.scope,
      key: limit.key,
      current_count: Math.floor(Math.random() * limit.max_requests),
      max_requests: limit.max_requests
    }));

    return {
      total_limits: rateLimits.length,
      by_scope: byScope,
      top_limited: topLimited
    };
  }

  private processQuotas(quotas: any[]) {
    const byType = {
      turns: {
        total_cap: quotas.reduce((sum, q) => sum + q.daily_turn_cap, 0),
        total_used: quotas.reduce((sum, q) => sum + (q.daily_turn_cap * 0.7), 0), // Simulate 70% usage
        avg_usage: 0.7
      },
      tools: {
        total_cap: quotas.reduce((sum, q) => sum + q.tool_cap, 0),
        total_used: quotas.reduce((sum, q) => sum + (q.tool_cap * 0.5), 0), // Simulate 50% usage
        avg_usage: 0.5
      },
      bytes: {
        total_cap: quotas.reduce((sum, q) => sum + q.bytes_cap, 0),
        total_used: quotas.reduce((sum, q) => sum + (q.bytes_cap * 0.3), 0), // Simulate 30% usage
        avg_usage: 0.3
      }
    };

    const topUsers = quotas.slice(0, 5).map(quota => ({
      user_hash: quota.user_hash || 'anonymous',
      session_id: quota.session_id || 'unknown',
      turns_usage: quota.daily_turn_cap * 0.7,
      tools_usage: quota.tool_cap * 0.5,
      bytes_usage: quota.bytes_cap * 0.3
    }));

    return {
      total_quotas: quotas.length,
      by_type: byType,
      top_users: topUsers
    };
  }

  private processBudgetData(budgetData: any) {
    return {
      current_month: budgetData.current_month,
      budget_usd: budgetData.budget_usd,
      spent_usd: budgetData.spent_usd,
      remaining_usd: budgetData.remaining_usd,
      spend_ratio: budgetData.spend_ratio,
      status: budgetData.status,
      daily_average: budgetData.daily_average,
      projected_month_end: budgetData.projected_month_end
    };
  }

  private processPerformanceData(performanceData: any) {
    return {
      avg_response_time_ms: performanceData.avg_response_time_ms,
      p95_response_time_ms: performanceData.p95_response_time_ms,
      error_rate_percent: performanceData.error_rate_percent,
      uptime_percent: performanceData.uptime_percent,
      throughput_rps: performanceData.throughput_rps
    };
  }

  private generateRecommendations(
    incidents: any[],
    rateLimits: any[],
    quotas: any[],
    budgetData: any,
    performanceData: any
  ): Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    timeline: string;
  }> {
    const recommendations = [];

    // Budget recommendations
    if (budgetData.spend_ratio > 0.8) {
      recommendations.push({
        priority: 'high' as const,
        category: 'Budget',
        title: 'Budget Alert: High Spending',
        description: `Current spending is at ${(budgetData.spend_ratio * 100).toFixed(1)}% of monthly budget. Consider implementing cost controls.`,
        impact: 'Prevent budget overrun',
        effort: 'medium' as const,
        timeline: '1-2 weeks'
      });
    }

    // Incident recommendations
    const criticalIncidents = incidents.filter(i => i.severity === 'critical');
    if (criticalIncidents.length > 0) {
      recommendations.push({
        priority: 'high' as const,
        category: 'Reliability',
        title: 'Critical Incidents Detected',
        description: `${criticalIncidents.length} critical incidents occurred this week. Review root causes and implement preventive measures.`,
        impact: 'Improve system reliability',
        effort: 'high' as const,
        timeline: '2-4 weeks'
      });
    }

    // Performance recommendations
    if (performanceData.p95_response_time_ms > 1000) {
      recommendations.push({
        priority: 'medium' as const,
        category: 'Performance',
        title: 'High Response Times',
        description: `P95 response time is ${performanceData.p95_response_time_ms}ms, exceeding target of 1000ms.`,
        impact: 'Improve user experience',
        effort: 'medium' as const,
        timeline: '2-3 weeks'
      });
    }

    // Rate limiting recommendations
    if (rateLimits.length > 100) {
      recommendations.push({
        priority: 'low' as const,
        category: 'Rate Limiting',
        title: 'High Rate Limit Count',
        description: `${rateLimits.length} active rate limits detected. Consider consolidating or optimizing.`,
        impact: 'Simplify operations',
        effort: 'low' as const,
        timeline: '1 week'
      });
    }

    return recommendations;
  }

  async saveReport(metrics: WeeklyMetrics): Promise<string> {
    const reportDate = this.endDate.toISOString().slice(0, 10);
    const filename = `weekly-ops-report-${reportDate}.json`;
    const filepath = path.join(reportOutputDir, filename);

    // Ensure output directory exists
    await fs.mkdir(reportOutputDir, { recursive: true });

    // Save JSON report
    await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(metrics);
    const htmlFilename = `weekly-ops-report-${reportDate}.html`;
    const htmlFilepath = path.join(reportOutputDir, htmlFilename);
    await fs.writeFile(htmlFilepath, htmlReport);

    console.log(`Weekly ops report saved to: ${filepath}`);
    console.log(`HTML report saved to: ${htmlFilepath}`);

    return filepath;
  }

  private generateHtmlReport(metrics: WeeklyMetrics): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Operations Report - ${metrics.period.start} to ${metrics.period.end}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metric-card { background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin: 10px 0; }
        .metric-value { font-size: 2em; font-weight: bold; color: #333; }
        .metric-label { color: #666; font-size: 0.9em; }
        .critical { color: #d32f2f; }
        .warning { color: #f57c00; }
        .healthy { color: #388e3c; }
        .recommendations { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .recommendation { margin: 10px 0; padding: 10px; border-left: 4px solid #2196f3; background: #fff; }
        .high-priority { border-left-color: #d32f2f; }
        .medium-priority { border-left-color: #f57c00; }
        .low-priority { border-left-color: #388e3c; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Weekly Operations Report</h1>
        <p><strong>Period:</strong> ${metrics.period.start} to ${metrics.period.end}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
    </div>

    <div class="metric-card">
        <h2>Incidents Summary</h2>
        <div class="metric-value">${metrics.incidents.total}</div>
        <div class="metric-label">Total Incidents</div>
        <table>
            <tr><th>Severity</th><th>Count</th></tr>
            ${Object.entries(metrics.incidents.by_severity).map(([severity, count]) => 
              `<tr><td>${severity}</td><td>${count}</td></tr>`
            ).join('')}
        </table>
        <p><strong>Average Resolution Time:</strong> ${metrics.incidents.avg_resolution_time_hours.toFixed(1)} hours</p>
    </div>

    <div class="metric-card">
        <h2>Budget Status</h2>
        <div class="metric-value ${metrics.budget.status === 'critical' ? 'critical' : metrics.budget.status === 'warning' ? 'warning' : 'healthy'}">
            ${(metrics.budget.spend_ratio * 100).toFixed(1)}%
        </div>
        <div class="metric-label">Budget Used</div>
        <p><strong>Spent:</strong> $${metrics.budget.spent_usd.toLocaleString()} / $${metrics.budget.budget_usd.toLocaleString()}</p>
        <p><strong>Remaining:</strong> $${metrics.budget.remaining_usd.toLocaleString()}</p>
        <p><strong>Daily Average:</strong> $${metrics.budget.daily_average.toLocaleString()}</p>
    </div>

    <div class="metric-card">
        <h2>Performance Metrics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
            <tr>
                <td>Average Response Time</td>
                <td>${metrics.performance.avg_response_time_ms}ms</td>
                <td class="${metrics.performance.avg_response_time_ms > 500 ? 'warning' : 'healthy'}">
                    ${metrics.performance.avg_response_time_ms > 500 ? 'High' : 'Good'}
                </td>
            </tr>
            <tr>
                <td>P95 Response Time</td>
                <td>${metrics.performance.p95_response_time_ms}ms</td>
                <td class="${metrics.performance.p95_response_time_ms > 1000 ? 'warning' : 'healthy'}">
                    ${metrics.performance.p95_response_time_ms > 1000 ? 'High' : 'Good'}
                </td>
            </tr>
            <tr>
                <td>Error Rate</td>
                <td>${metrics.performance.error_rate_percent}%</td>
                <td class="${metrics.performance.error_rate_percent > 0.5 ? 'critical' : 'healthy'}">
                    ${metrics.performance.error_rate_percent > 0.5 ? 'High' : 'Good'}
                </td>
            </tr>
            <tr>
                <td>Uptime</td>
                <td>${metrics.performance.uptime_percent}%</td>
                <td class="${metrics.performance.uptime_percent < 99.9 ? 'warning' : 'healthy'}">
                    ${metrics.performance.uptime_percent < 99.9 ? 'Low' : 'Good'}
                </td>
            </tr>
        </table>
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        ${metrics.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}-priority">
                <h3>${rec.title}</h3>
                <p><strong>Category:</strong> ${rec.category} | <strong>Priority:</strong> ${rec.priority} | <strong>Timeline:</strong> ${rec.timeline}</p>
                <p><strong>Description:</strong> ${rec.description}</p>
                <p><strong>Impact:</strong> ${rec.impact}</p>
                <p><strong>Effort:</strong> ${rec.effort}</p>
            </div>
        `).join('')}
    </div>

    <div class="metric-card">
        <h2>Rate Limits</h2>
        <div class="metric-value">${metrics.rate_limits.total_limits}</div>
        <div class="metric-label">Active Rate Limits</div>
        <table>
            <tr><th>Scope</th><th>Count</th></tr>
            ${Object.entries(metrics.rate_limits.by_scope).map(([scope, count]) => 
              `<tr><td>${scope}</td><td>${count}</td></tr>`
            ).join('')}
        </table>
    </div>

    <div class="metric-card">
        <h2>Quotas</h2>
        <div class="metric-value">${metrics.quotas.total_quotas}</div>
        <div class="metric-label">Active Quotas</div>
        <table>
            <tr><th>Type</th><th>Total Cap</th><th>Used</th><th>Usage %</th></tr>
            <tr>
                <td>Turns</td>
                <td>${metrics.quotas.by_type.turns.total_cap.toLocaleString()}</td>
                <td>${metrics.quotas.by_type.turns.total_used.toLocaleString()}</td>
                <td>${(metrics.quotas.by_type.turns.avg_usage * 100).toFixed(1)}%</td>
            </tr>
            <tr>
                <td>Tools</td>
                <td>${metrics.quotas.by_type.tools.total_cap.toLocaleString()}</td>
                <td>${metrics.quotas.by_type.tools.total_used.toLocaleString()}</td>
                <td>${(metrics.quotas.by_type.tools.avg_usage * 100).toFixed(1)}%</td>
            </tr>
            <tr>
                <td>Bytes</td>
                <td>${metrics.quotas.by_type.bytes.total_cap.toLocaleString()}</td>
                <td>${metrics.quotas.by_type.bytes.total_used.toLocaleString()}</td>
                <td>${(metrics.quotas.by_type.bytes.avg_usage * 100).toFixed(1)}%</td>
            </tr>
        </table>
    </div>
</body>
</html>
    `;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const startDateArg = args.find(arg => arg.startsWith('--start='));
  const startDate = startDateArg ? new Date(startDateArg.split('=')[1]) : undefined;

  try {
    const reporter = new WeeklyOpsReporter(startDate);
    const metrics = await reporter.generateReport();
    const reportPath = await reporter.saveReport(metrics);

    console.log('Weekly operations report generated successfully!');
    console.log(`Report saved to: ${reportPath}`);
    console.log(`\nSummary:`);
    console.log(`- Incidents: ${metrics.incidents.total}`);
    console.log(`- Budget Status: ${(metrics.budget.spend_ratio * 100).toFixed(1)}% used`);
    console.log(`- Performance: ${metrics.performance.avg_response_time_ms}ms avg response time`);
    console.log(`- Recommendations: ${metrics.recommendations.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Failed to generate weekly ops report:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { WeeklyOpsReporter };
