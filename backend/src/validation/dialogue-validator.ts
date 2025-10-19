/**
 * Phase 21: Dialogue Validator
 * Validates dialogue acts and enforces safety rules
 */

import { z } from 'zod';

// Types
export interface DialogueAct {
  type: string;
  [key: string]: any;
}

export interface ValidationContext {
  sessionId: string;
  turnId: number;
  moduleMode: 'off' | 'readonly' | 'full';
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
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  acts: DialogueAct[];
}

// Schemas
const DialogueActSchema = z.object({
  type: z.string(),
}).passthrough();

const DIALOGUE_ADVANCE_SCHEMA = z.object({
  type: z.literal('DIALOGUE_ADVANCE'),
  convId: z.string(),
  nodeId: z.string(),
});

const DIALOGUE_SET_SPEAKER_SCHEMA = z.object({
  type: z.literal('DIALOGUE_SET_SPEAKER'),
  speakerId: z.string(),
});

const DIALOGUE_SET_EMOTION_SCHEMA = z.object({
  type: z.literal('DIALOGUE_SET_EMOTION'),
  targetId: z.string(),
  tags: z.array(z.string()).max(4),
});

const DIALOGUE_SET_COOLDOWN_SCHEMA = z.object({
  type: z.literal('DIALOGUE_SET_COOLDOWN'),
  nodeId: z.string(),
  turns: z.number().int().min(0).max(10),
});

const ARC_SET_STATE_SCHEMA = z.object({
  type: z.literal('ARC_SET_STATE'),
  arcId: z.string(),
  state: z.enum(['available', 'active', 'completed', 'epilogue']),
});

const ARC_PROGRESS_SCHEMA = z.object({
  type: z.literal('ARC_PROGRESS'),
  arcId: z.string(),
  stepId: z.string(),
});

const ROMANCE_CONSENT_SET_SCHEMA = z.object({
  type: z.literal('ROMANCE_CONSENT_SET'),
  npcId: z.string(),
  value: z.enum(['yes', 'no', 'later']),
});

const BOUNDARY_SET_SCHEMA = z.object({
  type: z.literal('BOUNDARY_SET'),
  npcId: z.string(),
  boundaryKey: z.string(),
  value: z.boolean(),
});

const REACTION_MENU_SCHEMA = z.object({
  type: z.literal('REACTION_MENU'),
  reason: z.enum(['agency_conflict', 'safety', 'trust_low']),
  options: z.array(z.string()).max(5),
});

export class DialogueValidator {
  private maxDialogueActs: number = 3;
  private maxArcActs: number = 2;
  private maxRomanceActs: number = 1;
  private explicitContentBlock: boolean = true;

  constructor() {
    // Initialize with default settings
  }

