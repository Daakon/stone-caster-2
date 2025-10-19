// Phase 24: KPI Calculator
// Reusable functions for balance and narrative health metrics

import { z } from 'zod';

// KPI calculation schemas
const KPIFiltersSchema = z.object({
  world: z.string().optional(),
  adventure: z.string().optional(),
  locale: z.string().optional(),
  model: z.string().optional(),
  experiment: z.string().optional(),
  variation: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const StuckRateResultSchema = z.object({
  total_sessions: z.number(),
  stuck_sessions: z.number(),
  stuck_rate: z.number(),
  avg_stuck_duration: z.number(),
});

const EconomyVelocityResultSchema = z.object({
  total_gold_delta: z.number(),
  total_turns: z.number(),
  velocity: z.number(),
  avg_gold_per_turn: z.number(),
});

const TTKResultSchema = z.object({
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number(),
  p95: z.number(),
  mean: z.number(),
});

const CraftSuccessResultSchema = z.object({
  total_attempts: z.number(),
  successful_attempts: z.number(),
  success_rate: z.number(),
  avg_difficulty: z.number(),
});

const ArcProgressResultSchema = z.object({
  total_arcs: z.number(),
  completed_arcs: z.number(),
  progress_rate: z.number(),
  avg_progress: z.number(),
});

const ChoiceDiversityResultSchema = z.object({
  total_choices: z.number(),
  unique_choices: z.number(),
  entropy: z.number(),
  diversity_index: z.number(),
});

const DialogueDiversityResultSchema = z.object({
  total_dialogues: z.number(),
  unique_dialogues: z.number(),
  avg_candidates: z.number(),
  diversity_index: z.number(),
});

const RomanceConsentResultSchema = z.object({
  total_romance_events: z.number(),
  consent_events: z.number(),
  consent_rate: z.number(),
  avg_consent_delay: z.number(),
});

export class KPICalculator {
  
  /**
   * Calculate stuck rate - sessions with no progress for N turns
   */
  static calculateStuckRate(data: any[], filters: any = {}): StuckRateResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const sessions = new Map<string, { lastProgress: number, stuckTurns: number, totalTurns: number }>();
    
    for (const record of filteredData) {
      const sessionId = record.session_id;
      const turnId = record.turn_id || 0;
      
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { lastProgress: turnId, stuckTurns: 0, totalTurns: 0 });
      } else {
        const session = sessions.get(sessionId)!;
        session.totalTurns++;
        
        if (turnId > session.lastProgress) {
          session.lastProgress = turnId;
          session.stuckTurns = 0;
        } else {
          session.stuckTurns++;
        }
      }
    }
    
    const sessionData = Array.from(sessions.values());
    const totalSessions = sessionData.length;
    const stuckSessions = sessionData.filter(s => s.stuckTurns >= 10).length;
    const stuckRate = totalSessions > 0 ? stuckSessions / totalSessions : 0;
    const avgStuckDuration = stuckSessions > 0 
      ? sessionData.filter(s => s.stuckTurns >= 10).reduce((sum, s) => sum + s.stuckTurns, 0) / stuckSessions 
      : 0;
    
    return {
      total_sessions: totalSessions,
      stuck_sessions: stuckSessions,
      stuck_rate: Math.round(stuckRate * 10000) / 10000,
      avg_stuck_duration: Math.round(avgStuckDuration * 100) / 100,
    };
  }

  /**
   * Calculate economy velocity - gold delta per 100 turns
   */
  static calculateEconomyVelocity(data: any[], filters: any = {}): EconomyVelocityResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const economyEvents = filteredData.filter(d => d.event_type === 'economy_change');
    const totalGoldDelta = economyEvents.reduce((sum, e) => sum + (e.gold_delta || 0), 0);
    const totalTurns = filteredData.filter(d => d.event_type === 'turn_complete').length;
    
    const velocity = totalTurns > 0 ? totalGoldDelta / (totalTurns / 100) : 0;
    const avgGoldPerTurn = totalTurns > 0 ? totalGoldDelta / totalTurns : 0;
    
    return {
      total_gold_delta: totalGoldDelta,
      total_turns: totalTurns,
      velocity: Math.round(velocity * 100) / 100,
      avg_gold_per_turn: Math.round(avgGoldPerTurn * 100) / 100,
    };
  }

  /**
   * Calculate Time to Kill (TTK) percentiles from sim/sessions
   */
  static calculateTTK(data: any[], filters: any = {}): TTKResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const ttkEvents = filteredData.filter(d => d.event_type === 'combat_resolution' && d.ttk_seconds);
    const ttks = ttkEvents.map(e => e.ttk_seconds);
    
    if (ttks.length === 0) {
      return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, mean: 0 };
    }
    
    const sorted = ttks.sort((a, b) => a - b);
    const mean = ttks.reduce((sum, t) => sum + t, 0) / ttks.length;
    
    return {
      p25: this.percentile(sorted, 0.25),
      p50: this.percentile(sorted, 0.50),
      p75: this.percentile(sorted, 0.75),
      p90: this.percentile(sorted, 0.90),
      p95: this.percentile(sorted, 0.95),
      mean: Math.round(mean * 100) / 100,
    };
  }

  /**
   * Calculate craft success rate by difficulty
   */
  static calculateCraftSuccess(data: any[], filters: any = {}): CraftSuccessResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const craftEvents = filteredData.filter(d => d.event_type === 'craft_attempt');
    const totalAttempts = craftEvents.length;
    const successfulAttempts = craftEvents.filter(e => e.success).length;
    const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
    const avgDifficulty = craftEvents.length > 0 
      ? craftEvents.reduce((sum, e) => sum + (e.difficulty || 0), 0) / craftEvents.length 
      : 0;
    
    return {
      total_attempts: totalAttempts,
      successful_attempts: successfulAttempts,
      success_rate: Math.round(successRate * 10000) / 10000,
      avg_difficulty: Math.round(avgDifficulty * 100) / 100,
    };
  }

  /**
   * Calculate arc progress rate
   */
  static calculateArcProgress(data: any[], filters: any = {}): ArcProgressResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const arcEvents = filteredData.filter(d => d.event_type === 'arc_progress');
    const totalArcs = new Set(arcEvents.map(e => e.arc_id)).size;
    const completedArcs = arcEvents.filter(e => e.completed).length;
    const progressRate = totalArcs > 0 ? completedArcs / totalArcs : 0;
    const avgProgress = arcEvents.length > 0 
      ? arcEvents.reduce((sum, e) => sum + (e.progress || 0), 0) / arcEvents.length 
      : 0;
    
    return {
      total_arcs: totalArcs,
      completed_arcs: completedArcs,
      progress_rate: Math.round(progressRate * 10000) / 10000,
      avg_progress: Math.round(avgProgress * 100) / 100,
    };
  }

  /**
   * Calculate choice diversity using entropy
   */
  static calculateChoiceDiversity(data: any[], filters: any = {}): ChoiceDiversityResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const choiceEvents = filteredData.filter(d => d.event_type === 'choice');
    const totalChoices = choiceEvents.length;
    const uniqueChoices = new Set(choiceEvents.map(e => e.choice_id)).size;
    
    // Calculate entropy
    const choiceCounts = new Map<string, number>();
    for (const event of choiceEvents) {
      const choiceId = event.choice_id;
      choiceCounts.set(choiceId, (choiceCounts.get(choiceId) || 0) + 1);
    }
    
    let entropy = 0;
    for (const count of choiceCounts.values()) {
      const probability = count / totalChoices;
      entropy -= probability * Math.log2(probability);
    }
    
    const diversityIndex = totalChoices > 0 ? uniqueChoices / totalChoices : 0;
    
    return {
      total_choices: totalChoices,
      unique_choices: uniqueChoices,
      entropy: Math.round(entropy * 100) / 100,
      diversity_index: Math.round(diversityIndex * 10000) / 10000,
    };
  }

  /**
   * Calculate dialogue diversity
   */
  static calculateDialogueDiversity(data: any[], filters: any = {}): DialogueDiversityResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const dialogueEvents = filteredData.filter(d => d.event_type === 'dialogue_candidates');
    const totalDialogues = dialogueEvents.length;
    const uniqueDialogues = new Set(dialogueEvents.map(e => e.dialogue_id)).size;
    const avgCandidates = dialogueEvents.length > 0 
      ? dialogueEvents.reduce((sum, e) => sum + (e.candidate_count || 0), 0) / dialogueEvents.length 
      : 0;
    
    const diversityIndex = totalDialogues > 0 ? uniqueDialogues / totalDialogues : 0;
    
    return {
      total_dialogues: totalDialogues,
      unique_dialogues: uniqueDialogues,
      avg_candidates: Math.round(avgCandidates * 100) / 100,
      diversity_index: Math.round(diversityIndex * 10000) / 10000,
    };
  }

  /**
   * Calculate romance consent compliance
   */
  static calculateRomanceConsent(data: any[], filters: any = {}): RomanceConsentResultSchema {
    const filteredData = this.applyFilters(data, filters);
    
    const romanceEvents = filteredData.filter(d => d.event_type === 'romance_consent');
    const totalRomanceEvents = romanceEvents.length;
    const consentEvents = romanceEvents.filter(e => e.consent).length;
    const consentRate = totalRomanceEvents > 0 ? consentEvents / totalRomanceEvents : 0;
    
    const consentDelays = romanceEvents
      .filter(e => e.consent && e.consent_delay)
      .map(e => e.consent_delay);
    const avgConsentDelay = consentDelays.length > 0 
      ? consentDelays.reduce((sum, delay) => sum + delay, 0) / consentDelays.length 
      : 0;
    
    return {
      total_romance_events: totalRomanceEvents,
      consent_events: consentEvents,
      consent_rate: Math.round(consentRate * 10000) / 10000,
      avg_consent_delay: Math.round(avgConsentDelay * 100) / 100,
    };
  }

  /**
   * Calculate completion rate per adventure
   */
  static calculateCompletionRate(data: any[], filters: any = {}): number {
    const filteredData = this.applyFilters(data, filters);
    
    const startEvents = filteredData.filter(d => d.event_type === 'adventure_start');
    const completeEvents = filteredData.filter(d => d.event_type === 'adventure_complete');
    
    const startCount = startEvents.length;
    const completeCount = completeEvents.length;
    
    return startCount > 0 ? completeCount / startCount : 0;
  }

  /**
   * Calculate vendor margin analysis
   */
  static calculateVendorMargins(data: any[], filters: any = {}): any {
    const filteredData = this.applyFilters(data, filters);
    
    const vendorEvents = filteredData.filter(d => d.event_type === 'vendor_trade');
    const totalTrades = vendorEvents.length;
    const totalValue = vendorEvents.reduce((sum, e) => sum + (e.trade_value || 0), 0);
    const totalMargin = vendorEvents.reduce((sum, e) => sum + (e.margin || 0), 0);
    
    return {
      total_trades: totalTrades,
      total_value: totalValue,
      avg_trade_value: totalTrades > 0 ? totalValue / totalTrades : 0,
      total_margin: totalMargin,
      avg_margin: totalTrades > 0 ? totalMargin / totalTrades : 0,
      margin_rate: totalValue > 0 ? totalMargin / totalValue : 0,
    };
  }

  /**
   * Calculate party event rates
   */
  static calculatePartyEvents(data: any[], filters: any = {}): any {
    const filteredData = this.applyFilters(data, filters);
    
    const recruitEvents = filteredData.filter(d => d.event_type === 'npc_join');
    const dismissEvents = filteredData.filter(d => d.event_type === 'npc_dismiss');
    const delegateEvents = filteredData.filter(d => d.event_type === 'delegated_check');
    const successEvents = delegateEvents.filter(e => e.success);
    
    const totalSessions = new Set(filteredData.map(d => d.session_id)).size;
    
    return {
      total_sessions: totalSessions,
      recruits: recruitEvents.length,
      dismissals: dismissEvents.length,
      delegated_checks: delegateEvents.length,
      successful_checks: successEvents.length,
      recruit_rate: totalSessions > 0 ? recruitEvents.length / totalSessions : 0,
      dismissal_rate: totalSessions > 0 ? dismissEvents.length / totalSessions : 0,
      check_success_rate: delegateEvents.length > 0 ? successEvents.length / delegateEvents.length : 0,
    };
  }

  /**
   * Calculate world simulation metrics
   */
  static calculateWorldSimMetrics(data: any[], filters: any = {}): any {
    const filteredData = this.applyFilters(data, filters);
    
    const eventTriggers = filteredData.filter(d => d.event_type === 'world_event_trigger');
    const weatherEvents = filteredData.filter(d => d.event_type === 'weather_change');
    const regionEvents = filteredData.filter(d => d.event_type === 'region_drift');
    
    const totalSessions = new Set(filteredData.map(d => d.session_id)).size;
    
    // Weather distribution
    const weatherCounts = new Map<string, number>();
    for (const event of weatherEvents) {
      const weather = event.weather_type;
      weatherCounts.set(weather, (weatherCounts.get(weather) || 0) + 1);
    }
    
    // Region drift analysis
    const regionDrifts = regionEvents.map(e => e.drift_amount || 0);
    const avgDrift = regionDrifts.length > 0 
      ? regionDrifts.reduce((sum, drift) => sum + drift, 0) / regionDrifts.length 
      : 0;
    
    return {
      total_sessions: totalSessions,
      event_trigger_rate: totalSessions > 0 ? eventTriggers.length / totalSessions : 0,
      weather_distribution: Object.fromEntries(weatherCounts),
      avg_region_drift: Math.round(avgDrift * 100) / 100,
      total_weather_changes: weatherEvents.length,
      total_region_drifts: regionEvents.length,
    };
  }

  // Helper methods
  private static applyFilters(data: any[], filters: any): any[] {
    return data.filter(record => {
      if (filters.world && record.world !== filters.world) return false;
      if (filters.adventure && record.adventure !== filters.adventure) return false;
      if (filters.locale && record.locale !== filters.locale) return false;
      if (filters.model && record.model !== filters.model) return false;
      if (filters.experiment && record.experiment !== filters.experiment) return false;
      if (filters.variation && record.variation !== filters.variation) return false;
      if (filters.dateFrom && record.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && record.timestamp > filters.dateTo) return false;
      return true;
    });
  }

  private static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

export type KPIFilters = z.infer<typeof KPIFiltersSchema>;
export type StuckRateResult = z.infer<typeof StuckRateResultSchema>;
export type EconomyVelocityResult = z.infer<typeof EconomyVelocityResultSchema>;
export type TTKResult = z.infer<typeof TTKResultSchema>;
export type CraftSuccessResult = z.infer<typeof CraftSuccessResultSchema>;
export type ArcProgressResult = z.infer<typeof ArcProgressResultSchema>;
export type ChoiceDiversityResult = z.infer<typeof ChoiceDiversityResultSchema>;
export type DialogueDiversityResult = z.infer<typeof DialogueDiversityResultSchema>;
export type RomanceConsentResult = z.infer<typeof RomanceConsentResultSchema>;
