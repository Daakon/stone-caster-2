/**
 * Pacing Governor
 * Computes pacing state based on turn metrics, resource deltas, and behavior profiles
 */

export interface PacingInputs {
  turnCadence: number; // Turns per minute
  recentActs: Array<{
    type: string;
    success: boolean;
    timestamp: string;
  }>;
  resourceDeltas: Record<string, number>;
  npcBehaviorProfile: {
    tone: string;
    trustThreshold: number;
    riskTolerance: number;
  };
  analyticsHeuristics: {
    retryRate: number;
    fallbackRate: number;
    avgLatency: number;
  };
  sessionId: string;
  turnId: number;
}

export interface PacingState {
  tempo: 'slow' | 'normal' | 'fast';
  tension: number; // 0-100
  difficulty: 'story' | 'easy' | 'normal' | 'hard';
  directive: string; // ≤ 80 tokens
}

export interface PacingMetrics {
  successRate: number;
  resourceStability: number;
  npcEngagement: number;
  playerFrustration: number;
}

export class PacingGovernor {
  private readonly maxDirectiveLength = 80;
  private readonly tensionThresholds = {
    low: 30,
    medium: 60,
    high: 80,
  };

  /**
   * Compute pacing state from inputs
   */
  computePacingState(inputs: PacingInputs): PacingState {
    const metrics = this.computeMetrics(inputs);
    const tempo = this.computeTempo(inputs, metrics);
    const tension = this.computeTension(inputs, metrics);
    const difficulty = this.computeDifficulty(inputs, metrics);
    const directive = this.generateDirective(tempo, tension, difficulty, inputs);

    return {
      tempo,
      tension,
      difficulty,
      directive,
    };
  }

  /**
   * Compute pacing metrics from inputs
   */
  private computeMetrics(inputs: PacingInputs): PacingMetrics {
    // Calculate success rate from recent acts
    const successfulActs = inputs.recentActs.filter(act => act.success).length;
    const successRate = inputs.recentActs.length > 0 
      ? successfulActs / inputs.recentActs.length 
      : 0.5;

    // Calculate resource stability
    const resourceValues = Object.values(inputs.resourceDeltas);
    const resourceStability = resourceValues.length > 0
      ? 1 - (Math.abs(resourceValues.reduce((a, b) => a + b, 0)) / resourceValues.length)
      : 1;

    // Calculate NPC engagement based on behavior profile
    const npcEngagement = this.calculateNpcEngagement(inputs.npcBehaviorProfile);

    // Calculate player frustration from analytics
    const playerFrustration = this.calculatePlayerFrustration(inputs.analyticsHeuristics);

    return {
      successRate,
      resourceStability,
      npcEngagement,
      playerFrustration,
    };
  }

  /**
   * Compute tempo based on inputs and metrics
   */
  private computeTempo(inputs: PacingInputs, metrics: PacingMetrics): 'slow' | 'normal' | 'fast' {
    // Base tempo from turn cadence
    let tempoScore = 0;
    
    if (inputs.turnCadence < 2) {
      tempoScore -= 2; // Slow tempo
    } else if (inputs.turnCadence > 5) {
      tempoScore += 2; // Fast tempo
    }

    // Adjust based on success rate
    if (metrics.successRate > 0.8) {
      tempoScore += 1; // Speed up if doing well
    } else if (metrics.successRate < 0.3) {
      tempoScore -= 1; // Slow down if struggling
    }

    // Adjust based on NPC engagement
    if (metrics.npcEngagement > 0.7) {
      tempoScore += 1; // Speed up if NPCs are engaged
    } else if (metrics.npcEngagement < 0.3) {
      tempoScore -= 1; // Slow down if NPCs are disengaged
    }

    // Adjust based on player frustration
    if (metrics.playerFrustration > 0.7) {
      tempoScore -= 2; // Slow down if frustrated
    } else if (metrics.playerFrustration < 0.3) {
      tempoScore += 1; // Speed up if not frustrated
    }

    // Apply deterministic randomness
    const seed = this.generateSeed(inputs.sessionId, inputs.turnId);
    const randomFactor = this.deterministicRandom(seed) * 2 - 1; // -1 to 1
    tempoScore += randomFactor;

    if (tempoScore <= -1) return 'slow';
    if (tempoScore >= 1) return 'fast';
    return 'normal';
  }

  /**
   * Compute tension level
   */
  private computeTension(inputs: PacingInputs, metrics: PacingMetrics): number {
    let tension = 50; // Base tension

    // Adjust based on success rate
    tension += (1 - metrics.successRate) * 30; // Higher tension if failing

    // Adjust based on resource stability
    tension += (1 - metrics.resourceStability) * 20; // Higher tension if resources unstable

    // Adjust based on NPC behavior
    if (inputs.npcBehaviorProfile.tone === 'aggressive') {
      tension += 20;
    } else if (inputs.npcBehaviorProfile.tone === 'cautious') {
      tension += 10;
    } else if (inputs.npcBehaviorProfile.tone === 'friendly') {
      tension -= 10;
    }

    // Adjust based on analytics
    tension += inputs.analyticsHeuristics.retryRate * 20;
    tension += inputs.analyticsHeuristics.fallbackRate * 15;

    // Apply deterministic randomness
    const seed = this.generateSeed(inputs.sessionId, inputs.turnId + 1);
    const randomFactor = this.deterministicRandom(seed) * 10 - 5; // -5 to 5
    tension += randomFactor;

    return Math.max(0, Math.min(100, Math.round(tension)));
  }

