// Phase 24: Metrics Warehouse ETL Jobs
// Incremental rollup jobs for analytics events and experiments

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rollup job configuration
const ROLLUP_CONFIG = {
  BATCH_SIZE: 10000,
  MAX_RANGE_DAYS: 7,
  K_ANONYMITY_MIN: parseInt(process.env.METRICS_KANON_MIN || '10'),
};

// Event processing schemas
const AnalyticsEventSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  user_id_hash: z.string(),
  event_type: z.string(),
  timestamp: z.string(),
  properties: z.record(z.any()),
  world_ref: z.string().optional(),
  adventure_ref: z.string().optional(),
  locale: z.string().optional(),
  model: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  content_version: z.string().optional(),
});

const RollupDailySchema = z.object({
  date: z.string(),
  world: z.string().optional(),
  adventure: z.string().optional(),
  locale: z.string().optional(),
  model: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  content_version: z.string().optional(),
  turns: z.number(),
  sessions: z.number(),
  p50_latency_ms: z.number().optional(),
  p95_latency_ms: z.number().optional(),
  avg_in_tokens: z.number().optional(),
  avg_out_tokens: z.number().optional(),
  retry_rate: z.number().optional(),
  fallback_rate: z.number().optional(),
  validator_retry_rate: z.number().optional(),
  stuck_rate: z.number().optional(),
  avg_ticks: z.number().optional(),
  tool_calls_per_turn: z.number().optional(),
  acts_per_turn: z.number().optional(),
  choices_per_turn: z.number().optional(),
  softlock_hints_rate: z.number().optional(),
  econ_velocity: z.number().optional(),
  craft_success_rate: z.number().optional(),
  vendor_trade_rate: z.number().optional(),
  party_recruits_rate: z.number().optional(),
  dialogue_candidate_avg: z.number().optional(),
  romance_consent_rate: z.number().optional(),
  event_trigger_rate: z.number().optional(),
});

export class RollupJobs {
  private lastProcessedTimestamp: string | null = null;

  constructor() {
    this.loadWatermark();
  }

