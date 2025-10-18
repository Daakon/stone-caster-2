// Phase 28: LiveOps Remote Configuration System
// Safety mechanisms and dry-run impact estimation

import { LiveOpsConfig, LiveOpsConfigSchema } from './levers-schema';
import { LiveOpsConfigResolver, ResolverContext } from './config-resolver';

export interface SafetyBounds {
  min: number;
  max: number;
  critical: boolean;
  description: string;
}

export interface ImpactEstimate {
  turns: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  coverage: {
    quest_graph: number;
    dialogue: number;
    mechanics: number;
    economy: number;
    world_sim: number;
    mods: number;
  };
  oracles: {
    soft_locks: number;
    budget_violations: number;
    validator_retries: number;
    fallback_engagements: number;
    safety_violations: number;
    performance_violations: number;
    integrity_violations: number;
  };
  behavior: {
    avg_turns_to_completion: number;
    exploration_efficiency: number;
    dialogue_engagement_rate: number;
    economic_activity_rate: number;
    risk_taking_rate: number;
  };
}

export interface DryRunResult {
  success: boolean;
  impact: ImpactEstimate;
  warnings: string[];
  criticalIssues: string[];
  recommendations: string[];
  confidence: number; // 0-1
}

export class LiveOpsSafetyMechanisms {
  private resolver: LiveOpsConfigResolver;
  private bounds: Map<string, SafetyBounds>;

  constructor(resolver: LiveOpsConfigResolver) {
    this.resolver = resolver;
    this.bounds = this.initializeBounds();
  }

  /**
   * Initialize safety bounds for all levers
   */
  private initializeBounds(): Map<string, SafetyBounds> {
    const bounds = new Map<string, SafetyBounds>();

    // Token bounds
    bounds.set('AWF_MAX_INPUT_TOKENS', {
      min: 1000,
      max: 12000,
      critical: true,
      description: 'Input token limit affects all model calls'
    });

    bounds.set('AWF_MAX_OUTPUT_TOKENS', {
      min: 500,
      max: 8000,
      critical: true,
      description: 'Output token limit affects response generation'
    });

    bounds.set('AWF_INPUT_TOKEN_MULTIPLIER', {
      min: 0.1,
      max: 2.0,
      critical: true,
      description: 'Input token multiplier affects cost and performance'
    });

    bounds.set('AWF_OUTPUT_TOKEN_MULTIPLIER', {
      min: 0.1,
      max: 2.0,
      critical: true,
      description: 'Output token multiplier affects cost and performance'
    });

    // Pacing bounds
    bounds.set('QUEST_PACING_TEMPO_MULTIPLIER', {
      min: 0.1,
      max: 3.0,
      critical: false,
      description: 'Quest pacing affects player experience'
    });

    bounds.set('SOFT_LOCK_HINT_FREQUENCY', {
      min: 0.0,
      max: 1.0,
      critical: false,
      description: 'Soft-lock hint frequency affects player assistance'
    });

    // Economy bounds
    bounds.set('DROP_RATE_COMMON_MULTIPLIER', {
      min: 0.0,
      max: 5.0,
      critical: false,
      description: 'Common drop rate affects economy balance'
    });

    bounds.set('DROP_RATE_LEGENDARY_MULTIPLIER', {
      min: 0.0,
      max: 10.0,
      critical: true,
      description: 'Legendary drop rate affects game balance significantly'
    });

    bounds.set('VENDOR_MARGIN_MIN', {
      min: 0.0,
      max: 0.5,
      critical: false,
      description: 'Minimum vendor margin affects economy'
    });

    bounds.set('VENDOR_MARGIN_MAX', {
      min: 0.1,
      max: 0.8,
      critical: false,
      description: 'Maximum vendor margin affects economy'
    });

    // World sim bounds
    bounds.set('WORLD_EVENT_RATE_MULTIPLIER', {
      min: 0.0,
      max: 5.0,
      critical: false,
      description: 'World event rate affects simulation complexity'
    });

    bounds.set('WEATHER_VOLATILITY_MULTIPLIER', {
      min: 0.0,
      max: 3.0,
      critical: false,
      description: 'Weather volatility affects world simulation'
    });

    // Dialogue bounds
    bounds.set('DIALOGUE_CANDIDATE_CAP', {
      min: 1,
      max: 20,
      critical: false,
      description: 'Dialogue candidate cap affects performance'
    });

    bounds.set('ROMANCE_COOLDOWN_TURNS', {
      min: 1,
      max: 100,
      critical: false,
      description: 'Romance cooldown affects relationship pacing'
    });

    // Party bounds
    bounds.set('PARTY_MAX_ACTIVE_MEMBERS', {
      min: 1,
      max: 8,
      critical: false,
      description: 'Party size affects complexity and performance'
    });

    return bounds;
  }

