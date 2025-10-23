/**
 * Token estimation utilities for prompt budgeting
 */

/**
 * Rough token estimation based on character count
 * This is a simple approximation - for production, consider using tiktoken or similar
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This varies by model and language, but provides a reasonable estimate
  const charCount = text.length;
  const estimatedTokens = Math.ceil(charCount / 4);
  
  return estimatedTokens;
}

/**
 * Calculate token budget deltas for different scenarios
 */
export function calculateBudgetDeltas(
  currentTokens: number,
  maxTokens: number
): {
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical';
} {
  const remaining = maxTokens - currentTokens;
  const percentage = (currentTokens / maxTokens) * 100;
  
  let status: 'safe' | 'warning' | 'critical';
  if (percentage < 70) {
    status = 'safe';
  } else if (percentage < 90) {
    status = 'warning';
  } else {
    status = 'critical';
  }
  
  return {
    remaining,
    percentage,
    status,
  };
}

/**
 * Estimate tokens for different prompt components
 */
export function estimateComponentTokens(components: {
  core?: string;
  rulesets?: string[];
  world?: string;
  entry?: string;
  entryStart?: string;
  npcs?: string[];
}): Record<string, number> {
  const estimates: Record<string, number> = {};
  
  if (components.core) {
    estimates.core = estimateTokens(components.core);
  }
  
  if (components.rulesets) {
    estimates.rulesets = components.rulesets.reduce((sum, ruleset) => 
      sum + estimateTokens(ruleset), 0
    );
  }
  
  if (components.world) {
    estimates.world = estimateTokens(components.world);
  }
  
  if (components.entry) {
    estimates.entry = estimateTokens(components.entry);
  }
  
  if (components.entryStart) {
    estimates.entryStart = estimateTokens(components.entryStart);
  }
  
  if (components.npcs) {
    estimates.npcs = components.npcs.reduce((sum, npc) => 
      sum + estimateTokens(npc), 0
    );
  }
  
  return estimates;
}

/**
 * Check if prompt is within budget constraints
 */
export function isWithinBudget(
  estimatedTokens: number,
  maxTokens: number,
  bufferPercentage: number = 10
): {
  withinBudget: boolean;
  bufferTokens: number;
  recommendedMax: number;
} {
  const bufferTokens = Math.floor(maxTokens * (bufferPercentage / 100));
  const recommendedMax = maxTokens - bufferTokens;
  const withinBudget = estimatedTokens <= recommendedMax;
  
  return {
    withinBudget,
    bufferTokens,
    recommendedMax,
  };
}
