/**
 * Phase 19: NPC Schedule Resolver
 * Resolves NPC schedules with personality-driven variance
 */

import { z } from 'zod';

// Types
export interface ScheduleEntry {
  band: string;
  location: string;
  intent: string;
  except?: {
    weather?: string[];
    events?: string[];
    quests?: string[];
    flags?: Record<string, any>;
  };
}

export interface NPCSchedule {
  npc_id: string;
  world_ref: string;
  entries: ScheduleEntry[];
  behavior_variance: {
    curiosity: number;
    caution: number;
    social: number;
  };
}

export interface ScheduleContext {
  currentBand: string;
  currentWeather: string;
  activeEvents: string[];
  activeQuests: string[];
  worldFlags: Record<string, any>;
  npcPersonality?: {
    traits: string[];
    trust_level: number;
    mood: string;
  };
}

export interface ResolvedSchedule {
  npcId: string;
  location: string;
  intent: string;
  confidence: number;
  reasoning: string;
}

// Schemas
const ScheduleEntrySchema = z.object({
  band: z.string(),
  location: z.string(),
  intent: z.string(),
  except: z.object({
    weather: z.array(z.string()).optional(),
    events: z.array(z.string()).optional(),
    quests: z.array(z.string()).optional(),
    flags: z.record(z.any()).optional(),
  }).optional(),
});

const NPCScheduleSchema = z.object({
  npc_id: z.string(),
  world_ref: z.string(),
  entries: z.array(ScheduleEntrySchema),
  behavior_variance: z.object({
    curiosity: z.number().min(0).max(1),
    caution: z.number().min(0).max(1),
    social: z.number().min(0).max(1),
  }),
});

export class NPCScheduleResolver {
  private schedules: Map<string, NPCSchedule> = new Map();

  constructor() {
    // Initialize with empty schedules
  }

  /**
   * Resolve NPC schedule for current context
   */
  resolveSchedule(
    npcId: string,
    context: ScheduleContext
  ): ResolvedSchedule | null {
    const schedule = this.schedules.get(npcId);
    if (!schedule) {
      return null;
    }

    // Find matching schedule entry for current band
    const entry = schedule.entries.find(e => e.band === context.currentBand);
    if (!entry) {
      return {
        npcId,
        location: 'unknown',
        intent: 'idle',
        confidence: 0,
        reasoning: 'No schedule for current band',
      };
    }

    // Check exceptions
    if (this.checkExceptions(entry, context)) {
      return this.getExceptionBehavior(npcId, context);
    }

    // Apply behavior variance
    const variance = this.applyBehaviorVariance(entry, schedule.behavior_variance, context);
    
    return {
      npcId,
      location: variance.location,
      intent: variance.intent,
      confidence: this.calculateConfidence(variance, context),
      reasoning: this.generateReasoning(variance, context),
    };
  }

