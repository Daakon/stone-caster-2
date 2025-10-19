/**
 * Experiments Framework - Deterministic Assignment
 * Provides consistent hashing to assign users to experiment variations
 */

export interface Experiment {
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

export interface ExperimentVariation {
  experimentKey: string;
  variationKey: string;
  params: Record<string, any>;
}

export interface ExperimentParams {
  maxOutputTokens?: number;
  maxActs?: number;
  toolMaxCalls?: number;
  timeAdvanceTicks?: number;
  txtSentenceCap?: number;
  maxChoices?: number;
  [key: string]: any;
}

/**
 * Deterministic assignment function
 * Uses consistent hashing to assign users to experiment variations
 */
export function assignVariation(opts: {
  experiment: Experiment;
  playerId?: string;
  sessionId: string;
}): string | null {
  const { experiment, playerId, sessionId } = opts;

  // Check if experiment is running
  if (experiment.status !== 'running') {
    return null;
  }

  // Check if experiment is within date range
  const now = new Date();
  if (experiment.startAt && new Date(experiment.startAt) > now) {
    return null;
  }
  if (experiment.stopAt && new Date(experiment.stopAt) <= now) {
    return null;
  }

  // Validate allocations sum to 100
  const totalPercent = experiment.allocations.reduce((sum, alloc) => sum + alloc.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    console.warn(`[Experiments] Invalid allocations for ${experiment.key}: ${totalPercent}%`);
    return null;
  }

  // Choose hash basis
  const hashInput = experiment.hashBasis === 'player' && playerId ? playerId : sessionId;
  
  // Generate consistent hash
  const hash = hashString(hashInput);
  const bucket = (hash % 10000) / 100; // Convert to 0-99.99 range

  // Find which variation this bucket falls into
  let cumulativePercent = 0;
  for (const allocation of experiment.allocations) {
    cumulativePercent += allocation.percent;
    if (bucket < cumulativePercent) {
      return allocation.variation;
    }
  }

  // Fallback to last variation (should not happen with valid allocations)
  return experiment.allocations[experiment.allocations.length - 1]?.variation || null;
}

/**
 * Hash a string to a consistent number
 */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get experiment assignment for a session
 */
export async function getExperimentAssignment(
  sessionId: string,
  playerId?: string,
  experiments: Experiment[] = []
): Promise<{
  experimentKey: string | null;
  variationKey: string | null;
  params: ExperimentParams;
}> {
  // Find the first running experiment that assigns this user
  for (const experiment of experiments) {
    const variation = assignVariation({ experiment, playerId, sessionId });
    if (variation) {
      return {
        experimentKey: experiment.key,
        variationKey: variation,
        params: {}, // Will be filled by getActiveExperimentParams
      };
    }
  }

  return {
    experimentKey: null,
    variationKey: null,
    params: {},
  };
}

/**
 * Validate experiment parameters against guardrails
 */
export function validateExperimentParams(
  params: ExperimentParams,
  guardrails: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check maxActs
  if (params.maxActs !== undefined) {
    const maxActs = guardrails.maxActs || 8;
    if (params.maxActs > maxActs) {
      errors.push(`maxActs (${params.maxActs}) exceeds guardrail (${maxActs})`);
    }
    if (params.maxActs < 1) {
      errors.push(`maxActs (${params.maxActs}) must be at least 1`);
    }
  }

  // Check maxChoices
  if (params.maxChoices !== undefined) {
    const maxChoices = guardrails.maxChoices || 5;
    if (params.maxChoices > maxChoices) {
      errors.push(`maxChoices (${params.maxChoices}) exceeds guardrail (${maxChoices})`);
    }
    if (params.maxChoices < 1) {
      errors.push(`maxChoices (${params.maxChoices}) must be at least 1`);
    }
  }

  // Check txtSentenceCap
  if (params.txtSentenceCap !== undefined) {
    const txtSentenceCap = guardrails.txtSentenceCap || 4;
    if (params.txtSentenceCap > txtSentenceCap) {
      errors.push(`txtSentenceCap (${params.txtSentenceCap}) exceeds guardrail (${txtSentenceCap})`);
    }
    if (params.txtSentenceCap < 2) {
      errors.push(`txtSentenceCap (${params.txtSentenceCap}) must be at least 2`);
    }
  }

  // Check toolMaxCalls
  if (params.toolMaxCalls !== undefined) {
    const toolMaxCalls = guardrails.toolMaxCalls || 10;
    if (params.toolMaxCalls > toolMaxCalls) {
      errors.push(`toolMaxCalls (${params.toolMaxCalls}) exceeds guardrail (${toolMaxCalls})`);
    }
    if (params.toolMaxCalls < 1) {
      errors.push(`toolMaxCalls (${params.toolMaxCalls}) must be at least 1`);
    }
  }

  // Check maxOutputTokens
  if (params.maxOutputTokens !== undefined) {
    const maxOutputTokens = guardrails.maxOutputTokens || 2000;
    if (params.maxOutputTokens > maxOutputTokens) {
      errors.push(`maxOutputTokens (${params.maxOutputTokens}) exceeds guardrail (${maxOutputTokens})`);
    }
    if (params.maxOutputTokens < 100) {
      errors.push(`maxOutputTokens (${params.maxOutputTokens}) must be at least 100`);
    }
  }

  // Check timeAdvanceTicks
  if (params.timeAdvanceTicks !== undefined) {
    if (params.timeAdvanceTicks < 1) {
      errors.push(`timeAdvanceTicks (${params.timeAdvanceTicks}) must be at least 1`);
    }
    if (params.timeAdvanceTicks > 10) {
      errors.push(`timeAdvanceTicks (${params.timeAdvanceTicks}) must be at most 10`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