  /**
   * Compute difficulty level
   */
  private computeDifficulty(inputs: PacingInputs, metrics: PacingMetrics): 'story' | 'easy' | 'normal' | 'hard' {
    let difficultyScore = 0;

    // Base difficulty from success rate
    if (metrics.successRate > 0.8) {
      difficultyScore += 2; // Increase difficulty if doing well
    } else if (metrics.successRate < 0.3) {
      difficultyScore -= 2; // Decrease difficulty if struggling
    }

    // Adjust based on player frustration
    if (metrics.playerFrustration > 0.7) {
      difficultyScore -= 3; // Lower difficulty if frustrated
    } else if (metrics.playerFrustration < 0.3) {
      difficultyScore += 1; // Increase difficulty if not frustrated
    }

    // Adjust based on NPC behavior
    if (inputs.npcBehaviorProfile.riskTolerance > 70) {
      difficultyScore += 1; // Higher difficulty with risk-tolerant NPCs
    } else if (inputs.npcBehaviorProfile.riskTolerance < 30) {
      difficultyScore -= 1; // Lower difficulty with cautious NPCs
    }

    // Apply deterministic randomness
    const seed = this.generateSeed(inputs.sessionId, inputs.turnId + 2);
    const randomFactor = this.deterministicRandom(seed) * 2 - 1; // -1 to 1
    difficultyScore += randomFactor;

    if (difficultyScore <= -2) return 'story';
    if (difficultyScore <= -1) return 'easy';
    if (difficultyScore >= 2) return 'hard';
    return 'normal';
  }

  /**
   * Generate pacing directive
   */
  private generateDirective(
    tempo: string,
    tension: number,
    difficulty: string,
    inputs: PacingInputs
  ): string {
    const directives: string[] = [];

    // Tempo directives
    if (tempo === 'slow') {
      directives.push('Take time to explore and consider options carefully.');
    } else if (tempo === 'fast') {
      directives.push('Quick decisions and actions are needed now.');
    } else {
      directives.push('Maintain steady progress with measured actions.');
    }

    // Tension directives
    if (tension > 80) {
      directives.push('High tension - every action matters.');
    } else if (tension > 60) {
      directives.push('Building tension - choose actions wisely.');
    } else if (tension < 30) {
      directives.push('Low tension - good time for exploration.');
    }

    // Difficulty directives
    if (difficulty === 'story') {
      directives.push('Focus on narrative and character development.');
    } else if (difficulty === 'hard') {
      directives.push('Challenging situation - think strategically.');
    }

    // Combine directives and ensure length limit
    let directive = directives.join(' ');
    if (directive.length > this.maxDirectiveLength) {
      directive = directive.substring(0, this.maxDirectiveLength - 3) + '...';
    }

    return directive;
  }

  /**
   * Calculate NPC engagement level
   */
  private calculateNpcEngagement(behaviorProfile: any): number {
    let engagement = 0.5; // Base engagement

    // Adjust based on tone
    switch (behaviorProfile.tone) {
      case 'friendly': engagement += 0.3; break;
      case 'curious': engagement += 0.2; break;
      case 'cautious': engagement -= 0.1; break;
      case 'cold': engagement -= 0.2; break;
      case 'aggressive': engagement += 0.1; break;
    }

    // Adjust based on trust threshold
    if (behaviorProfile.trustThreshold < 30) {
      engagement += 0.2; // High trust = high engagement
    } else if (behaviorProfile.trustThreshold > 70) {
      engagement -= 0.2; // Low trust = low engagement
    }

    return Math.max(0, Math.min(1, engagement));
  }

  /**
   * Calculate player frustration level
   */
  private calculatePlayerFrustration(analytics: any): number {
    let frustration = 0;

    // High retry rate indicates frustration
    frustration += analytics.retryRate * 0.5;

    // High fallback rate indicates frustration
    frustration += analytics.fallbackRate * 0.3;

    // High latency can indicate frustration
    if (analytics.avgLatency > 5000) {
      frustration += 0.2;
    }

    return Math.max(0, Math.min(1, frustration));
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(sessionId: string, turnId: number): number {
    const input = `${sessionId}-${turnId}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
  }

  /**
   * Deterministic random number generator
   */
  private deterministicRandom(seed: number): number {
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    
    const nextSeed = (a * seed + c) % m;
    return nextSeed / m;
  }
}

// Singleton instance
export const pacingGovernor = new PacingGovernor();


