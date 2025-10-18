/**
 * Experiment Parameters Service
 * Merges default parameters with experiment variations and validates against guardrails
 */

import { createClient } from '@supabase/supabase-js';
import { ExperimentParams, validateExperimentParams } from './assign.js';

export interface ExperimentConfig {
  key: string;
  name: string;
  status: 'draft' | 'running' | 'stopped';
  startAt?: string;
  stopAt?: string;
  hashBasis: 'session' | 'player';
  allocations: Array<{
    variation: string;
    percent: number;
  }>;
  guardrails: Record<string, any>;
}

export interface ExperimentVariationConfig {
  experimentKey: string;
  variationKey: string;
  params: Record<string, any>;
}

class ExperimentParamsService {
  private supabase: any;
  private experiments: ExperimentConfig[] = [];
  private variations: Map<string, ExperimentVariationConfig[]> = new Map();
  private lastFetch: number = 0;
  private readonly cacheTtlMs = 60000; // 1 minute cache

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Get active experiment parameters for a session
   */
  async getActiveExperimentParams(sessionId: string, playerId?: string): Promise<{
    experimentKey: string | null;
    variationKey: string | null;
    params: ExperimentParams;
    valid: boolean;
    errors: string[];
  }> {
    // Refresh cache if needed
    await this.refreshCacheIfNeeded();

    // Find active experiment
    const activeExperiments = this.experiments.filter(exp => exp.status === 'running');
    
    for (const experiment of activeExperiments) {
      // Check date range
      const now = new Date();
      if (experiment.startAt && new Date(experiment.startAt) > now) {
        continue;
      }
      if (experiment.stopAt && new Date(experiment.stopAt) <= now) {
        continue;
      }

      // Get variation assignment
      const variation = this.assignVariation(experiment, playerId, sessionId);
      if (variation) {
        // Get variation parameters
        const variationConfig = this.variations.get(experiment.key)?.find(
          v => v.variationKey === variation
        );

        if (variationConfig) {
          // Validate parameters against guardrails
          const validation = validateExperimentParams(variationConfig.params, experiment.guardrails);
          
          return {
            experimentKey: experiment.key,
            variationKey: variation,
            params: validation.valid ? variationConfig.params : {},
            valid: validation.valid,
            errors: validation.errors,
          };
        }
      }
    }

    return {
      experimentKey: null,
      variationKey: null,
      params: {},
      valid: true,
      errors: [],
    };
  }

  /**
   * Assign variation using consistent hashing
   */
  private assignVariation(
    experiment: ExperimentConfig,
    playerId: string | undefined,
    sessionId: string
  ): string | null {
    // Validate allocations sum to 100
    const totalPercent = experiment.allocations.reduce((sum, alloc) => sum + alloc.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      console.warn(`[Experiments] Invalid allocations for ${experiment.key}: ${totalPercent}%`);
      return null;
    }

    // Choose hash basis
    const hashInput = experiment.hashBasis === 'player' && playerId ? playerId : sessionId;
    
    // Generate consistent hash
    const hash = this.hashString(hashInput);
    const bucket = (hash % 10000) / 100; // Convert to 0-99.99 range

    // Find which variation this bucket falls into
    let cumulativePercent = 0;
    for (const allocation of experiment.allocations) {
      cumulativePercent += allocation.percent;
      if (bucket < cumulativePercent) {
        return allocation.variation;
      }
    }

    // Fallback to last variation
    return experiment.allocations[experiment.allocations.length - 1]?.variation || null;
  }

  /**
   * Hash a string to a consistent number
   */
  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Refresh cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetch < this.cacheTtlMs) {
      return;
    }

    try {
      // Fetch experiments
      const { data: experiments, error: expError } = await this.supabase
        .from('experiments')
        .select('*');

      if (expError) {
        console.error('[Experiments] Failed to fetch experiments:', expError);
        return;
      }

      this.experiments = experiments || [];

      // Fetch variations
      const { data: variations, error: varError } = await this.supabase
        .from('experiment_variations')
        .select('*');

      if (varError) {
        console.error('[Experiments] Failed to fetch variations:', varError);
        return;
      }

      // Group variations by experiment key
      this.variations.clear();
      for (const variation of variations || []) {
        if (!this.variations.has(variation.experiment_key)) {
          this.variations.set(variation.experiment_key, []);
        }
        this.variations.get(variation.experiment_key)!.push(variation);
      }

      this.lastFetch = now;
      console.log(`[Experiments] Refreshed cache: ${this.experiments.length} experiments, ${variations?.length || 0} variations`);
    } catch (error) {
      console.error('[Experiments] Cache refresh error:', error);
    }
  }

  /**
   * Get all experiments (for admin)
   */
  async getAllExperiments(): Promise<ExperimentConfig[]> {
    await this.refreshCacheIfNeeded();
    return this.experiments;
  }

  /**
   * Get experiment by key
   */
  async getExperiment(key: string): Promise<ExperimentConfig | null> {
    await this.refreshCacheIfNeeded();
    return this.experiments.find(exp => exp.key === key) || null;
  }

  /**
   * Get variations for an experiment
   */
  async getExperimentVariations(experimentKey: string): Promise<ExperimentVariationConfig[]> {
    await this.refreshCacheIfNeeded();
    return this.variations.get(experimentKey) || [];
  }
}

// Singleton instance
export const experimentParamsService = new ExperimentParamsService();

/**
 * Get active experiment parameters for a session
 */
export async function getActiveExperimentParams(
  sessionId: string,
  playerId?: string
): Promise<{
  experimentKey: string | null;
  variationKey: string | null;
  params: ExperimentParams;
  valid: boolean;
  errors: string[];
}> {
  return await experimentParamsService.getActiveExperimentParams(sessionId, playerId);
}


