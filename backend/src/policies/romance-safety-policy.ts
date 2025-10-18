/**
 * Phase 21: Romance & Safety Policy
 * Central rules for consent gating, boundaries, pacing cooldowns, and fade-to-black standards
 */

import { z } from 'zod';

// Types
export interface RomanceRules {
  boundaries: string[];
  pacing: 'slow' | 'medium' | 'fast';
  off_switch: boolean;
  fade_to_black: boolean;
  explicit_block: boolean;
}

export interface ConsentState {
  npcId: string;
  consent: 'yes' | 'no' | 'later';
  boundaries: Record<string, boolean>;
  lastConsentChange: number;
  cooldownUntil?: number;
}

export interface RomanceContext {
  sessionId: string;
  turnId: number;
  npcId: string;
  relationship: {
    trust: number;
    consent: 'yes' | 'no' | 'later';
    boundaries: Record<string, boolean>;
  };
  recentActs: Array<{
    type: string;
    timestamp: number;
  }>;
  sim: {
    weather: string;
    time: string;
    events: string[];
  };
}

export interface SafetyResult {
  allowed: boolean;
  reason?: string;
  suggestedAction?: string;
  cooldownRemaining?: number;
}

export interface ConsentResult {
  success: boolean;
  newConsent?: 'yes' | 'no' | 'later';
  newBoundaries?: Record<string, boolean>;
  errors: string[];
}

// Schemas
const RomanceRulesSchema = z.object({
  boundaries: z.array(z.string()),
  pacing: z.enum(['slow', 'medium', 'fast']),
  off_switch: z.boolean(),
  fade_to_black: z.boolean(),
  explicit_block: z.boolean(),
});

const ConsentStateSchema = z.object({
  npcId: z.string(),
  consent: z.enum(['yes', 'no', 'later']),
  boundaries: z.record(z.string(), z.boolean()),
  lastConsentChange: z.number().int().min(0),
  cooldownUntil: z.number().int().min(0).optional(),
});

export class RomanceSafetyPolicy {
  private consentStates: Map<string, ConsentState> = new Map();
  private romanceRules: Map<string, RomanceRules> = new Map();
  private explicitContentBlock: boolean = true;
  private minTrustForRomance: number = 65;
  private romanceCooldownTurns: number = 3;

  constructor() {
    // Initialize with default settings
  }

  /**
   * Check if romance action is allowed
   */
  checkRomanceAction(
    action: string,
    context: RomanceContext
  ): SafetyResult {
    try {
      const npcId = context.npcId;
      const relationship = context.relationship;
      const rules = this.romanceRules.get(npcId);

      // Check if romance is enabled for this NPC
      if (!rules) {
        return {
          allowed: false,
          reason: 'Romance not available for this NPC',
        };
      }

      // Check off switch
      if (rules.off_switch) {
        return {
          allowed: false,
          reason: 'Romance disabled for this NPC',
        };
      }

      // Check trust level
      if (relationship.trust < this.minTrustForRomance) {
        return {
          allowed: false,
          reason: `Trust level too low (${relationship.trust} < ${this.minTrustForRomance})`,
        };
      }

      // Check consent
      if (relationship.consent !== 'yes') {
        return {
          allowed: false,
          reason: 'Consent not given',
          suggestedAction: 'Request consent first',
        };
      }

      // Check boundaries
      if (this.violatesBoundaries(action, relationship.boundaries, rules.boundaries)) {
        return {
          allowed: false,
          reason: 'Action violates established boundaries',
        };
      }

      // Check cooldown
      const cooldownResult = this.checkCooldown(context);
      if (!cooldownResult.allowed) {
        return cooldownResult;
      }

      // Check explicit content
      if (this.explicitContentBlock && this.containsExplicitContent(action)) {
        return {
          allowed: false,
          reason: 'Explicit content blocked',
          suggestedAction: 'Use fade-to-black instead',
        };
      }

      return {
        allowed: true,
      };

    } catch (error) {
      return {
        allowed: false,
        reason: `Safety check failed: ${error}`,
      };
    }
  }