  /**
   * Validate config against safety bounds
   */
  validateConfig(config: Partial<LiveOpsConfig>): {
    valid: boolean;
    violations: Array<{
      field: string;
      value: any;
      bounds: SafetyBounds;
      severity: 'warning' | 'error' | 'critical';
    }>;
  } {
    const violations: Array<{
      field: string;
      value: any;
      bounds: SafetyBounds;
      severity: 'warning' | 'error' | 'critical';
    }> = [];

    for (const [field, value] of Object.entries(config)) {
      const bounds = this.bounds.get(field);
      if (!bounds || value === undefined) continue;

      let severity: 'warning' | 'error' | 'critical' = 'warning';
      
      if (value < bounds.min || value > bounds.max) {
        if (bounds.critical) {
          severity = 'critical';
        } else if (Math.abs(value - bounds.min) > bounds.max * 0.5 || 
                   Math.abs(value - bounds.max) > bounds.max * 0.5) {
          severity = 'error';
        }

        violations.push({
          field,
          value,
          bounds,
          severity
        });
      }
    }

    return {
      valid: violations.filter(v => v.severity === 'critical').length === 0,
      violations
    };
  }

  /**
   * Perform dry-run impact estimation using autoplay simulation
   */
  async estimateImpact(
    context: ResolverContext,
    proposedConfig: Partial<LiveOpsConfig>,
    simulationTurns: number = 50
  ): Promise<DryRunResult> {
    try {
      // Get current config
      const currentResolved = await this.resolver.resolveEffectiveConfig(context);
      
      // Create proposed config by merging
      const proposedMerged = { ...currentResolved.config, ...proposedConfig };
      
      // Validate proposed config
      const validation = this.validateConfig(proposedMerged);
      if (!validation.valid) {
        return {
          success: false,
          impact: this.getDefaultImpact(),
          warnings: [],
          criticalIssues: validation.violations
            .filter(v => v.severity === 'critical')
            .map(v => `${v.field}: ${v.value} is outside safe bounds (${v.bounds.min}-${v.bounds.max})`),
          recommendations: [],
          confidence: 0
        };
      }

      // Simulate impact using autoplay policies
      const impact = await this.simulateImpact(
        currentResolved.config,
        proposedMerged,
        simulationTurns
      );

      // Generate warnings and recommendations
      const warnings = this.generateWarnings(proposedConfig, impact);
      const recommendations = this.generateRecommendations(proposedConfig, impact);
      const criticalIssues = this.identifyCriticalIssues(proposedConfig, impact);

      // Calculate confidence based on simulation quality
      const confidence = this.calculateConfidence(impact, simulationTurns);

      return {
        success: true,
        impact,
        warnings,
        criticalIssues,
        recommendations,
        confidence
      };
    } catch (error) {
      return {
        success: false,
        impact: this.getDefaultImpact(),
        warnings: [],
        criticalIssues: [`Simulation failed: ${error.message}`],
        recommendations: [],
        confidence: 0
      };
    }
  }

