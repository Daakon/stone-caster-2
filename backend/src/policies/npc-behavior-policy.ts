/**
 * NPC Behavior Policy
 * Computes behavior profile for NPCs based on personality traits and context
 */

import { PersonalityTraits } from '../personality/personality-engine.js';

export interface BehaviorProfile {
  tone: 'friendly' | 'cautious' | 'cold' | 'aggressive' | 'curious' | 'neutral';
  actBiases: Record<string, number>; // Percentage shifts for different act types
  dialogueStyle: 'formal' | 'casual' | 'intimate' | 'distant';
  trustThreshold: number; // 0-100, affects willingness to help
  riskTolerance: number; // 0-100, affects decision making
}

export interface NpcContext {
  npcRef: string;
  worldRef: string;
  adventureRef?: string;
  sessionId: string;
  recentPlayerActs: Array<{
    actType: string;
    targetNpc?: string;
    emotionalImpact: number;
    timestamp: string;
  }>;
  relationshipMatrix: Record<string, number>; // NPC -> trust level
  worldMood?: string; // Adventure or world mood context
}

export class NpcBehaviorPolicy {
  private readonly seedCache = new Map<string, number>();

  /**
   * Compute behavior profile for an NPC
   */
  computeBehaviorProfile(
    traits: PersonalityTraits,
    context: NpcContext
  ): BehaviorProfile {
    // Generate deterministic seed for this NPC and session
    const seed = this.generateDeterministicSeed(context.npcRef, context.sessionId);
    
    // Compute tone based on traits and recent interactions
    const tone = this.computeTone(traits, context, seed);
    
    // Compute act biases based on personality
    const actBiases = this.computeActBiases(traits, context, seed);
    
    // Compute dialogue style
    const dialogueStyle = this.computeDialogueStyle(traits, context);
    
    // Compute trust threshold
    const trustThreshold = this.computeTrustThreshold(traits, context);
    
    // Compute risk tolerance
    const riskTolerance = this.computeRiskTolerance(traits, context);

    return {
      tone,
      actBiases,
      dialogueStyle,
      trustThreshold,
      riskTolerance,
    };
  }

  /**
   * Generate behavior context for AWF bundle
   */
  generateBehaviorContext(
    npcRef: string,
    behaviorProfile: BehaviorProfile,
    context: NpcContext
  ): Record<string, any> {
    return {
      npc_behavior: {
        npc_ref: npcRef,
        tone: behaviorProfile.tone,
        dialogue_style: behaviorProfile.dialogueStyle,
        trust_threshold: behaviorProfile.trustThreshold,
        risk_tolerance: behaviorProfile.riskTolerance,
        act_biases: behaviorProfile.actBiases,
        context: {
          world_mood: context.worldMood,
          relationship_trust: context.relationshipMatrix,
          recent_interactions: context.recentPlayerActs.slice(-3), // Last 3 acts
        },
      },
    };
  }

  /**
   * Compute tone based on personality and context
   */
  private computeTone(
    traits: PersonalityTraits,
    context: NpcContext,
    seed: number
  ): BehaviorProfile['tone'] {
    // Base tone from personality
    let toneScore = 0;
    
    if (traits.trust > 70 && traits.empathy > 60) {
      toneScore += 3; // Friendly
    } else if (traits.caution > 70 && traits.aggression < 30) {
      toneScore -= 2; // Cautious
    } else if (traits.aggression > 70 && traits.patience < 30) {
      toneScore -= 3; // Aggressive
    } else if (traits.curiosity > 70 && traits.openness > 60) {
      toneScore += 2; // Curious
    } else if (traits.empathy < 30 && traits.trust < 30) {
      toneScore -= 3; // Cold
    }

    // Adjust based on recent player actions
    const recentImpact = this.calculateRecentImpact(context.recentPlayerActs);
    toneScore += recentImpact;

    // Apply deterministic randomness
    const randomFactor = this.deterministicRandom(seed) * 2 - 1; // -1 to 1
    toneScore += randomFactor;

    // Map to tone categories
    if (toneScore >= 2) return 'friendly';
    if (toneScore >= 1) return 'curious';
    if (toneScore >= -1) return 'neutral';
    if (toneScore >= -2) return 'cautious';
    if (toneScore >= -3) return 'cold';
    return 'aggressive';
  }

