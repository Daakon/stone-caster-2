/**
 * Phase 21: Dialogue Scoring System
 * Deterministic scoring of candidate lines based on personality, context, and relationships
 */

import { z } from 'zod';

// Types
export interface ScoringContext {
  sessionId: string;
  turnId: number;
  nodeId: string;
  convId: string;
  worldRef: string;
  adventureRef?: string;
  playerProfile: {
    name: string;
    level: number;
    skills: Record<string, number>;
    resources: Record<string, number>;
  };
  relationships: Record<string, {
    trust: number;
    consent: 'yes' | 'no' | 'later';
    boundaries: Record<string, boolean>;
  }>;
  party: {
    members: string[];
    intents: Record<string, string>;
  };
  sim: {
    weather: string;
    time: string;
    events: string[];
  };
  quest: {
    activeNode: string;
    completedNodes: string[];
    availableNodes: string[];
  };
  arc: {
    activeArcs: string[];
    arcStates: Record<string, string>;
  };
}

export interface DialogueLine {
  id: string;
  speaker: string;
  syn: string;
  emotion: string[];
  cooldown?: number;
  guard?: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export interface ScoreBreakdown {
  base: number;
  personality: number;
  intent: number;
  arc: number;
  pacing: number;
  recent: number;
  sim: number;
  total: number;
}

export interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown;
  reason: string;
  valid: boolean;
  issues: string[];
}

// Schemas
const DialogueLineSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  syn: z.string().max(80),
  emotion: z.array(z.string()).max(4),
  cooldown: z.number().int().min(0).optional(),
  guard: z.array(z.object({
    type: z.string(),
  }).passthrough()).optional(),
});

export class DialogueScoring {
  private personalityWeights: Record<string, number> = {
    'healing': 0.8,
    'nature': 0.7,
    'curious': 0.6,
    'cautious': 0.5,
    'social': 0.9,
    'brave': 0.7,
    'lazy': 0.3,
  };

  private intentWeights: Record<string, number> = {
    'support': 0.8,
    'guard': 0.6,
    'scout': 0.5,
    'assist_skill': 0.7,
    'harass': 0.4,
    'heal': 0.9,
  };

  private emotionWeights: Record<string, number> = {
    'warm': 0.8,
    'curious': 0.7,
    'playful': 0.6,
    'trusting': 0.9,
    'vulnerable': 0.8,
    'distant': 0.3,
    'cautious': 0.4,
    'alert': 0.6,
    'focused': 0.7,
    'relieved': 0.5,
    'confident': 0.8,
  };

  constructor() {
    // Initialize with default weights
  }

  /**
   * Score a dialogue line
   */
  scoreLine(
    line: DialogueLine,
    context: ScoringContext
  ): ScoringResult {
    try {
      // Validate line
      const validation = DialogueLineSchema.safeParse(line);
      if (!validation.success) {
        return {
          score: 0,
          breakdown: this.getEmptyBreakdown(),
          reason: 'Invalid line format',
          valid: false,
          issues: validation.error.errors.map(e => e.message),
        };
      }

      // Check guards
      if (line.guard && !this.evaluateGuards(line.guard, context)) {
        return {
          score: 0,
          breakdown: this.getEmptyBreakdown(),
          reason: 'Guards not satisfied',
          valid: false,
          issues: ['Line guards not met'],
        };
      }

      // Calculate score breakdown
      const breakdown = this.calculateScoreBreakdown(line, context);
      const totalScore = this.calculateTotalScore(breakdown);
      const reason = this.generateScoreReason(breakdown, context);

      return {
        score: totalScore,
        breakdown,
        reason,
        valid: true,
        issues: [],
      };

    } catch (error) {
      return {
        score: 0,
        breakdown: this.getEmptyBreakdown(),
        reason: `Scoring failed: ${error}`,
        valid: false,
        issues: [String(error)],
      };
    }
  }