  /**
   * Simulate impact using autoplay policies
   */
  private async simulateImpact(
    currentConfig: LiveOpsConfig,
    proposedConfig: LiveOpsConfig,
    turns: number
  ): Promise<ImpactEstimate> {
    // This would integrate with the autoplay system from Phase 27
    // For now, we'll provide a mock simulation based on config differences
    
    const diffs = this.calculateConfigDiffs(currentConfig, proposedConfig);
    
    // Simulate based on key changes
    const impact: ImpactEstimate = {
      turns,
      latency: {
        p50: 1000 + (diffs.tokenMultiplier || 0) * 200,
        p95: 2000 + (diffs.tokenMultiplier || 0) * 400,
        p99: 5000 + (diffs.tokenMultiplier || 0) * 1000
      },
      tokens: {
        input: 4000 * (proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER || 1.0),
        output: 2000 * (proposedConfig.AWF_OUTPUT_TOKEN_MULTIPLIER || 1.0),
        total: 6000 * ((proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER || 1.0) + (proposedConfig.AWF_OUTPUT_TOKEN_MULTIPLIER || 1.0)) / 2
      },
      coverage: {
        quest_graph: 0.8 + (diffs.pacingMultiplier || 0) * 0.1,
        dialogue: 0.7 + (diffs.dialogueMultiplier || 0) * 0.1,
        mechanics: 0.6 + (diffs.mechanicsMultiplier || 0) * 0.1,
        economy: 0.9 + (diffs.economyMultiplier || 0) * 0.05,
        world_sim: 0.75 + (diffs.worldSimMultiplier || 0) * 0.1,
        mods: 0.5 + (diffs.modsMultiplier || 0) * 0.1
      },
      oracles: {
        soft_locks: Math.max(0, (diffs.pacingMultiplier || 0) * -0.1),
        budget_violations: Math.max(0, (diffs.tokenMultiplier || 0) * 0.05),
        validator_retries: 0.02 + (diffs.complexityMultiplier || 0) * 0.01,
        fallback_engagements: 0.01 + (diffs.complexityMultiplier || 0) * 0.005,
        safety_violations: 0,
        performance_violations: Math.max(0, (diffs.tokenMultiplier || 0) * 0.02),
        integrity_violations: 0
      },
      behavior: {
        avg_turns_to_completion: 50 + (diffs.pacingMultiplier || 0) * 10,
        exploration_efficiency: 0.7 + (diffs.pacingMultiplier || 0) * 0.1,
        dialogue_engagement_rate: 0.6 + (diffs.dialogueMultiplier || 0) * 0.1,
        economic_activity_rate: 0.8 + (diffs.economyMultiplier || 0) * 0.1,
        risk_taking_rate: 0.3 + (diffs.riskMultiplier || 0) * 0.1
      }
    };

    return impact;
  }

  /**
   * Calculate key differences between configs
   */
  private calculateConfigDiffs(current: LiveOpsConfig, proposed: LiveOpsConfig) {
    return {
      tokenMultiplier: (proposed.AWF_INPUT_TOKEN_MULTIPLIER || 1.0) - (current.AWF_INPUT_TOKEN_MULTIPLIER || 1.0),
      pacingMultiplier: (proposed.QUEST_PACING_TEMPO_MULTIPLIER || 1.0) - (current.QUEST_PACING_TEMPO_MULTIPLIER || 1.0),
      dialogueMultiplier: (proposed.DIALOGUE_ENGAGEMENT_MULTIPLIER || 1.0) - (current.DIALOGUE_ENGAGEMENT_MULTIPLIER || 1.0),
      mechanicsMultiplier: (proposed.SKILL_CHECK_SUCCESS_RATE_MULTIPLIER || 1.0) - (current.SKILL_CHECK_SUCCESS_RATE_MULTIPLIER || 1.0),
      economyMultiplier: (proposed.ECONOMIC_ACTIVITY_MULTIPLIER || 1.0) - (current.ECONOMIC_ACTIVITY_MULTIPLIER || 1.0),
      worldSimMultiplier: (proposed.WORLD_EVENT_RATE_MULTIPLIER || 1.0) - (current.WORLD_EVENT_RATE_MULTIPLIER || 1.0),
      modsMultiplier: 0, // Would be calculated from mod-related changes
      complexityMultiplier: 0, // Would be calculated from overall complexity changes
      riskMultiplier: 0 // Would be calculated from risk-related changes
    };
  }

  /**
   * Generate warnings based on proposed changes
   */
  private generateWarnings(proposedConfig: Partial<LiveOpsConfig>, impact: ImpactEstimate): string[] {
    const warnings: string[] = [];

    // Token warnings
    if (proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER && proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER > 1.5) {
      warnings.push('High input token multiplier may increase costs significantly');
    }

    if (proposedConfig.AWF_OUTPUT_TOKEN_MULTIPLIER && proposedConfig.AWF_OUTPUT_TOKEN_MULTIPLIER > 1.5) {
      warnings.push('High output token multiplier may increase costs significantly');
    }

    // Pacing warnings
    if (proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER && proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER > 2.0) {
      warnings.push('High quest pacing multiplier may make content too fast');
    }

    if (proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER && proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER < 0.5) {
      warnings.push('Low quest pacing multiplier may make content too slow');
    }

    // Economy warnings
    if (proposedConfig.DROP_RATE_LEGENDARY_MULTIPLIER && proposedConfig.DROP_RATE_LEGENDARY_MULTIPLIER > 3.0) {
      warnings.push('High legendary drop rate may unbalance economy');
    }

    // Performance warnings
    if (impact.latency.p95 > 5000) {
      warnings.push('High latency detected - may affect user experience');
    }

    if (impact.tokens.total > 10000) {
      warnings.push('High token usage detected - may increase costs');
    }

    return warnings;
  }