  /**
   * Compute act biases based on personality
   */
  private computeActBiases(
    traits: PersonalityTraits,
    context: NpcContext,
    seed: number
  ): Record<string, number> {
    const biases: Record<string, number> = {};

    // Base biases from personality traits
    if (traits.aggression > 60) {
      biases.attack = Math.min(20, (traits.aggression - 60) * 0.5);
      biases.threaten = Math.min(15, (traits.aggression - 60) * 0.3);
    }

    if (traits.empathy > 60) {
      biases.help = Math.min(25, (traits.empathy - 60) * 0.6);
      biases.comfort = Math.min(20, (traits.empathy - 60) * 0.5);
    }

    if (traits.curiosity > 60) {
      biases.question = Math.min(20, (traits.curiosity - 60) * 0.5);
      biases.explore = Math.min(15, (traits.curiosity - 60) * 0.3);
    }

    if (traits.caution > 60) {
      biases.retreat = Math.min(15, (traits.caution - 60) * 0.3);
      biases.observe = Math.min(20, (traits.caution - 60) * 0.5);
    }

    if (traits.humor > 60) {
      biases.joke = Math.min(15, (traits.humor - 60) * 0.3);
      biases.tease = Math.min(10, (traits.humor - 60) * 0.2);
    }

    // Adjust based on recent interactions
    const recentImpact = this.calculateRecentImpact(context.recentPlayerActs);
    if (recentImpact < -1) {
      // Negative interactions increase defensive acts
      biases.retreat = (biases.retreat || 0) + 10;
      biases.observe = (biases.observe || 0) + 5;
    } else if (recentImpact > 1) {
      // Positive interactions increase helpful acts
      biases.help = (biases.help || 0) + 10;
      biases.comfort = (biases.comfort || 0) + 5;
    }

    // Apply deterministic randomness
    for (const act in biases) {
      const randomFactor = this.deterministicRandom(seed + act.charCodeAt(0)) * 0.1;
      biases[act] = Math.max(0, biases[act] + randomFactor);
    }

    return biases;
  }

  /**
   * Compute dialogue style based on personality
   */
  private computeDialogueStyle(
    traits: PersonalityTraits,
    context: NpcContext
  ): BehaviorProfile['dialogueStyle'] {
    const trustLevel = context.relationshipMatrix[context.npcRef] || 50;
    
    if (trustLevel > 80 && traits.empathy > 70) {
      return 'intimate';
    } else if (trustLevel > 60 && traits.openness > 60) {
      return 'casual';
    } else if (traits.caution > 70 || trustLevel < 30) {
      return 'distant';
    } else {
      return 'formal';
    }
  }

  /**
   * Compute trust threshold for decision making
   */
  private computeTrustThreshold(
    traits: PersonalityTraits,
    context: NpcContext
  ): number {
    let threshold = traits.trust;
    
    // Adjust based on recent interactions
    const recentImpact = this.calculateRecentImpact(context.recentPlayerActs);
    threshold += recentImpact * 5; // Recent interactions affect trust threshold
    
    // Adjust based on world mood
    if (context.worldMood === 'tense' || context.worldMood === 'dangerous') {
      threshold += 10; // Higher threshold in dangerous situations
    } else if (context.worldMood === 'peaceful' || context.worldMood === 'friendly') {
      threshold -= 5; // Lower threshold in friendly situations
    }

    return Math.max(0, Math.min(100, threshold));
  }

  /**
   * Compute risk tolerance for decision making
   */
  private computeRiskTolerance(
    traits: PersonalityTraits,
    context: NpcContext
  ): number {
    let tolerance = 100 - traits.caution; // Inverse of caution
    
    // Adjust based on aggression and curiosity
    tolerance += (traits.aggression - 50) * 0.3;
    tolerance += (traits.curiosity - 50) * 0.2;
    
    // Adjust based on recent interactions
    const recentImpact = this.calculateRecentImpact(context.recentPlayerActs);
    tolerance += recentImpact * 3;

    return Math.max(0, Math.min(100, tolerance));
  }

  /**
   * Calculate impact of recent player actions
   */
  private calculateRecentImpact(recentActs: NpcContext['recentPlayerActs']): number {
    if (recentActs.length === 0) return 0;
    
    const totalImpact = recentActs.reduce((sum, act) => sum + act.emotionalImpact, 0);
    const averageImpact = totalImpact / recentActs.length;
    
    // Weight recent actions more heavily
    const timeDecay = Math.exp(-recentActs.length * 0.1);
    return averageImpact * timeDecay;
  }

  /**
   * Generate deterministic seed for consistent behavior
   */
  private generateDeterministicSeed(npcRef: string, sessionId: string): number {
    const key = `${npcRef}-${sessionId}`;
    
    if (this.seedCache.has(key)) {
      return this.seedCache.get(key)!;
    }
    
    let hash = 0;
    const input = key;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const seed = Math.abs(hash) / 2147483647; // Normalize to 0-1
    this.seedCache.set(key, seed);
    
    return seed;
  }

  /**
   * Deterministic random number generator
   */
  private deterministicRandom(seed: number): number {
    // Simple linear congruential generator
    const a = 1664525;
    const c = 1013904223;
    const m = 2 ** 32;
    
    const nextSeed = (a * seed + c) % m;
    return nextSeed / m;
  }
}

// Singleton instance
export const npcBehaviorPolicy = new NpcBehaviorPolicy();


