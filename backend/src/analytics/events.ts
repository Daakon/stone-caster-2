/**
 * Analytics Event Pipeline
 * Captures key AWF turn metrics and content signals with PII-safe payloads
 */

import { createClient } from '@supabase/supabase-js';
import { configService } from '../config/index.js';

export interface AnalyticsEvent {
  sessionId: string;
  playerHash: string;
  worldRef: string;
  adventureRef: string;
  locale: string;
  experimentKey?: string;
  variationKey?: string;
  metrics: {
    turnLatencyMs: number;
    modelLatencyMs: number;
    bundleTokens: number;
    outputTokens: number;
    retries: number;
    fallbacks: number;
    toolCalls: number;
    actsCount: number;
    choicesCount: number;
    timeAdvanceTicks: number;
    invalidVariation?: boolean;
    // NPC personality metrics
    npcTraitShiftAvg?: number;
    npcPersonalityMerges?: number;
    npcBehaviorCalls?: number;
    npcTraitChanges?: Record<string, number>;
    [key: string]: any;
  };
}

export interface AnalyticsBatch {
  events: AnalyticsEvent[];
  flushTime: number;
}

class AnalyticsEventPipeline {
  private supabase: any;
  private batch: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly enabled: boolean;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.batchSize = parseInt(process.env.ANALYTICS_BATCH_MAX || '500');
    this.flushIntervalMs = parseInt(process.env.ANALYTICS_BATCH_MS || '3000');
    this.enabled = process.env.ANALYTICS_ENABLED !== 'false';
    
    // Setup graceful shutdown
    process.on('SIGINT', () => this.flush());
    process.on('SIGTERM', () => this.flush());
    process.on('beforeExit', () => this.flush());
  }

  /**
   * Track a turn event with metrics
   */
  async trackTurnEvent(event: AnalyticsEvent): Promise<void> {
    if (process.env.ANALYTICS_ENABLED === 'false') {
      return;
    }

    // Hash player ID for privacy
    const hashedPlayerId = this.hashPlayerId(event.playerHash);
    
    const analyticsEvent = {
      ...event,
      playerHash: hashedPlayerId,
    };

    this.batch.push(analyticsEvent);

    // Flush if batch is full
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    } else if (!this.flushTimer) {
      // Set up timer for next flush
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  /**
   * Flush current batch to database
   */
  async flush(): Promise<void> {
    if (this.batch.length === 0) {
      return;
    }

    try {
      const eventsToFlush = [...this.batch];
      this.batch = [];

      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }

      const { error } = await this.supabase
        .from('analytics_events')
        .insert(eventsToFlush.map(event => ({
          session_id: event.sessionId,
          player_hash: event.playerHash,
          world_ref: event.worldRef,
          adventure_ref: event.adventureRef,
          locale: event.locale,
          experiment_key: event.experimentKey,
          variation_key: event.variationKey,
          metrics: event.metrics,
        })));

      if (error) {
        console.error('[Analytics] Failed to flush events:', error);
        // Re-add events to batch for retry
        this.batch.unshift(...eventsToFlush);
      } else {
        console.log(`[Analytics] Flushed ${eventsToFlush.length} events`);
      }
    } catch (error) {
      console.error('[Analytics] Flush error:', error);
    }
  }

  /**
   * Hash player ID for privacy (simple hash for demo)
   */
  private hashPlayerId(playerId: string): string {
    // Simple hash function - in production, use crypto.createHash('sha256')
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      const char = playerId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get analytics stats
   */
  async getStats(): Promise<{
    batchSize: number;
    flushIntervalMs: number;
    enabled: boolean;
    pendingEvents: number;
  }> {
    return {
      batchSize: this.batchSize,
      flushIntervalMs: this.flushIntervalMs,
      enabled: this.enabled,
      pendingEvents: this.batch.length,
    };
  }
}

// Singleton instance
export const analyticsPipeline = new AnalyticsEventPipeline();

/**
 * Track a turn event with comprehensive metrics
 */
export async function trackTurnEvent(
  sessionId: string,
  playerId: string,
  worldRef: string,
  adventureRef: string,
  locale: string,
  metrics: Partial<AnalyticsEvent['metrics']>,
  experimentKey?: string,
  variationKey?: string
): Promise<void> {
  const event: AnalyticsEvent = {
    sessionId,
    playerHash: playerId,
    worldRef,
    adventureRef,
    locale,
    experimentKey,
    variationKey,
    metrics: {
      turnLatencyMs: 0,
      modelLatencyMs: 0,
      bundleTokens: 0,
      outputTokens: 0,
      retries: 0,
      fallbacks: 0,
      toolCalls: 0,
      actsCount: 0,
      choicesCount: 0,
      timeAdvanceTicks: 0,
      ...metrics,
    },
  };

  await analyticsPipeline.trackTurnEvent(event);
}

/**
 * Track experiment exposure
 */
export async function trackExperimentExposure(
  sessionId: string,
  playerId: string,
  worldRef: string,
  adventureRef: string,
  locale: string,
  experimentKey: string,
  variationKey: string,
  invalidVariation: boolean = false
): Promise<void> {
  await trackTurnEvent(
    sessionId,
    playerId,
    worldRef,
    adventureRef,
    locale,
    {
      invalidVariation,
      experimentExposure: true,
    },
    experimentKey,
    variationKey
  );
}

/**
 * Track NPC personality trait changes
 */
export async function trackNpcTraitChanges(
  sessionId: string,
  playerId: string,
  worldRef: string,
  adventureRef: string,
  locale: string,
  traitChanges: Record<string, number>,
  averageShift: number
): Promise<void> {
  await trackTurnEvent(
    sessionId,
    playerId,
    worldRef,
    adventureRef,
    locale,
    {
      npcTraitShiftAvg: averageShift,
      npcTraitChanges: traitChanges,
    }
  );
}

/**
 * Track NPC personality merge events
 */
export async function trackNpcPersonalityMerge(
  sessionId: string,
  playerId: string,
  worldRef: string,
  adventureRef: string,
  locale: string,
  mergeCount: number
): Promise<void> {
  await trackTurnEvent(
    sessionId,
    playerId,
    worldRef,
    adventureRef,
    locale,
    {
      npcPersonalityMerges: mergeCount,
    }
  );
}

/**
 * Track NPC behavior policy calls
 */
export async function trackNpcBehaviorCall(
  sessionId: string,
  playerId: string,
  worldRef: string,
  adventureRef: string,
  locale: string,
  behaviorCalls: number
): Promise<void> {
  await trackTurnEvent(
    sessionId,
    playerId,
    worldRef,
    adventureRef,
    locale,
    {
      npcBehaviorCalls: behaviorCalls,
    }
  );
}