  /**
   * Resolve all NPC schedules for current context
   */
  resolveAllSchedules(context: ScheduleContext): ResolvedSchedule[] {
    const results: ResolvedSchedule[] = [];
    
    for (const [npcId, schedule] of this.schedules) {
      const result = this.resolveSchedule(npcId, context);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Check if schedule entry exceptions apply
   */
  private checkExceptions(entry: ScheduleEntry, context: ScheduleContext): boolean {
    if (!entry.except) return false;

    const except = entry.except;

    // Check weather exceptions
    if (except.weather && except.weather.includes(context.currentWeather)) {
      return true;
    }

    // Check event exceptions
    if (except.events) {
      for (const event of except.events) {
        if (context.activeEvents.includes(event)) {
          return true;
        }
      }
    }

    // Check quest exceptions
    if (except.quests) {
      for (const quest of except.quests) {
        if (context.activeQuests.includes(quest)) {
          return true;
        }
      }
    }

    // Check flag exceptions
    if (except.flags) {
      for (const [key, value] of Object.entries(except.flags)) {
        if (context.worldFlags[key] === value) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get behavior when exceptions apply
   */
  private getExceptionBehavior(npcId: string, context: ScheduleContext): ResolvedSchedule {
    // Default exception behavior
    const exceptionBehaviors: Record<string, { location: string; intent: string }> = {
      storm: { location: 'shelter', intent: 'wait' },
      festival: { location: 'festival_grounds', intent: 'celebrate' },
      danger: { location: 'safe_zone', intent: 'hide' },
    };

    // Find applicable exception behavior
    for (const [condition, behavior] of Object.entries(exceptionBehaviors)) {
      if (this.isConditionActive(condition, context)) {
        return {
          npcId,
          location: behavior.location,
          intent: behavior.intent,
          confidence: 0.9,
          reasoning: `Exception behavior for ${condition}`,
        };
      }
    }

    // Default fallback
    return {
      npcId,
      location: 'home',
      intent: 'wait',
      confidence: 0.5,
      reasoning: 'Default exception behavior',
    };
  }

  /**
   * Apply behavior variance based on personality
   */
  private applyBehaviorVariance(
    entry: ScheduleEntry,
    variance: NPCSchedule['behavior_variance'],
    context: ScheduleContext
  ): { location: string; intent: string } {
    const result = { location: entry.location, intent: entry.intent };
    
    // Generate deterministic seed for this NPC and context
    const seed = this.generateSeed(context, entry);
    const rng = this.createRNG(seed);

    // Apply curiosity variance
    if (variance.curiosity > 0 && rng() < variance.curiosity) {
      result.intent = this.applyCuriosityVariance(result.intent, context, rng);
    }

    // Apply caution variance
    if (variance.caution > 0 && rng() < variance.caution) {
      result.intent = this.applyCautionVariance(result.intent, context, rng);
    }

    // Apply social variance
    if (variance.social > 0 && rng() < variance.social) {
      result.intent = this.applySocialVariance(result.intent, context, rng);
    }

    // Apply personality trait variance
    if (context.npcPersonality) {
      result.intent = this.applyPersonalityVariance(result.intent, context.npcPersonality, rng);
    }

    return result;
  }

  /**
   * Apply curiosity variance
   */
  private applyCuriosityVariance(intent: string, context: ScheduleContext, rng: () => number): string {
    const curiosityChanges: Record<string, string[]> = {
      guard: ['scout', 'explore'],
      wait: ['observe', 'explore'],
      rest: ['observe', 'scout'],
    };

    const options = curiosityChanges[intent] || [];
    if (options.length > 0 && rng() < 0.3) {
      return options[Math.floor(rng() * options.length)];
    }

    return intent;
  }

  /**
   * Apply caution variance
   */
  private applyCautionVariance(intent: string, context: ScheduleContext, rng: () => number): string {
    const cautionChanges: Record<string, string[]> = {
      scout: ['guard', 'hide'],
      explore: ['guard', 'wait'],
      hunt: ['guard', 'wait'],
    };

    const options = cautionChanges[intent] || [];
    if (options.length > 0 && rng() < 0.4) {
      return options[Math.floor(rng() * options.length)];
    }

    return intent;
  }

  /**
   * Apply social variance
   */
  private applySocialVariance(intent: string, context: ScheduleContext, rng: () => number): string {
    const socialChanges: Record<string, string[]> = {
      wait: ['socialize', 'gossip'],
      rest: ['socialize', 'gossip'],
      work: ['socialize', 'gossip'],
    };

    const options = socialChanges[intent] || [];
    if (options.length > 0 && rng() < 0.2) {
      return options[Math.floor(rng() * options.length)];
    }

    return intent;
  }

  /**
   * Apply personality trait variance
   */
  private applyPersonalityVariance(
    intent: string,
    personality: ScheduleContext['npcPersonality'],
    rng: () => number
  ): string {
    if (!personality) return intent;

    const traits = personality.traits || [];
    
    // Brave trait
    if (traits.includes('brave') && intent === 'hide' && rng() < 0.3) {
      return 'guard';
    }

    // Cautious trait
    if (traits.includes('cautious') && intent === 'scout' && rng() < 0.4) {
      return 'guard';
    }

    // Social trait
    if (traits.includes('social') && intent === 'work' && rng() < 0.2) {
      return 'socialize';
    }

    // Lazy trait
    if (traits.includes('lazy') && intent === 'work' && rng() < 0.5) {
      return 'rest';
    }

    return intent;
  }

  /**
   * Calculate confidence in resolved schedule
   */
  private calculateConfidence(
    variance: { location: string; intent: string },
    context: ScheduleContext
  ): number {
    let confidence = 0.8; // Base confidence

    // Reduce confidence for exception conditions
    if (context.currentWeather === 'storm') confidence -= 0.2;
    if (context.activeEvents.length > 0) confidence -= 0.1;
    if (context.activeQuests.length > 0) confidence -= 0.1;

    // Increase confidence for stable conditions
    if (context.currentWeather === 'clear') confidence += 0.1;
    if (context.activeEvents.length === 0) confidence += 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generate reasoning for resolved schedule
   */
  private generateReasoning(
    variance: { location: string; intent: string },
    context: ScheduleContext
  ): string {
    const reasons: string[] = [];

    // Weather-based reasoning
    if (context.currentWeather === 'storm') {
      reasons.push('seeking shelter from storm');
    } else if (context.currentWeather === 'clear') {
      reasons.push('enjoying clear weather');
    }

    // Event-based reasoning
    if (context.activeEvents.length > 0) {
      reasons.push(`participating in ${context.activeEvents[0]}`);
    }

    // Quest-based reasoning
    if (context.activeQuests.length > 0) {
      reasons.push(`working on ${context.activeQuests[0]}`);
    }

    // Personality-based reasoning
    if (context.npcPersonality) {
      const traits = context.npcPersonality.traits || [];
      if (traits.includes('curious')) {
        reasons.push('curiosity driving exploration');
      }
      if (traits.includes('cautious')) {
        reasons.push('caution influencing behavior');
      }
    }

    return reasons.length > 0 ? reasons.join(', ') : 'following normal schedule';
  }

  /**
   * Check if condition is active
   */
  private isConditionActive(condition: string, context: ScheduleContext): boolean {
    switch (condition) {
      case 'storm':
        return context.currentWeather === 'storm';
      case 'festival':
        return context.activeEvents.includes('event.festival_herbal');
      case 'danger':
        return context.worldFlags.danger === true;
      default:
        return false;
    }
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(context: ScheduleContext, entry: ScheduleEntry): number {
    const seedString = `${context.currentBand}:${entry.location}:${entry.intent}`;
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

  /**
   * Set schedules (for testing)
   */
  setSchedules(schedules: Map<string, NPCSchedule>): void {
    this.schedules = schedules;
  }
}

// Singleton instance
export const npcScheduleResolver = new NPCScheduleResolver();


