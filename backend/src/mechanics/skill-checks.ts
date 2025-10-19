/**
 * Skill Check Engine
 * Deterministic, seeded checks with pluggable policies
 */

export interface SkillCheckContext {
  actor: string;
  skill: string;
  difficulty: number; // 0-100
  modifiers: number[];
  advantage?: boolean;
  disadvantage?: boolean;
  sessionId: string;
  turnId: number;
  checkId: string;
}

export interface SkillCheckResult {
  id: string;
  skill: string;
  roll: number;
  total: number;
  threshold: number;
  outcome: 'crit' | 'success' | 'mixed' | 'fail' | 'critfail';
  margin: number;
}

export interface CheckPolicy {
  name: string;
  roll: (seed: number) => number;
  getOutcome: (total: number, threshold: number, margin: number) => SkillCheckResult['outcome'];
}

export class SkillCheckEngine {
  private readonly policies: Map<string, CheckPolicy> = new Map();
  private readonly defaultPolicy: string;
  private readonly critMargin: number;

  constructor() {
    this.defaultPolicy = process.env.AWF_CHECK_POLICY || 'linear_d20';
    this.critMargin = parseInt(process.env.AWF_CHECK_CRIT_MARGIN || '20');
    
    this.initializePolicies();
  }

  /**
   * Roll a skill check with deterministic results
   */
  rollCheck(context: SkillCheckContext): SkillCheckResult {
    const policy = this.policies.get(this.defaultPolicy) || this.policies.get('linear_d20')!;
    const seed = this.generateSeed(context);
    
    // Calculate base roll
    let roll = policy.roll(seed);
    
    // Handle advantage/disadvantage
    if (context.advantage && !context.disadvantage) {
      const secondRoll = policy.roll(seed + 1);
      roll = Math.max(roll, secondRoll);
    } else if (context.disadvantage && !context.advantage) {
      const secondRoll = policy.roll(seed + 1);
      roll = Math.min(roll, secondRoll);
    }
    
    // Apply modifiers
    const total = roll + context.modifiers.reduce((sum, mod) => sum + mod, 0);
    
    // Calculate outcome
    const threshold = context.difficulty;
    const margin = total - threshold;
    const outcome = policy.getOutcome(total, threshold, this.critMargin);
    
    return {
      id: context.checkId,
      skill: context.skill,
      roll,
      total,
      threshold,
      outcome,
      margin,
    };
  }

  /**
   * Get available check policies
   */
  getPolicies(): string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Set default policy
   */
  setDefaultPolicy(policyName: string): void {
    if (!this.policies.has(policyName)) {
      throw new Error(`Unknown policy: ${policyName}`);
    }
    this.defaultPolicy = policyName;
  }

  /**
   * Initialize check policies
   */
  private initializePolicies(): void {
    // Linear d20 policy
    this.policies.set('linear_d20', {
      name: 'Linear d20',
      roll: (seed: number) => this.deterministicRandom(seed) * 20 + 1,
      getOutcome: (total: number, threshold: number, margin: number) => {
        if (total >= threshold + margin) return 'crit';
        if (total >= threshold) return 'success';
        if (total >= threshold - margin) return 'mixed';
        if (total >= threshold - margin * 2) return 'fail';
        return 'critfail';
      },
    });

    // Bell curve 2d6 policy
    this.policies.set('bell_2d6', {
      name: 'Bell Curve 2d6',
      roll: (seed: number) => {
        const roll1 = Math.floor(this.deterministicRandom(seed) * 6) + 1;
        const roll2 = Math.floor(this.deterministicRandom(seed + 1) * 6) + 1;
        return roll1 + roll2;
      },
      getOutcome: (total: number, threshold: number, margin: number) => {
        if (total >= threshold + margin) return 'crit';
        if (total >= threshold) return 'success';
        if (total >= threshold - margin) return 'mixed';
        if (total >= threshold - margin * 2) return 'fail';
        return 'critfail';
      },
    });

    // Percentile policy
    this.policies.set('percent_1d100', {
      name: 'Percentile 1d100',
      roll: (seed: number) => this.deterministicRandom(seed) * 100 + 1,
      getOutcome: (total: number, threshold: number, margin: number) => {
        if (total >= threshold + margin) return 'crit';
        if (total >= threshold) return 'success';
        if (total >= threshold - margin) return 'mixed';
        if (total >= threshold - margin * 2) return 'fail';
        return 'critfail';
      },
    });

    // 3d6 policy (more bell curve)
    this.policies.set('bell_3d6', {
      name: 'Bell Curve 3d6',
      roll: (seed: number) => {
        const roll1 = Math.floor(this.deterministicRandom(seed) * 6) + 1;
        const roll2 = Math.floor(this.deterministicRandom(seed + 1) * 6) + 1;
        const roll3 = Math.floor(this.deterministicRandom(seed + 2) * 6) + 1;
        return roll1 + roll2 + roll3;
      },
      getOutcome: (total: number, threshold: number, margin: number) => {
        if (total >= threshold + margin) return 'crit';
        if (total >= threshold) return 'success';
        if (total >= threshold - margin) return 'mixed';
        if (total >= threshold - margin * 2) return 'fail';
        return 'critfail';
      },
    });
  }

  /**
   * Generate deterministic seed for skill check
   */
  private generateSeed(context: SkillCheckContext): number {
    const input = `${context.sessionId}-${context.turnId}-${context.checkId}`;
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
export const skillCheckEngine = new SkillCheckEngine();