  /**
   * Validate dialogue acts
   */
  validateDialogueActs(
    acts: DialogueAct[],
    context: ValidationContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validActs: DialogueAct[] = [];

    // Check module mode
    if (context.moduleMode === 'off') {
      return {
        valid: false,
        errors: ['Dialogue module is disabled'],
        warnings: [],
        acts: [],
      };
    }

    if (context.moduleMode === 'readonly') {
      return {
        valid: false,
        errors: ['Dialogue module is in readonly mode'],
        warnings: [],
        acts: [],
      };
    }

    // Count act types
    const actCounts = this.countActTypes(acts);
    
    // Check act limits
    if (actCounts.dialogue > this.maxDialogueActs) {
      errors.push(`Too many dialogue acts: ${actCounts.dialogue} > ${this.maxDialogueActs}`);
    }
    
    if (actCounts.arc > this.maxArcActs) {
      errors.push(`Too many arc acts: ${actCounts.arc} > ${this.maxArcActs}`);
    }
    
    if (actCounts.romance > this.maxRomanceActs) {
      errors.push(`Too many romance acts: ${actCounts.romance} > ${this.maxRomanceActs}`);
    }

    // Validate each act
    for (const act of acts) {
      const actValidation = this.validateAct(act, context);
      
      if (actValidation.valid) {
        validActs.push(act);
      } else {
        errors.push(...actValidation.errors);
      }
      
      warnings.push(...actValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      acts: validActs,
    };
  }

  /**
   * Validate individual act
   */
  private validateAct(
    act: DialogueAct,
    context: ValidationContext
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      switch (act.type) {
        case 'DIALOGUE_ADVANCE':
          this.validateDialogueAdvance(act, context, errors, warnings);
          break;
          
        case 'DIALOGUE_SET_SPEAKER':
          this.validateDialogueSetSpeaker(act, context, errors, warnings);
          break;
          
        case 'DIALOGUE_SET_EMOTION':
          this.validateDialogueSetEmotion(act, context, errors, warnings);
          break;
          
        case 'DIALOGUE_SET_COOLDOWN':
          this.validateDialogueSetCooldown(act, context, errors, warnings);
          break;
          
        case 'ARC_SET_STATE':
          this.validateArcSetState(act, context, errors, warnings);
          break;
          
        case 'ARC_PROGRESS':
          this.validateArcProgress(act, context, errors, warnings);
          break;
          
        case 'ROMANCE_CONSENT_SET':
          this.validateRomanceConsentSet(act, context, errors, warnings);
          break;
          
        case 'BOUNDARY_SET':
          this.validateBoundarySet(act, context, errors, warnings);
          break;
          
        case 'REACTION_MENU':
          this.validateReactionMenu(act, context, errors, warnings);
          break;
          
        default:
          errors.push(`Unknown dialogue act type: ${act.type}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Act validation failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate DIALOGUE_ADVANCE act
   */
  private validateDialogueAdvance(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = DIALOGUE_ADVANCE_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid DIALOGUE_ADVANCE format: ${validation.error.message}`);
      return;
    }

    // Check if conversation ID is valid
    if (!act.convId || act.convId.length === 0) {
      errors.push('Missing conversation ID');
    }

    // Check if node ID is valid
    if (!act.nodeId || act.nodeId.length === 0) {
      errors.push('Missing node ID');
    }
  }

  /**
   * Validate DIALOGUE_SET_SPEAKER act
   */
  private validateDialogueSetSpeaker(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = DIALOGUE_SET_SPEAKER_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid DIALOGUE_SET_SPEAKER format: ${validation.error.message}`);
      return;
    }

    // Check if speaker is valid
    if (!act.speakerId || act.speakerId.length === 0) {
      errors.push('Missing speaker ID');
    } else if (act.speakerId !== 'player' && !context.party.members.includes(act.speakerId)) {
      errors.push(`Invalid speaker: ${act.speakerId}`);
    }
  }

  /**
   * Validate DIALOGUE_SET_EMOTION act
   */
  private validateDialogueSetEmotion(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = DIALOGUE_SET_EMOTION_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid DIALOGUE_SET_EMOTION format: ${validation.error.message}`);
      return;
    }

    // Check emotion tags
    if (!act.tags || act.tags.length === 0) {
      errors.push('Missing emotion tags');
    } else if (act.tags.length > 4) {
      errors.push(`Too many emotion tags: ${act.tags.length} > 4`);
    }