  /**
   * Calculate score breakdown
   */
  private calculateScoreBreakdown(
    line: DialogueLine,
    context: ScoringContext
  ): ScoreBreakdown {
    const breakdown: ScoreBreakdown = {
      base: 50,
      personality: 0,
      intent: 0,
      arc: 0,
      pacing: 0,
      recent: 0,
      sim: 0,
      total: 0,
    };

    // Personality alignment
    breakdown.personality = this.scorePersonalityAlignment(line, context);

    // Intent alignment
    breakdown.intent = this.scoreIntentAlignment(line, context);

    // Arc alignment
    breakdown.arc = this.scoreArcAlignment(line, context);

    // Pacing alignment
    breakdown.pacing = this.scorePacingAlignment(line, context);

    // Recent context
    breakdown.recent = this.scoreRecentContext(line, context);

    // Simulation context
    breakdown.sim = this.scoreSimContext(line, context);

    return breakdown;
  }

  /**
   * Score personality alignment
   */
  private scorePersonalityAlignment(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    // This would integrate with Phase 14 personality system
    // For now, use mock personality traits
    const mockTraits = ['healing', 'nature', 'curious'];
    let score = 0;

    for (const trait of mockTraits) {
      const weight = this.personalityWeights[trait] || 0.5;
      if (line.syn.toLowerCase().includes(trait)) {
        score += weight * 20;
      }
    }

    return Math.min(30, score);
  }

  /**
   * Score intent alignment
   */
  private scoreIntentAlignment(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    const speakerIntent = context.party.intents[line.speaker];
    if (!speakerIntent) return 0;

    const weight = this.intentWeights[speakerIntent] || 0.5;
    let score = 0;

    // Check if line content aligns with intent
    if (speakerIntent === 'support' && line.syn.includes('help')) {
      score += weight * 25;
    } else if (speakerIntent === 'guard' && line.syn.includes('protect')) {
      score += weight * 25;
    } else if (speakerIntent === 'heal' && line.syn.includes('heal')) {
      score += weight * 25;
    }

    return Math.min(25, score);
  }

  /**
   * Score arc alignment
   */
  private scoreArcAlignment(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    let score = 0;

    // Check if line supports active arcs
    for (const arcId of context.arc.activeArcs) {
      const arcState = context.arc.arcStates[arcId];
      if (arcState === 'active' && line.syn.includes('trust')) {
        score += 15;
      }
    }

    return Math.min(20, score);
  }

  /**
   * Score pacing alignment
   */
  private scorePacingAlignment(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    // This would integrate with Phase 15 quest graph pacing
    // For now, use simple pacing logic
    let score = 0;

    // Check quest progress
    const questProgress = context.quest.completedNodes.length;
    if (questProgress > 5 && line.syn.includes('deep')) {
      score += 10;
    }

    return Math.min(15, score);
  }

  /**
   * Score recent context
   */
  private scoreRecentContext(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    // This would check recent dialogue history
    // For now, use simple recent context
    let score = 0;

    // Avoid repetition
    if (line.syn.includes('greeting') && context.turnId < 3) {
      score += 10;
    }

    return Math.min(10, score);
  }

  /**
   * Score simulation context
   */
  private scoreSimContext(
    line: DialogueLine,
    context: ScoringContext
  ): number {
    let score = 0;

    // Weather alignment
    if (context.sim.weather === 'storm' && line.syn.includes('storm')) {
      score += 15;
    } else if (context.sim.weather === 'clear' && line.syn.includes('sunny')) {
      score += 10;
    }

    // Event alignment
    if (context.sim.events.includes('festival') && line.syn.includes('celebrate')) {
      score += 20;
    }

    // Time alignment
    if (context.sim.time === 'evening' && line.syn.includes('sunset')) {
      score += 10;
    }

    return Math.min(25, score);
  }

