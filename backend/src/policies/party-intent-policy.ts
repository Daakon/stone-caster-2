/**
 * Phase 18: Party Intent Policy
 * Handles intent selection and updates based on traits, quest context, and pacing
 */

import { z } from 'zod';

// Types
export interface IntentContext {
  sessionId: string;
  turnId: number;
  activeNodeType: string;
  nodeDifficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  resources: Record<string, number>;
  pacing: 'slow' | 'normal' | 'fast';
  companionTraits: string[];
  companionTrust: number;
  companionRole: string;
}

export interface IntentSelection {
  intent: string;
  confidence: number;
  reasoning: string;
}

export interface IntentPolicy {
  selectIntent(context: IntentContext): IntentSelection;
  updateIntent(currentIntent: string, context: IntentContext): IntentSelection;
}

// Schemas
const IntentContextSchema = z.object({
  sessionId: z.string(),
  turnId: z.number().int().min(0),
  activeNodeType: z.string(),
  nodeDifficulty: z.enum(['easy', 'medium', 'hard', 'extreme']),
  resources: z.record(z.string(), z.number()),
  pacing: z.enum(['slow', 'normal', 'fast']),
  companionTraits: z.array(z.string()),
  companionTrust: z.number().min(0).max(100),
  companionRole: z.string(),
});