  private async loadWatermark(): Promise<void> {
    try {
      const { data } = await supabase
        .from('awf_rollup_daily')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.updated_at) {
        this.lastProcessedTimestamp = data.updated_at;
      }
    } catch (error) {
      console.warn('No existing rollup data found, starting from beginning');
    }
  }

  private async saveWatermark(timestamp: string): Promise<void> {
    this.lastProcessedTimestamp = timestamp;
    // Could store in a separate watermark table if needed
  }

  async runHourlyRollup(): Promise<void> {
    console.log('Starting hourly rollup job...');
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    try {
      // Get analytics events from the last hour
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', oneHourAgo.toISOString())
        .lte('timestamp', now.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      if (!events || events.length === 0) {
        console.log('No events to process for hourly rollup');
        return;
      }

      // Process events in batches
      const batches = this.chunkArray(events, ROLLUP_CONFIG.BATCH_SIZE);
      
      for (const batch of batches) {
        await this.processHourlyBatch(batch, oneHourAgo);
      }

      await this.saveWatermark(now.toISOString());
      console.log(`Hourly rollup completed: ${events.length} events processed`);
      
    } catch (error) {
      console.error('Hourly rollup failed:', error);
      throw error;
    }
  }

  async runDailyRollup(): Promise<void> {
    console.log('Starting daily rollup job...');
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    try {
      // Get analytics events from yesterday
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', startOfDay.toISOString())
        .lt('timestamp', now.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      if (!events || events.length === 0) {
        console.log('No events to process for daily rollup');
        return;
      }

      // Process events in batches
      const batches = this.chunkArray(events, ROLLUP_CONFIG.BATCH_SIZE);
      
      for (const batch of batches) {
        await this.processDailyBatch(batch, startOfDay);
      }

      // Calculate funnels
      await this.calculateFunnels(startOfDay);

      await this.saveWatermark(now.toISOString());
      console.log(`Daily rollup completed: ${events.length} events processed`);
      
    } catch (error) {
      console.error('Daily rollup failed:', error);
      throw error;
    }
  }

  private async processHourlyBatch(events: any[], dateHour: Date): Promise<void> {
    const rollups = this.aggregateEventsByHour(events, dateHour);
    
    for (const rollup of rollups) {
      await this.upsertHourlyRollup(rollup);
    }
  }

  private async processDailyBatch(events: any[], date: Date): Promise<void> {
    const rollups = this.aggregateEventsByDay(events, date);
    
    for (const rollup of rollups) {
      await this.upsertDailyRollup(rollup);
    }
  }

  private aggregateEventsByHour(events: any[], dateHour: Date): any[] {
    const groups = new Map<string, any[]>();
    
    // Group events by dimensions
    for (const event of events) {
      const key = this.getGroupingKey(event, 'hour');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    const rollups: any[] = [];
    
    for (const [key, groupEvents] of groups) {
      const rollup = this.calculateHourlyMetrics(groupEvents, dateHour);
      rollups.push(rollup);
    }

    return rollups;
  }

  private aggregateEventsByDay(events: any[], date: Date): any[] {
    const groups = new Map<string, any[]>();
    
    // Group events by dimensions
    for (const event of events) {
      const key = this.getGroupingKey(event, 'day');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    const rollups: any[] = [];
    
    for (const [key, groupEvents] of groups) {
      const rollup = this.calculateDailyMetrics(groupEvents, date);
      rollups.push(rollup);
    }

    return rollups;
  }

  private getGroupingKey(event: any, granularity: 'hour' | 'day'): string {
    const parts = [
      event.world_ref || 'unknown',
      event.adventure_ref || 'unknown',
      event.locale || 'unknown',
      event.model || 'unknown',
      event.experiment || 'unknown',
      event.variation || 'unknown',
      event.content_version || 'unknown'
    ];
    return parts.join('|');
  }

  private calculateHourlyMetrics(events: any[], dateHour: Date): any {
    const sessions = new Set(events.map(e => e.session_id)).size;
    const turns = events.filter(e => e.event_type === 'turn_complete').length;
    
    // Performance metrics
    const latencyEvents = events.filter(e => e.event_type === 'turn_complete' && e.properties?.latency_ms);
    const latencies = latencyEvents.map(e => e.properties.latency_ms);
    const p95Latency = this.percentile(latencies, 0.95);
    
    // Quality metrics
    const retryEvents = events.filter(e => e.event_type === 'retry');
    const fallbackEvents = events.filter(e => e.event_type === 'fallback');
    const validatorRetryEvents = events.filter(e => e.event_type === 'validator_retry');
    
    const retryRate = turns > 0 ? retryEvents.length / turns : 0;
    const fallbackRate = turns > 0 ? fallbackEvents.length / turns : 0;
    const validatorRetryRate = turns > 0 ? validatorRetryEvents.length / turns : 0;
    
    // Stuck rate (sessions with no progress for N turns)
    const stuckSessions = this.calculateStuckSessions(events);
    const stuckRate = sessions > 0 ? stuckSessions / sessions : 0;

    return {
      date_hour: dateHour.toISOString(),
      world: events[0]?.world_ref,
      adventure: events[0]?.adventure_ref,
      locale: events[0]?.locale,
      model: events[0]?.model,
      experiment: events[0]?.experiment,
      variation: events[0]?.variation,
      turns,
      sessions,
      p95_latency_ms: Math.round(p95Latency),
      retry_rate: Math.round(retryRate * 10000) / 10000,
      fallback_rate: Math.round(fallbackRate * 10000) / 10000,
      stuck_rate: Math.round(stuckRate * 10000) / 10000,
    };
  }

  private calculateDailyMetrics(events: any[], date: Date): any {
    const sessions = new Set(events.map(e => e.session_id)).size;
    const turns = events.filter(e => e.event_type === 'turn_complete').length;
    
    // Performance metrics
    const latencyEvents = events.filter(e => e.event_type === 'turn_complete' && e.properties?.latency_ms);
    const latencies = latencyEvents.map(e => e.properties.latency_ms);
    const p50Latency = this.percentile(latencies, 0.50);
    const p95Latency = this.percentile(latencies, 0.95);
    
    // Token metrics
    const tokenEvents = events.filter(e => e.event_type === 'turn_complete' && e.properties?.tokens);
    const avgInTokens = tokenEvents.length > 0 
      ? tokenEvents.reduce((sum, e) => sum + (e.properties.tokens.in || 0), 0) / tokenEvents.length 
      : 0;
    const avgOutTokens = tokenEvents.length > 0 
      ? tokenEvents.reduce((sum, e) => sum + (e.properties.tokens.out || 0), 0) / tokenEvents.length 
      : 0;
    
    // Quality metrics
    const retryEvents = events.filter(e => e.event_type === 'retry');
    const fallbackEvents = events.filter(e => e.event_type === 'fallback');
    const validatorRetryEvents = events.filter(e => e.event_type === 'validator_retry');
    
    const retryRate = turns > 0 ? retryEvents.length / turns : 0;
    const fallbackRate = turns > 0 ? fallbackEvents.length / turns : 0;
    const validatorRetryRate = turns > 0 ? validatorRetryEvents.length / turns : 0;
    
    // Stuck rate
    const stuckSessions = this.calculateStuckSessions(events);
    const stuckRate = sessions > 0 ? stuckSessions / sessions : 0;
    
    // Game metrics
    const avgTicks = this.calculateAverageTicks(events);
    const toolCallsPerTurn = this.calculateToolCallsPerTurn(events);
    const actsPerTurn = this.calculateActsPerTurn(events);
    const choicesPerTurn = this.calculateChoicesPerTurn(events);
    
    // Narrative health
    const softlockHintsRate = this.calculateSoftlockHintsRate(events);
    const econVelocity = this.calculateEconomyVelocity(events);
    
    // Economy metrics
    const craftSuccessRate = this.calculateCraftSuccessRate(events);
    const vendorTradeRate = this.calculateVendorTradeRate(events);
    const partyRecruitsRate = this.calculatePartyRecruitsRate(events);
    
    // Dialogue metrics
    const dialogueCandidateAvg = this.calculateDialogueCandidateAvg(events);
    const romanceConsentRate = this.calculateRomanceConsentRate(events);
    
    // World simulation
    const eventTriggerRate = this.calculateEventTriggerRate(events);

    return {
      date: date.toISOString().split('T')[0],
      world: events[0]?.world_ref,
      adventure: events[0]?.adventure_ref,
      locale: events[0]?.locale,
      model: events[0]?.model,
      experiment: events[0]?.experiment,
      variation: events[0]?.variation,
      content_version: events[0]?.content_version,
      turns,
      sessions,
      p50_latency_ms: Math.round(p50Latency),
      p95_latency_ms: Math.round(p95Latency),
      avg_in_tokens: Math.round(avgInTokens),
      avg_out_tokens: Math.round(avgOutTokens),
      retry_rate: Math.round(retryRate * 10000) / 10000,
      fallback_rate: Math.round(fallbackRate * 10000) / 10000,
      validator_retry_rate: Math.round(validatorRetryRate * 10000) / 10000,
      stuck_rate: Math.round(stuckRate * 10000) / 10000,
      avg_ticks: Math.round(avgTicks * 100) / 100,
      tool_calls_per_turn: Math.round(toolCallsPerTurn * 100) / 100,
      acts_per_turn: Math.round(actsPerTurn * 100) / 100,
      choices_per_turn: Math.round(choicesPerTurn * 100) / 100,
      softlock_hints_rate: Math.round(softlockHintsRate * 10000) / 10000,
      econ_velocity: Math.round(econVelocity * 100) / 100,
      craft_success_rate: Math.round(craftSuccessRate * 10000) / 10000,
      vendor_trade_rate: Math.round(vendorTradeRate * 10000) / 10000,
      party_recruits_rate: Math.round(partyRecruitsRate * 10000) / 10000,
      dialogue_candidate_avg: Math.round(dialogueCandidateAvg * 100) / 100,
      romance_consent_rate: Math.round(romanceConsentRate * 10000) / 10000,
      event_trigger_rate: Math.round(eventTriggerRate * 10000) / 10000,
    };
  }

  private async calculateFunnels(date: Date): Promise<void> {
    // Get adventure starts and track funnel progression
    const { data: funnelData, error } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('timestamp', date.toISOString())
      .lt('timestamp', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .in('event_type', ['adventure_start', 'first_choice', 'npc_join', 'craft_attempt', 'vendor_trade', 'boss_encounter', 'adventure_complete']);

    if (error) throw error;
    if (!funnelData || funnelData.length === 0) return;

    // Group by adventure and calculate funnel metrics
    const adventureGroups = new Map<string, any[]>();
    
    for (const event of funnelData) {
      const adventure = event.adventure_ref || 'unknown';
      if (!adventureGroups.has(adventure)) {
        adventureGroups.set(adventure, []);
      }
      adventureGroups.get(adventure)!.push(event);
    }

    for (const [adventure, events] of adventureGroups) {
      const funnel = this.calculateFunnelMetrics(events, date, adventure);
      await this.upsertFunnelData(funnel);
    }
  }

  private calculateFunnelMetrics(events: any[], date: Date, adventure: string): any {
    const sessions = new Set(events.map(e => e.session_id));
    const sessionCount = sessions.size;
    
    const startCount = events.filter(e => e.event_type === 'adventure_start').length;
    const firstChoiceCount = events.filter(e => e.event_type === 'first_choice').length;
    const firstNpcJoinCount = events.filter(e => e.event_type === 'npc_join').length;
    const firstCraftCount = events.filter(e => e.event_type === 'craft_attempt').length;
    const firstVendorCount = events.filter(e => e.event_type === 'vendor_trade').length;
    const firstBossCount = events.filter(e => e.event_type === 'boss_encounter').length;
    const completionCount = events.filter(e => e.event_type === 'adventure_complete').length;

    return {
      date: date.toISOString().split('T')[0],
      adventure,
      world: events[0]?.world_ref,
      experiment: events[0]?.experiment,
      variation: events[0]?.variation,
      start_count: startCount,
      first_choice_count: firstChoiceCount,
      first_npc_join_count: firstNpcJoinCount,
      first_craft_count: firstCraftCount,
      first_vendor_count: firstVendorCount,
      first_boss_count: firstBossCount,
      completion_count: completionCount,
      start_to_choice_rate: startCount > 0 ? firstChoiceCount / startCount : 0,
      choice_to_npc_rate: firstChoiceCount > 0 ? firstNpcJoinCount / firstChoiceCount : 0,
      npc_to_craft_rate: firstNpcJoinCount > 0 ? firstCraftCount / firstNpcJoinCount : 0,
      craft_to_vendor_rate: firstCraftCount > 0 ? firstVendorCount / firstCraftCount : 0,
      vendor_to_boss_rate: firstVendorCount > 0 ? firstBossCount / firstVendorCount : 0,
      boss_to_completion_rate: firstBossCount > 0 ? completionCount / firstBossCount : 0,
      overall_completion_rate: startCount > 0 ? completionCount / startCount : 0,
    };
  }

  // Helper methods for metric calculations
  private calculateStuckSessions(events: any[]): number {
    const sessionProgress = new Map<string, { lastProgress: number, stuckTurns: number }>();
    
    for (const event of events) {
      if (event.event_type === 'turn_complete') {
        const sessionId = event.session_id;
        const turnId = event.properties?.turn_id || 0;
        
        if (!sessionProgress.has(sessionId)) {
          sessionProgress.set(sessionId, { lastProgress: turnId, stuckTurns: 0 });
        } else {
          const progress = sessionProgress.get(sessionId)!;
          if (turnId > progress.lastProgress) {
            progress.lastProgress = turnId;
            progress.stuckTurns = 0;
          } else {
            progress.stuckTurns++;
          }
        }
      }
    }
    
    return Array.from(sessionProgress.values()).filter(p => p.stuckTurns >= 10).length;
  }

  private calculateAverageTicks(events: any[]): number {
    const tickEvents = events.filter(e => e.event_type === 'sim_tick');
    return tickEvents.length > 0 ? tickEvents.reduce((sum, e) => sum + (e.properties?.ticks || 0), 0) / tickEvents.length : 0;
  }

  private calculateToolCallsPerTurn(events: any[]): number {
    const turnEvents = events.filter(e => e.event_type === 'turn_complete');
    const toolCallEvents = events.filter(e => e.event_type === 'tool_call');
    return turnEvents.length > 0 ? toolCallEvents.length / turnEvents.length : 0;
  }

  private calculateActsPerTurn(events: any[]): number {
    const turnEvents = events.filter(e => e.event_type === 'turn_complete');
    const actEvents = events.filter(e => e.event_type === 'act');
    return turnEvents.length > 0 ? actEvents.length / turnEvents.length : 0;
  }

  private calculateChoicesPerTurn(events: any[]): number {
    const turnEvents = events.filter(e => e.event_type === 'turn_complete');
    const choiceEvents = events.filter(e => e.event_type === 'choice');
    return turnEvents.length > 0 ? choiceEvents.length / turnEvents.length : 0;
  }

  private calculateSoftlockHintsRate(events: any[]): number {
    const hintEvents = events.filter(e => e.event_type === 'softlock_hint');
    const stuckEvents = events.filter(e => e.event_type === 'stuck');
    return stuckEvents.length > 0 ? hintEvents.length / stuckEvents.length : 0;
  }

  private calculateEconomyVelocity(events: any[]): number {
    const economyEvents = events.filter(e => e.event_type === 'economy_change');
    const goldDeltas = economyEvents.map(e => e.properties?.gold_delta || 0);
    const totalGoldDelta = goldDeltas.reduce((sum, delta) => sum + delta, 0);
    const turns = events.filter(e => e.event_type === 'turn_complete').length;
    return turns > 0 ? totalGoldDelta / (turns / 100) : 0;
  }

  private calculateCraftSuccessRate(events: any[]): number {
    const craftEvents = events.filter(e => e.event_type === 'craft_attempt');
    const successEvents = craftEvents.filter(e => e.properties?.success);
    return craftEvents.length > 0 ? successEvents.length / craftEvents.length : 0;
  }

  private calculateVendorTradeRate(events: any[]): number {
    const tradeEvents = events.filter(e => e.event_type === 'vendor_trade');
    const sessions = new Set(events.map(e => e.session_id)).size;
    return sessions > 0 ? tradeEvents.length / sessions : 0;
  }

  private calculatePartyRecruitsRate(events: any[]): number {
    const recruitEvents = events.filter(e => e.event_type === 'npc_join');
    const sessions = new Set(events.map(e => e.session_id)).size;
    return sessions > 0 ? recruitEvents.length / sessions : 0;
  }

  private calculateDialogueCandidateAvg(events: any[]): number {
    const dialogueEvents = events.filter(e => e.event_type === 'dialogue_candidates');
    const candidateCounts = dialogueEvents.map(e => e.properties?.candidate_count || 0);
    return candidateCounts.length > 0 ? candidateCounts.reduce((sum, count) => sum + count, 0) / candidateCounts.length : 0;
  }

  private calculateRomanceConsentRate(events: any[]): number {
    const romanceEvents = events.filter(e => e.event_type === 'romance_consent');
    const consentEvents = romanceEvents.filter(e => e.properties?.consent);
    return romanceEvents.length > 0 ? consentEvents.length / romanceEvents.length : 0;
  }

  private calculateEventTriggerRate(events: any[]): number {
    const eventTriggers = events.filter(e => e.event_type === 'world_event_trigger');
    const sessions = new Set(events.map(e => e.session_id)).size;
    return sessions > 0 ? eventTriggers.length / sessions : 0;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async upsertHourlyRollup(rollup: any): Promise<void> {
    const { error } = await supabase
      .from('awf_rollup_hourly')
      .upsert(rollup, { 
        onConflict: 'date_hour,world,adventure,locale,model,experiment,variation' 
      });

    if (error) throw error;
  }

  private async upsertDailyRollup(rollup: any): Promise<void> {
    const { error } = await supabase
      .from('awf_rollup_daily')
      .upsert(rollup, { 
        onConflict: 'date,world,adventure,locale,model,experiment,variation,content_version' 
      });

    if (error) throw error;
  }

  private async upsertFunnelData(funnel: any): Promise<void> {
    const { error } = await supabase
      .from('awf_funnels_daily')
      .upsert(funnel, { 
        onConflict: 'date,adventure,world,experiment,variation' 
      });

    if (error) throw error;
  }
}

// Export for use in cron jobs
export const rollupJobs = new RollupJobs();