    // Check for explicit content
    if (this.explicitContentBlock && this.containsExplicitContent(act.tags)) {
      errors.push('Explicit content in emotion tags');
    }
  }

  /**
   * Validate DIALOGUE_SET_COOLDOWN act
   */
  private validateDialogueSetCooldown(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = DIALOGUE_SET_COOLDOWN_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid DIALOGUE_SET_COOLDOWN format: ${validation.error.message}`);
      return;
    }

    // Check cooldown duration
    if (act.turns < 0 || act.turns > 10) {
      errors.push(`Invalid cooldown duration: ${act.turns}`);
    }
  }

  /**
   * Validate ARC_SET_STATE act
   */
  private validateArcSetState(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = ARC_SET_STATE_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid ARC_SET_STATE format: ${validation.error.message}`);
      return;
    }

    // Check arc ID
    if (!act.arcId || act.arcId.length === 0) {
      errors.push('Missing arc ID');
    }

    // Check state transition
    if (!this.isValidStateTransition(act.arcId, act.state, context)) {
      errors.push(`Invalid state transition for arc ${act.arcId} to ${act.state}`);
    }
  }

  /**
   * Validate ARC_PROGRESS act
   */
  private validateArcProgress(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = ARC_PROGRESS_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid ARC_PROGRESS format: ${validation.error.message}`);
      return;
    }

    // Check arc ID
    if (!act.arcId || act.arcId.length === 0) {
      errors.push('Missing arc ID');
    }

    // Check step ID
    if (!act.stepId || act.stepId.length === 0) {
      errors.push('Missing step ID');
    }
  }

  /**
   * Validate ROMANCE_CONSENT_SET act
   */
  private validateRomanceConsentSet(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = ROMANCE_CONSENT_SET_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid ROMANCE_CONSENT_SET format: ${validation.error.message}`);
      return;
    }

    // Check NPC ID
    if (!act.npcId || act.npcId.length === 0) {
      errors.push('Missing NPC ID');
    } else if (!context.relationships[act.npcId]) {
      errors.push(`NPC not found: ${act.npcId}`);
    }

    // Check consent value
    if (!['yes', 'no', 'later'].includes(act.value)) {
      errors.push(`Invalid consent value: ${act.value}`);
    }
  }

  /**
   * Validate BOUNDARY_SET act
   */
  private validateBoundarySet(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = BOUNDARY_SET_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid BOUNDARY_SET format: ${validation.error.message}`);
      return;
    }

    // Check NPC ID
    if (!act.npcId || act.npcId.length === 0) {
      errors.push('Missing NPC ID');
    } else if (!context.relationships[act.npcId]) {
      errors.push(`NPC not found: ${act.npcId}`);
    }

    // Check boundary key
    if (!act.boundaryKey || act.boundaryKey.length === 0) {
      errors.push('Missing boundary key');
    }
  }

  /**
   * Validate REACTION_MENU act
   */
  private validateReactionMenu(
    act: DialogueAct,
    context: ValidationContext,
    errors: string[],
    warnings: string[]
  ): void {
    const validation = REACTION_MENU_SCHEMA.safeParse(act);
    if (!validation.success) {
      errors.push(`Invalid REACTION_MENU format: ${validation.error.message}`);
      return;
    }

    // Check reason
    if (!['agency_conflict', 'safety', 'trust_low'].includes(act.reason)) {
      errors.push(`Invalid reaction reason: ${act.reason}`);
    }

    // Check options
    if (!act.options || act.options.length === 0) {
      errors.push('Missing reaction options');
    } else if (act.options.length > 5) {
      errors.push(`Too many reaction options: ${act.options.length} > 5`);
    }
  }

  /**
   * Count act types
   */
  private countActTypes(acts: DialogueAct[]): {
    dialogue: number;
    arc: number;
    romance: number;
  } {
    const counts = { dialogue: 0, arc: 0, romance: 0 };
    
    for (const act of acts) {
      if (act.type.startsWith('DIALOGUE_')) {
        counts.dialogue++;
      } else if (act.type.startsWith('ARC_')) {
        counts.arc++;
      } else if (act.type.startsWith('ROMANCE_') || act.type.startsWith('BOUNDARY_')) {
        counts.romance++;
      }
    }
    
    return counts;
  }

  /**
   * Check if state transition is valid
   */
  private isValidStateTransition(
    arcId: string,
    newState: string,
    context: ValidationContext
  ): boolean {
    // This would integrate with arc engine to check valid transitions
    // For now, allow all transitions
    return true;
  }

  /**
   * Check if content contains explicit material
   */
  private containsExplicitContent(content: string | string[]): boolean {
    const explicitKeywords = [
      'explicit', 'sexual', 'intimate', 'nude', 'naked',
      'sex', 'intercourse', 'foreplay', 'arousal'
    ];

    const contentStr = Array.isArray(content) ? content.join(' ') : content;
    const lowerContent = contentStr.toLowerCase();
    
    return explicitKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Set validation limits
   */
  setValidationLimits(limits: {
    maxDialogueActs: number;
    maxArcActs: number;
    maxRomanceActs: number;
    explicitContentBlock: boolean;
  }): void {
    this.maxDialogueActs = limits.maxDialogueActs;
    this.maxArcActs = limits.maxArcActs;
    this.maxRomanceActs = limits.maxRomanceActs;
    this.explicitContentBlock = limits.explicitContentBlock;
  }

  /**
   * Get current limits
   */
  getValidationLimits(): {
    maxDialogueActs: number;
    maxArcActs: number;
    maxRomanceActs: number;
    explicitContentBlock: boolean;
  } {
    return {
      maxDialogueActs: this.maxDialogueActs,
      maxArcActs: this.maxArcActs,
      maxRomanceActs: this.maxRomanceActs,
      explicitContentBlock: this.explicitContentBlock,
    };
  }
}

// Singleton instance
export const dialogueValidator = new DialogueValidator();