const IntentSelectionSchema = z.object({
  intent: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export class PartyIntentPolicy implements IntentPolicy {
  private readonly validIntents = [
    'support',
    'guard',
    'scout',
    'assist_skill',
    'harass',
    'heal'
  ];

  /**
   * Select intent based on context
   */
  selectIntent(context: IntentContext): IntentSelection {
    // Generate deterministic seed
    const seed = this.generateSeed(context.sessionId, context.turnId, 'party');
    const rng = this.createRNG(seed);

    // Calculate intent scores based on context
    const scores = this.calculateIntentScores(context, rng);
    
    // Select intent with highest score
    const selectedIntent = this.selectHighestScoreIntent(scores);
    const confidence = scores[selectedIntent];
    const reasoning = this.generateReasoning(selectedIntent, context);

    return {
      intent: selectedIntent,
      confidence,
      reasoning,
    };
  }

  /**
   * Update existing intent based on new context
   */
  updateIntent(currentIntent: string, context: IntentContext): IntentSelection {
    // Check if current intent is still appropriate
    const currentScore = this.calculateIntentScore(currentIntent, context);
    
    if (currentScore > 0.7) {
      // Current intent is still good
      return {
        intent: currentIntent,
        confidence: currentScore,
        reasoning: `Continuing ${currentIntent} - still appropriate for current context`,
      };
    }

    // Select new intent
    return this.selectIntent(context);
  }

  /**
   * Calculate scores for all intents
   */
  private calculateIntentScores(context: IntentContext, rng: () => number): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const intent of this.validIntents) {
      scores[intent] = this.calculateIntentScore(intent, context);
    }

    return scores;
  }

  /**
   * Calculate score for a specific intent
   */
  private calculateIntentScore(intent: string, context: IntentContext): number {
    let score = 0.5; // Base score

    // Role-based scoring
    score += this.getRoleScore(intent, context.companionRole);

    // Trait-based scoring
    score += this.getTraitScore(intent, context.companionTraits);

    // Context-based scoring
    score += this.getContextScore(intent, context);

    // Trust-based scoring
    score += this.getTrustScore(intent, context.companionTrust);

    // Difficulty-based scoring
    score += this.getDifficultyScore(intent, context.nodeDifficulty);

    // Resource-based scoring
    score += this.getResourceScore(intent, context.resources);

    // Pacing-based scoring
    score += this.getPacingScore(intent, context.pacing);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get role-based score for intent
   */
  private getRoleScore(intent: string, role: string): number {
    const roleScores: Record<string, Record<string, number>> = {
      herbalist: {
        support: 0.3,
        heal: 0.4,
        assist_skill: 0.2,
        guard: 0.1,
        scout: 0.0,
        harass: 0.0,
      },
      scout: {
        scout: 0.4,
        harass: 0.3,
        guard: 0.2,
        support: 0.1,
        assist_skill: 0.0,
        heal: 0.0,
      },
      warrior: {
        guard: 0.4,
        harass: 0.3,
        support: 0.2,
        assist_skill: 0.1,
        scout: 0.0,
        heal: 0.0,
      },
      mage: {
        assist_skill: 0.4,
        support: 0.3,
        heal: 0.2,
        guard: 0.1,
        scout: 0.0,
        harass: 0.0,
      },
    };

    return roleScores[role]?.[intent] || 0.1;
  }

  /**
   * Get trait-based score for intent
   */
  private getTraitScore(intent: string, traits: string[]): number {
    const traitScores: Record<string, Record<string, number>> = {
      healing: {
        heal: 0.3,
        support: 0.2,
        assist_skill: 0.1,
      },
      nature: {
        support: 0.2,
        heal: 0.1,
        assist_skill: 0.1,
      },
      wise: {
        support: 0.2,
        assist_skill: 0.2,
        heal: 0.1,
      },
      stealth: {
        scout: 0.3,
        harass: 0.2,
        guard: 0.1,
      },
      agile: {
        scout: 0.2,
        harass: 0.2,
        guard: 0.1,
      },
      observant: {
        scout: 0.2,
        guard: 0.1,
        support: 0.1,
      },
      brave: {
        guard: 0.3,
        harass: 0.2,
        support: 0.1,
      },
      aggressive: {
        harass: 0.3,
        guard: 0.2,
        scout: 0.1,
      },
    };

    let score = 0;
    for (const trait of traits) {
      score += traitScores[trait]?.[intent] || 0;
    }

    return Math.min(0.3, score); // Cap trait influence
  }

  /**
   * Get context-based score for intent
   */
  private getContextScore(intent: string, context: IntentContext): number {
    const nodeTypeScores: Record<string, Record<string, number>> = {
      combat: {
        guard: 0.3,
        harass: 0.2,
        heal: 0.2,
        support: 0.1,
        scout: 0.1,
        assist_skill: 0.1,
      },
      exploration: {
        scout: 0.3,
        support: 0.2,
        guard: 0.1,
        assist_skill: 0.1,
        heal: 0.1,
        harass: 0.1,
      },
      social: {
        support: 0.3,
        assist_skill: 0.2,
        heal: 0.1,
        guard: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
      puzzle: {
        assist_skill: 0.3,
        support: 0.2,
        heal: 0.1,
        guard: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
    };

    return nodeTypeScores[context.activeNodeType]?.[intent] || 0.1;
  }

  /**
   * Get trust-based score for intent
   */
  private getTrustScore(intent: string, trust: number): number {
    // Higher trust allows more aggressive/risky intents
    if (trust >= 80) {
      return intent === 'harass' ? 0.2 : 0.1;
    } else if (trust >= 50) {
      return intent === 'scout' ? 0.2 : 0.1;
    } else {
      return intent === 'support' ? 0.2 : 0.1;
    }
  }

  /**
   * Get difficulty-based score for intent
   */
  private getDifficultyScore(intent: string, difficulty: string): number {
    const difficultyScores: Record<string, Record<string, number>> = {
      easy: {
        support: 0.2,
        heal: 0.1,
        assist_skill: 0.1,
        guard: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
      medium: {
        guard: 0.2,
        support: 0.2,
        assist_skill: 0.1,
        heal: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
      hard: {
        guard: 0.3,
        harass: 0.2,
        heal: 0.2,
        support: 0.1,
        scout: 0.1,
        assist_skill: 0.1,
      },
      extreme: {
        guard: 0.4,
        harass: 0.3,
        heal: 0.2,
        support: 0.1,
        scout: 0.0,
        assist_skill: 0.0,
      },
    };

    return difficultyScores[difficulty]?.[intent] || 0.1;
  }

  /**
   * Get resource-based score for intent
   */
  private getResourceScore(intent: string, resources: Record<string, number>): number {
    // Low health favors healing/support
    if (resources.hp < 30) {
      return intent === 'heal' ? 0.3 : intent === 'support' ? 0.2 : 0.1;
    }

    // Low mana favors non-magical intents
    if (resources.mana < 20) {
      return ['guard', 'scout', 'harass'].includes(intent) ? 0.2 : 0.1;
    }

    // High resources allow more aggressive intents
    if (resources.hp > 80 && resources.mana > 60) {
      return intent === 'harass' ? 0.2 : 0.1;
    }

    return 0.1;
  }

  /**
   * Get pacing-based score for intent
   */
  private getPacingScore(intent: string, pacing: string): number {
    const pacingScores: Record<string, Record<string, number>> = {
      slow: {
        support: 0.2,
        heal: 0.2,
        assist_skill: 0.1,
        guard: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
      normal: {
        guard: 0.2,
        support: 0.2,
        assist_skill: 0.1,
        heal: 0.1,
        scout: 0.1,
        harass: 0.1,
      },
      fast: {
        harass: 0.3,
        guard: 0.2,
        scout: 0.2,
        support: 0.1,
        heal: 0.1,
        assist_skill: 0.1,
      },
    };

    return pacingScores[pacing]?.[intent] || 0.1;
  }

  /**
   * Select intent with highest score
   */
  private selectHighestScoreIntent(scores: Record<string, number>): string {
    let bestIntent = 'support';
    let bestScore = 0;

    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return bestIntent;
  }

  /**
   * Generate reasoning for intent selection
   */
  private generateReasoning(intent: string, context: IntentContext): string {
    const reasons: string[] = [];

    // Role-based reasoning
    if (context.companionRole === 'herbalist' && intent === 'heal') {
      reasons.push('herbalist role favors healing');
    }

    // Trait-based reasoning
    if (context.companionTraits.includes('healing') && intent === 'heal') {
      reasons.push('healing trait');
    }

    // Context-based reasoning
    if (context.activeNodeType === 'combat' && intent === 'guard') {
      reasons.push('combat context favors guarding');
    }

    // Trust-based reasoning
    if (context.companionTrust >= 80 && intent === 'harass') {
      reasons.push('high trust allows aggressive tactics');
    }

    // Difficulty-based reasoning
    if (context.nodeDifficulty === 'extreme' && intent === 'guard') {
      reasons.push('extreme difficulty requires protection');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'general party needs';
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(sessionId: string, turnId: number, context: string): number {
    const seedString = `${sessionId}:${turnId}:${context}`;
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create deterministic RNG
   */
  private createRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}

// Singleton instance
export const partyIntentPolicy = new PartyIntentPolicy();