  /**
   * Set consent for an NPC
   */
  setConsent(
    npcId: string,
    consent: 'yes' | 'no' | 'later',
    boundaries: Record<string, boolean> = {},
    context: RomanceContext
  ): ConsentResult {
    try {
      // Validate consent change
      if (!this.canChangeConsent(npcId, context)) {
        return {
          success: false,
          errors: ['Cannot change consent at this time'],
        };
      }

      // Update consent state
      const consentState: ConsentState = {
        npcId,
        consent,
        boundaries,
        lastConsentChange: context.turnId,
      };

      this.consentStates.set(npcId, consentState);

      return {
        success: true,
        newConsent: consent,
        newBoundaries: boundaries,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Consent setting failed: ${error}`],
      };
    }
  }

  /**
   * Check if consent can be changed
   */
  private canChangeConsent(npcId: string, context: RomanceContext): boolean {
    const consentState = this.consentStates.get(npcId);
    
    if (!consentState) return true;

    // Check cooldown
    if (consentState.cooldownUntil && context.turnId < consentState.cooldownUntil) {
      return false;
    }

    // Check recent consent changes
    const timeSinceLastChange = context.turnId - consentState.lastConsentChange;
    if (timeSinceLastChange < 2) { // Minimum 2 turns between changes
      return false;
    }

    return true;
  }

  /**
   * Check if action violates boundaries
   */
  private violatesBoundaries(
    action: string,
    currentBoundaries: Record<string, boolean>,
    availableBoundaries: string[]
  ): boolean {
    // Check if action requires a boundary that's not set
    for (const boundary of availableBoundaries) {
      if (action.includes(boundary) && !currentBoundaries[boundary]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check cooldown requirements
   */
  private checkCooldown(context: RomanceContext): SafetyResult {
    const consentState = this.consentStates.get(context.npcId);
    
    if (!consentState) return { allowed: true };

    // Check if in cooldown period
    if (consentState.cooldownUntil && context.turnId < consentState.cooldownUntil) {
      return {
        allowed: false,
        reason: 'Romance cooldown active',
        cooldownRemaining: consentState.cooldownUntil - context.turnId,
      };
    }

    // Check recent romance acts
    const recentRomanceActs = context.recentActs.filter(act => 
      act.type.includes('ROMANCE') || act.type.includes('BOUNDARY')
    );

    if (recentRomanceActs.length > 0) {
      const lastAct = recentRomanceActs[recentRomanceActs.length - 1];
      const timeSinceLastAct = context.turnId - lastAct.timestamp;
      
      if (timeSinceLastAct < this.romanceCooldownTurns) {
        return {
          allowed: false,
          reason: 'Too soon after last romance action',
          cooldownRemaining: this.romanceCooldownTurns - timeSinceLastAct,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if content contains explicit material
   */
  private containsExplicitContent(content: string): boolean {
    const explicitKeywords = [
      'explicit', 'sexual', 'intimate', 'nude', 'naked',
      'sex', 'intercourse', 'foreplay', 'arousal'
    ];

    const lowerContent = content.toLowerCase();
    return explicitKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Get fade-to-black replacement
   */
  getFadeToBlackReplacement(originalContent: string): string {
    return 'The scene fades to black as the moment becomes more intimate.';
  }

  /**
   * Get time-skip replacement
   */
  getTimeSkipReplacement(originalContent: string): string {
    return 'Time passes as you share a private moment together.';
  }

  /**
   * Set romance rules for an NPC
   */
  setRomanceRules(npcId: string, rules: RomanceRules): void {
    this.romanceRules.set(npcId, rules);
  }

  /**
   * Get romance rules for an NPC
   */
  getRomanceRules(npcId: string): RomanceRules | undefined {
    return this.romanceRules.get(npcId);
  }

  /**
   * Set global safety settings
   */
  setSafetySettings(settings: {
    explicitContentBlock: boolean;
    minTrustForRomance: number;
    romanceCooldownTurns: number;
  }): void {
    this.explicitContentBlock = settings.explicitContentBlock;
    this.minTrustForRomance = settings.minTrustForRomance;
    this.romanceCooldownTurns = settings.romanceCooldownTurns;
  }

  /**
   * Get consent state for an NPC
   */
  getConsentState(npcId: string): ConsentState | undefined {
    return this.consentStates.get(npcId);
  }

  /**
   * Clear consent state for an NPC
   */
  clearConsentState(npcId: string): void {
    this.consentStates.delete(npcId);
  }

  /**
   * Get all consent states
   */
  getAllConsentStates(): ConsentState[] {
    return Array.from(this.consentStates.values());
  }

  /**
   * Validate romance content
   */
  validateRomanceContent(content: string): {
    valid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for explicit content
    if (this.containsExplicitContent(content)) {
      issues.push('Contains explicit content');
      suggestions.push('Use fade-to-black or time-skip instead');
    }

    // Check for consent language
    if (!content.includes('consent') && content.includes('romance')) {
      suggestions.push('Consider including consent language');
    }

    // Check for boundary respect
    if (content.includes('boundary') && content.includes('violate')) {
      issues.push('May violate boundaries');
      suggestions.push('Ensure boundaries are respected');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Get safety recommendations
   */
  getSafetyRecommendations(context: RomanceContext): string[] {
    const recommendations: string[] = [];

    // Trust recommendations
    if (context.relationship.trust < this.minTrustForRomance) {
      recommendations.push(`Build trust to at least ${this.minTrustForRomance} before romance`);
    }

    // Consent recommendations
    if (context.relationship.consent === 'no') {
      recommendations.push('Respect the "no" consent - do not pursue romance');
    } else if (context.relationship.consent === 'later') {
      recommendations.push('Wait for consent to change to "yes" before proceeding');
    }

    // Boundary recommendations
    const violatedBoundaries = Object.entries(context.relationship.boundaries)
      .filter(([_, value]) => !value)
      .map(([boundary, _]) => boundary);

    if (violatedBoundaries.length > 0) {
      recommendations.push(`Respect boundaries: ${violatedBoundaries.join(', ')}`);
    }

    // Cooldown recommendations
    const cooldownResult = this.checkCooldown(context);
    if (!cooldownResult.allowed && cooldownResult.cooldownRemaining) {
      recommendations.push(`Wait ${cooldownResult.cooldownRemaining} turns before next romance action`);
    }

    return recommendations;
  }
}

// Singleton instance
export const romanceSafetyPolicy = new RomanceSafetyPolicy();