  /**
   * Calculate total score
   */
  private calculateTotalScore(breakdown: ScoreBreakdown): number {
    const total = breakdown.base + breakdown.personality + breakdown.intent + 
                  breakdown.arc + breakdown.pacing + breakdown.recent + breakdown.sim;
    
    return Math.max(0, Math.min(100, total));
  }

  /**
   * Generate score reason
   */
  private generateScoreReason(
    breakdown: ScoreBreakdown,
    context: ScoringContext
  ): string {
    const reasons: string[] = [];

    if (breakdown.personality > 0) {
      reasons.push(`personality:${breakdown.personality.toFixed(1)}`);
    }
    if (breakdown.intent > 0) {
      reasons.push(`intent:${breakdown.intent.toFixed(1)}`);
    }
    if (breakdown.arc > 0) {
      reasons.push(`arc:${breakdown.arc.toFixed(1)}`);
    }
    if (breakdown.pacing > 0) {
      reasons.push(`pacing:${breakdown.pacing.toFixed(1)}`);
    }
    if (breakdown.recent > 0) {
      reasons.push(`recent:${breakdown.recent.toFixed(1)}`);
    }
    if (breakdown.sim > 0) {
      reasons.push(`sim:${breakdown.sim.toFixed(1)}`);
    }

    return reasons.join(' ');
  }

  /**
   * Evaluate guards
   */
  private evaluateGuards(
    guards: Array<{ type: string; [key: string]: any }>,
    context: ScoringContext
  ): boolean {
    for (const guard of guards) {
      if (!this.evaluateGuard(guard, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate single guard
   */
  private evaluateGuard(
    guard: { type: string; [key: string]: any },
    context: ScoringContext
  ): boolean {
    switch (guard.type) {
      case 'relationship':
        const npc = guard.npc || guard.target;
        const minTrust = guard.min_trust || guard.gte;
        const relationship = context.relationships[npc];
        return relationship && relationship.trust >= minTrust;
        
      case 'presence':
        const npcs = guard.npcs || guard.required;
        return npcs.every((npc: string) => 
          context.party.members.includes(npc)
        );
        
      case 'quest':
        const nodeId = guard.node_id || guard.node;
        const nodeStatus = guard.status || 'completed';
        switch (nodeStatus) {
          case 'completed':
            return context.quest.completedNodes.includes(nodeId);
          case 'available':
            return context.quest.availableNodes.includes(nodeId);
          case 'active':
            return context.quest.activeNode === nodeId;
          default:
            return false;
        }
        
      case 'arc':
        const arcId = guard.arc_id || guard.arc;
        const arcState = guard.state || 'active';
        return context.arc.arcStates[arcId] === arcState;
        
      case 'sim':
        const event = guard.event;
        return context.sim.events.includes(event);
        
      default:
        return true;
    }
  }

  /**
   * Get empty breakdown
   */
  private getEmptyBreakdown(): ScoreBreakdown {
    return {
      base: 0,
      personality: 0,
      intent: 0,
      arc: 0,
      pacing: 0,
      recent: 0,
      sim: 0,
      total: 0,
    };
  }

  /**
   * Set personality weights
   */
  setPersonalityWeights(weights: Record<string, number>): void {
    this.personalityWeights = { ...this.personalityWeights, ...weights };
  }

  /**
   * Set intent weights
   */
  setIntentWeights(weights: Record<string, number>): void {
    this.intentWeights = { ...this.intentWeights, ...weights };
  }

  /**
   * Set emotion weights
   */
  setEmotionWeights(weights: Record<string, number>): void {
    this.emotionWeights = { ...this.emotionWeights, ...weights };
  }

  /**
   * Get current weights
   */
  getWeights(): {
    personality: Record<string, number>;
    intent: Record<string, number>;
    emotion: Record<string, number>;
  } {
    return {
      personality: { ...this.personalityWeights },
      intent: { ...this.intentWeights },
      emotion: { ...this.emotionWeights },
    };
  }
}

// Singleton instance
export const dialogueScoring = new DialogueScoring();