  /**
   * Generate recommendations based on proposed changes
   */
  private generateRecommendations(proposedConfig: Partial<LiveOpsConfig>, impact: ImpactEstimate): string[] {
    const recommendations: string[] = [];

    // Token recommendations
    if (proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER && proposedConfig.AWF_INPUT_TOKEN_MULTIPLIER > 1.2) {
      recommendations.push('Consider gradual rollout for token multiplier changes');
    }

    // Pacing recommendations
    if (proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER && proposedConfig.QUEST_PACING_TEMPO_MULTIPLIER > 1.5) {
      recommendations.push('Monitor player feedback for pacing changes');
    }

    // Economy recommendations
    if (proposedConfig.DROP_RATE_LEGENDARY_MULTIPLIER && proposedConfig.DROP_RATE_LEGENDARY_MULTIPLIER > 2.0) {
      recommendations.push('Consider temporary legendary drop rate changes');
    }

    // Performance recommendations
    if (impact.latency.p95 > 3000) {
      recommendations.push('Consider optimizing model calls or reducing complexity');
    }

    return recommendations;
  }

  /**
   * Identify critical issues
   */
  private identifyCriticalIssues(proposedConfig: Partial<LiveOpsConfig>, impact: ImpactEstimate): string[] {
    const issues: string[] = [];

    // Critical token issues
    if (proposedConfig.AWF_MAX_INPUT_TOKENS && proposedConfig.AWF_MAX_INPUT_TOKENS < 2000) {
      issues.push('Very low input token limit may cause truncation');
    }

    if (proposedConfig.AWF_MAX_OUTPUT_TOKENS && proposedConfig.AWF_MAX_OUTPUT_TOKENS < 1000) {
      issues.push('Very low output token limit may cause incomplete responses');
    }

    // Critical performance issues
    if (impact.latency.p95 > 10000) {
      issues.push('Extremely high latency detected');
    }

    if (impact.tokens.total > 20000) {
      issues.push('Extremely high token usage detected');
    }

    return issues;
  }

  /**
   * Calculate confidence in impact estimation
   */
  private calculateConfidence(impact: ImpactEstimate, simulationTurns: number): number {
    // Base confidence on simulation quality
    let confidence = Math.min(1.0, simulationTurns / 100);
    
    // Reduce confidence for extreme values
    if (impact.latency.p95 > 5000) confidence *= 0.8;
    if (impact.tokens.total > 15000) confidence *= 0.8;
    if (impact.oracles.soft_locks > 0.1) confidence *= 0.9;
    
    return Math.max(0.1, confidence);
  }

  /**
   * Get default impact for error cases
   */
  private getDefaultImpact(): ImpactEstimate {
    return {
      turns: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      tokens: { input: 0, output: 0, total: 0 },
      coverage: { quest_graph: 0, dialogue: 0, mechanics: 0, economy: 0, world_sim: 0, mods: 0 },
      oracles: { soft_locks: 0, budget_violations: 0, validator_retries: 0, fallback_engagements: 0, safety_violations: 0, performance_violations: 0, integrity_violations: 0 },
      behavior: { avg_turns_to_completion: 0, exploration_efficiency: 0, dialogue_engagement_rate: 0, economic_activity_rate: 0, risk_taking_rate: 0 }
    };
  }

  /**
   * Check if global freeze is active
   */
  async isGlobalFreezeActive(): Promise<boolean> {
    return await this.resolver.isGlobalFreezeActive();
  }

  /**
   * Get safety bounds for a specific field
   */
  getBounds(field: string): SafetyBounds | undefined {
    return this.bounds.get(field);
  }

  /**
   * Get all safety bounds
   */
  getAllBounds(): Map<string, SafetyBounds> {
    return new Map(this.bounds);
  }
}

// Factory function
export function createLiveOpsSafetyMechanisms(resolver: LiveOpsConfigResolver): LiveOpsSafetyMechanisms {
  return new LiveOpsSafetyMechanisms(resolver);
}
