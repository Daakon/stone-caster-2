/**
 * Telemetry Read Service
 * Aggregates and queries turn metrics
 */

import { supabaseAdmin } from './supabase.js';

export interface TelemetrySummary {
  totalTurns: number;
  avgTokensAfter: number;
  avgLatencyMs: number;
  trimsRate: number; // % of turns with trims > 0
  topTrimKeys: Array<{ key: string; count: number }>;
  rejectsByReason: Array<{ reason: string; count: number }>;
  // Phase 7 enhancements
  trimsRateBySlot: Array<{ slot: string; trimRate: number; count: number }>;
  p95TokensAfter: number;
  topCostlySlots: Array<{ slot: string; avgTokens: number }>;
}

export interface TimeseriesPoint {
  t: string; // ISO timestamp
  value: number;
}

/**
 * Get telemetry summary for a date range
 */
export async function getTelemetrySummary(
  from: Date,
  to: Date,
  storyId?: string
): Promise<TelemetrySummary> {
  let query = supabaseAdmin
    .from('turn_metrics')
    .select('*')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString());

  if (storyId) {
    query = query.eq('story_id', storyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query telemetry: ${error.message}`);
  }

  const metrics = data || [];
  const totalTurns = metrics.length;

  if (totalTurns === 0) {
    return {
      totalTurns: 0,
      avgTokensAfter: 0,
      avgLatencyMs: 0,
      trimsRate: 0,
      topTrimKeys: [],
      rejectsByReason: [],
    };
  }

  // Calculate averages
  const avgTokensAfter = metrics.reduce((sum, m) => sum + (m.tokens_after || 0), 0) / totalTurns;
  const avgLatencyMs = metrics
    .filter(m => m.model_ms !== null)
    .reduce((sum, m, _, arr) => sum + (m.model_ms || 0) / arr.length, 0);

  // Calculate trims rate
  const turnsWithTrims = metrics.filter(m => (m.trims_count || 0) > 0).length;
  const trimsRate = (turnsWithTrims / totalTurns) * 100;

  // Aggregate top trim keys
  const trimKeyCounts: Record<string, number> = {};
  for (const m of metrics) {
    if (m.top_trim_keys && Array.isArray(m.top_trim_keys)) {
      for (const key of m.top_trim_keys) {
        trimKeyCounts[key] = (trimKeyCounts[key] || 0) + 1;
      }
    }
  }
  const topTrimKeys = Object.entries(trimKeyCounts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Aggregate rejects by reason
  const rejectCounts: Record<string, number> = {};
  for (const m of metrics) {
    if (m.rejects && typeof m.rejects === 'object') {
      for (const [reason, count] of Object.entries(m.rejects)) {
        rejectCounts[reason] = (rejectCounts[reason] || 0) + (typeof count === 'number' ? count : 0);
      }
    }
  }
  const rejectsByReason = Object.entries(rejectCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Phase 7: Enhanced metrics from prompt_snapshots
  // Get snapshots with budget_report for slot-level analysis
  let snapshotsQuery = supabaseAdmin
    .from('prompt_snapshots')
    .select('game_id, budget_report, created_at')
    .not('budget_report', 'is', null)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString());

  if (storyId) {
    snapshotsQuery = snapshotsQuery.eq('game_id', storyId);
  }

  const { data: snapshots } = await snapshotsQuery;

  // Trims rate by slot
  const slotTrimCounts: Record<string, { total: number; trimmed: number }> = {};
  const slotTokenCounts: Record<string, { sum: number; count: number }> = {};
  const tokensAfterByStory: Record<string, number[]> = {};

  if (snapshots) {
    for (const snapshot of snapshots) {
      const budgetReport = snapshot.budget_report as any;
      
      // Track tokensAfter per story for P95
      if (snapshot.game_id && budgetReport?.after) {
        if (!tokensAfterByStory[snapshot.game_id]) {
          tokensAfterByStory[snapshot.game_id] = [];
        }
        tokensAfterByStory[snapshot.game_id].push(budgetReport.after);
      }

      // Track trims by slot
      if (budgetReport?.trims && Array.isArray(budgetReport.trims)) {
        for (const trim of budgetReport.trims) {
          if (trim.key) {
            if (!slotTrimCounts[trim.key]) {
              slotTrimCounts[trim.key] = { total: 0, trimmed: 0 };
            }
            slotTrimCounts[trim.key].trimmed += 1;
          }
        }
      }

      // Track token usage by slot (from sections if available)
      if (budgetReport?.sections && Array.isArray(budgetReport.sections)) {
        for (const section of budgetReport.sections) {
          if (section.key && section.tokensAfter !== undefined) {
            if (!slotTokenCounts[section.key]) {
              slotTokenCounts[section.key] = { sum: 0, count: 0 };
            }
            slotTokenCounts[section.key].sum += section.tokensAfter;
            slotTokenCounts[section.key].count += 1;
          }
        }
      }
    }

    // Count total occurrences per slot (from all snapshots)
    for (const snapshot of snapshots) {
      const budgetReport = snapshot.budget_report as any;
      if (budgetReport?.sections && Array.isArray(budgetReport.sections)) {
        for (const section of budgetReport.sections) {
          if (section.key) {
            if (!slotTrimCounts[section.key]) {
              slotTrimCounts[section.key] = { total: 0, trimmed: 0 };
            }
            slotTrimCounts[section.key].total += 1;
          }
        }
      }
    }
  }

  // Calculate trim rates by slot
  const trimsRateBySlot = Object.entries(slotTrimCounts)
    .map(([slot, stats]) => ({
      slot,
      trimRate: stats.total > 0 ? (stats.trimmed / stats.total) * 100 : 0,
      count: stats.total,
    }))
    .filter(s => s.count >= 5) // Only slots with 5+ occurrences
    .sort((a, b) => b.trimRate - a.trimRate)
    .slice(0, 10);

  // Calculate P95 tokensAfter (across all stories)
  const allTokensAfter = Object.values(tokensAfterByStory).flat();
  const p95TokensAfter = allTokensAfter.length > 0
    ? (() => {
        const sorted = [...allTokensAfter].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.95) - 1;
        return sorted[index] || 0;
      })()
    : 0;

  // Top costly slots by average tokens
  const topCostlySlots = Object.entries(slotTokenCounts)
    .map(([slot, stats]) => ({
      slot,
      avgTokens: stats.count > 0 ? Math.round(stats.sum / stats.count) : 0,
    }))
    .sort((a, b) => b.avgTokens - a.avgTokens)
    .slice(0, 5);

  return {
    totalTurns,
    avgTokensAfter: Math.round(avgTokensAfter),
    avgLatencyMs: Math.round(avgLatencyMs),
    trimsRate: Math.round(trimsRate * 100) / 100,
    topTrimKeys,
    rejectsByReason,
    trimsRateBySlot,
    p95TokensAfter,
    topCostlySlots,
  };
}

/**
 * Get timeseries data for a metric
 */
export async function getTelemetryTimeseries(
  metric: 'tokens_after' | 'latency_ms',
  bucket: 'hour' | 'day',
  from: Date,
  to: Date,
  storyId?: string
): Promise<TimeseriesPoint[]> {
  let query = supabaseAdmin
    .from('turn_metrics')
    .select('created_at,' + (metric === 'tokens_after' ? 'tokens_after' : 'model_ms'))
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: true });

  if (storyId) {
    query = query.eq('story_id', storyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query timeseries: ${error.message}`);
  }

  const metrics = data || [];
  
  // Bucket by hour or day
  const buckets: Record<string, { sum: number; count: number }> = {};
  
  for (const m of metrics) {
    const date = new Date(m.created_at);
    let bucketKey: string;
    
    if (bucket === 'hour') {
      bucketKey = date.toISOString().slice(0, 13) + ':00:00Z'; // YYYY-MM-DDTHH:00:00Z
    } else {
      bucketKey = date.toISOString().slice(0, 10) + 'T00:00:00Z'; // YYYY-MM-DDT00:00:00Z
    }
    
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { sum: 0, count: 0 };
    }
    
    const value = metric === 'tokens_after' 
      ? (m.tokens_after || 0)
      : (m.model_ms || 0);
    
    buckets[bucketKey].sum += value;
    buckets[bucketKey].count += 1;
  }

  // Convert to points
  return Object.entries(buckets)
    .map(([t, { sum, count }]) => ({
      t,
      value: Math.round(sum / count),
    }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

