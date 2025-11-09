/**
 * Turn Metrics Service
 * Handles emission and storage of turn processing metrics
 */

import { supabaseAdmin } from './supabase.js';

export interface TurnMetrics {
  turn_id: string;
  story_id: string;
  tokens_before: number;
  tokens_after: number;
  trims_count: number;
  top_trim_keys: string[];
  model_ms?: number;
  rejects?: Record<string, number>;
  cost_estimate_cents?: number;
}

/**
 * Emit turn metrics after successful turn processing
 */
export async function emitTurnMetrics(metrics: TurnMetrics): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('turn_metrics')
      .insert({
        turn_id: metrics.turn_id,
        story_id: metrics.story_id,
        tokens_before: metrics.tokens_before,
        tokens_after: metrics.tokens_after,
        trims_count: metrics.trims_count,
        top_trim_keys: metrics.top_trim_keys.slice(0, 3), // Ensure max 3
        model_ms: metrics.model_ms || null,
        rejects: metrics.rejects || {},
        cost_estimate_cents: metrics.cost_estimate_cents || null,
      });

    if (error) {
      // Don't fail the turn if metrics emission fails
      console.warn('[TURN_METRICS] Failed to emit metrics:', error);
    }
  } catch (err) {
    // Silently fail - metrics are non-critical
    console.warn('[TURN_METRICS] Error emitting metrics:', err);
  }
}

/**
 * Estimate cost in cents based on tokens and model pricing
 */
export function estimateCost(
  tokensAfter: number,
  model: string = 'gpt-4o-mini'
): number | null {
  // Model pricing per 1K tokens (input/output average)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.6 }, // $0.15/$0.60 per 1M tokens
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4-turbo': { input: 10, output: 30 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  // Use average of input/output pricing
  const avgPricePer1K = (modelPricing.input + modelPricing.output) / 2;
  // Convert to cents
  return Math.round((tokensAfter / 1000) * avgPricePer1K * 100);
}

