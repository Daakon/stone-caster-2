/**
 * Phase 18: Party Acts Integration
 * Extends AWF acts system for party operations
 */

import { z } from 'zod';
import { partyEngine, PartyState } from './party-engine.js';
import { partyIntentPolicy } from '../policies/party-intent-policy.js';

// Types
export interface PartyAct {
  type: 'PARTY_RECRUIT' | 'PARTY_DISMISS' | 'PARTY_SWAP' | 'PARTY_SET_INTENT' | 
        'PARTY_DELEGATE_CHECK' | 'PARTY_PASS_ITEM' | 'PARTY_EQUIP' | 'PARTY_UNEQUIP' | 
        'PARTY_SET_FORMATION';
  npcId?: string;
  a?: string;
  b?: string;
  intent?: string;
  skill?: string;
  diff?: number;
  mods?: Record<string, number>;
  mode?: string;
  fromId?: string;
  toId?: string;
  itemId?: string;
  qty?: number;
  slot?: string;
  order?: string[];
}

export interface PartyContext {
  sessionId: string;
  turnId: number;
  nodeId: string;
  trustLevels: Record<string, number>;
  completedQuests: string[];
  worldEvents: string[];
  resources: Record<string, number>;
  pacing: 'slow' | 'normal' | 'fast';
  activeNodeType: string;
  nodeDifficulty: 'easy' | 'medium' | 'hard' | 'extreme';
}

export interface PartyActResult {
  success: boolean;
  newActs: PartyAct[];
  summary: string;
  errors: string[];
}

// Schemas
const PartyActSchema = z.object({
  type: z.enum([
    'PARTY_RECRUIT',
    'PARTY_DISMISS', 
    'PARTY_SWAP',
    'PARTY_SET_INTENT',
    'PARTY_DELEGATE_CHECK',
    'PARTY_PASS_ITEM',
    'PARTY_EQUIP',
    'PARTY_UNEQUIP',
    'PARTY_SET_FORMATION'
  ]),
  npcId: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
  intent: z.string().optional(),
  skill: z.string().optional(),
  diff: z.number().int().min(1).max(100).optional(),
  mods: z.record(z.string(), z.number()).optional(),
  mode: z.string().optional(),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  itemId: z.string().optional(),
  qty: z.number().int().min(1).optional(),
  slot: z.string().optional(),
  order: z.array(z.string()).optional(),
});

const PartyContextSchema = z.object({
  sessionId: z.string(),
  turnId: z.number().int().min(0),
  nodeId: z.string(),
  trustLevels: z.record(z.string(), z.number().min(0).max(100)),
  completedQuests: z.array(z.string()),
  worldEvents: z.array(z.string()),
  resources: z.record(z.string(), z.number()),
  pacing: z.enum(['slow', 'normal', 'fast']),
  activeNodeType: z.string(),
  nodeDifficulty: z.enum(['easy', 'medium', 'hard', 'extreme']),
});

export class PartyActsIntegration {
  /**
   * Process party acts
   */
  processPartyActs(
    acts: PartyAct[],
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    const newActs: PartyAct[] = [];
    const errors: string[] = [];
    let summary = '';

    // Validate acts count
    if (acts.length > 3) {
      errors.push('Too many party acts per turn (max 3)');
      return { success: false, newActs: [], summary: 'Too many party acts', errors };
    }

    for (const act of acts) {
      try {
        const result = this.processPartyAct(act, partyState, context);
        if (result.success) {
          newActs.push(...result.newActs);
          summary += result.summary + ' ';
        } else {
          errors.push(...result.errors);
        }
      } catch (error) {
        errors.push(`Error processing ${act.type}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      newActs,
      summary: summary.trim(),
      errors,
    };
  }

  /**
   * Process individual party act
   */
  private processPartyAct(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    switch (act.type) {
      case 'PARTY_RECRUIT':
        return this.processRecruit(act, partyState, context);
      case 'PARTY_DISMISS':
        return this.processDismiss(act, partyState, context);
      case 'PARTY_SWAP':
        return this.processSwap(act, partyState, context);
      case 'PARTY_SET_INTENT':
        return this.processSetIntent(act, partyState, context);
      case 'PARTY_DELEGATE_CHECK':
        return this.processDelegateCheck(act, partyState, context);
      case 'PARTY_PASS_ITEM':
        return this.processPassItem(act, partyState, context);
      case 'PARTY_EQUIP':
        return this.processEquip(act, partyState, context);
      case 'PARTY_UNEQUIP':
        return this.processUnequip(act, partyState, context);
      case 'PARTY_SET_FORMATION':
        return this.processSetFormation(act, partyState, context);
      default:
        return {
          success: false,
          newActs: [],
          summary: `Unknown party act: ${act.type}`,
          errors: [`Unknown party act: ${act.type}`],
        };
    }
  }

  /**
   * Process PARTY_RECRUIT act
   */
  private processRecruit(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId) {
      return {
        success: false,
        newActs: [],
        summary: 'Recruit failed: missing npcId',
        errors: ['Missing npcId for PARTY_RECRUIT'],
      };
    }

    const trustLevel = context.trustLevels[act.npcId] || 0;
    const result = partyEngine.recruitCompanion(
      partyState,
      act.npcId,
      trustLevel,
      context.completedQuests,
      context.worldEvents
    );

    if (result.success) {
      const companion = partyEngine.getCompanion(act.npcId);
      const summary = result.moved_to_reserve 
        ? `Recruited ${companion?.name || act.npcId} to reserve`
        : `Recruited ${companion?.name || act.npcId} to party`;

      return {
        success: true,
        newActs: [],
        summary,
        errors: [],
      };
    }

    return {
      success: false,
      newActs: [],
      summary: `Recruit failed: ${result.errors.join(', ')}`,
      errors: result.errors,
    };
  }

  /**
   * Process PARTY_DISMISS act
   */
  private processDismiss(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId) {
      return {
        success: false,
        newActs: [],
        summary: 'Dismiss failed: missing npcId',
        errors: ['Missing npcId for PARTY_DISMISS'],
      };
    }

    const result = partyEngine.dismissCompanion(partyState, act.npcId);
    const companion = partyEngine.getCompanion(act.npcId);

    if (result.success) {
      return {
        success: true,
        newActs: [],
        summary: `Dismissed ${companion?.name || act.npcId} from party`,
        errors: [],
      };
    }

    return {
      success: false,
      newActs: [],
      summary: `Dismiss failed: ${result.errors.join(', ')}`,
      errors: result.errors,
    };
  }

  /**
   * Process PARTY_SWAP act
   */
  private processSwap(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.a || !act.b) {
      return {
        success: false,
        newActs: [],
        summary: 'Swap failed: missing members',
        errors: ['Missing a or b for PARTY_SWAP'],
      };
    }

    const result = partyEngine.swapCompanions(partyState, act.a, act.b);

    if (result.success) {
      return {
        success: true,
        newActs: [],
        summary: `Swapped ${act.a} and ${act.b} in formation`,
        errors: [],
      };
    }

    return {
      success: false,
      newActs: [],
      summary: `Swap failed: ${result.errors.join(', ')}`,
      errors: result.errors,
    };
  }

  /**
   * Process PARTY_SET_INTENT act
   */
  private processSetIntent(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId || !act.intent) {
      return {
        success: false,
        newActs: [],
        summary: 'Set intent failed: missing parameters',
        errors: ['Missing npcId or intent for PARTY_SET_INTENT'],
      };
    }

    const result = partyEngine.setIntent(partyState, act.npcId, act.intent);

    if (result.success) {
      return {
        success: true,
        newActs: [],
        summary: `Set ${act.npcId} intent to ${act.intent}`,
        errors: [],
      };
    }

    return {
      success: false,
      newActs: [],
      summary: `Set intent failed: ${result.errors.join(', ')}`,
      errors: result.errors,
    };
  }

  /**
   * Process PARTY_DELEGATE_CHECK act
   */
  private processDelegateCheck(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId || !act.skill || !act.diff) {
      return {
        success: false,
        newActs: [],
        summary: 'Delegate check failed: missing parameters',
        errors: ['Missing npcId, skill, or diff for PARTY_DELEGATE_CHECK'],
      };
    }

    const companion = partyEngine.getCompanion(act.npcId);
    if (!companion) {
      return {
        success: false,
        newActs: [],
        summary: 'Delegate check failed: unknown companion',
        errors: [`Unknown companion: ${act.npcId}`],
      };
    }

    // Get skill baseline
    const skillBaseline = companion.skill_baselines[act.skill] || 0;
    
    // Generate skill check act
    const skillCheckAct: PartyAct = {
      type: 'PARTY_DELEGATE_CHECK',
      npcId: act.npcId,
      skill: act.skill,
      diff: act.diff,
      mods: act.mods,
      mode: act.mode,
    };

    return {
      success: true,
      newActs: [skillCheckAct],
      summary: `Delegated ${act.skill} check to ${companion.name}`,
      errors: [],
    };
  }

  /**
   * Process PARTY_PASS_ITEM act
   */
  private processPassItem(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.fromId || !act.toId || !act.itemId || !act.qty) {
      return {
        success: false,
        newActs: [],
        summary: 'Pass item failed: missing parameters',
        errors: ['Missing fromId, toId, itemId, or qty for PARTY_PASS_ITEM'],
      };
    }

    // This would integrate with inventory engine from Phase 17
    // For now, just validate the act
    return {
      success: true,
      newActs: [],
      summary: `Passed ${act.qty} ${act.itemId} from ${act.fromId} to ${act.toId}`,
      errors: [],
    };
  }

  /**
   * Process PARTY_EQUIP act
   */
  private processEquip(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId || !act.slot || !act.itemId) {
      return {
        success: false,
        newActs: [],
        summary: 'Equip failed: missing parameters',
        errors: ['Missing npcId, slot, or itemId for PARTY_EQUIP'],
      };
    }

    // This would integrate with inventory engine from Phase 17
    // For now, just validate the act
    return {
      success: true,
      newActs: [],
      summary: `Equipped ${act.itemId} to ${act.npcId} ${act.slot}`,
      errors: [],
    };
  }

  /**
   * Process PARTY_UNEQUIP act
   */
  private processUnequip(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.npcId || !act.slot) {
      return {
        success: false,
        newActs: [],
        summary: 'Unequip failed: missing parameters',
        errors: ['Missing npcId or slot for PARTY_UNEQUIP'],
      };
    }

    // This would integrate with inventory engine from Phase 17
    // For now, just validate the act
    return {
      success: true,
      newActs: [],
      summary: `Unequipped ${act.npcId} ${act.slot}`,
      errors: [],
    };
  }

  /**
   * Process PARTY_SET_FORMATION act
   */
  private processSetFormation(
    act: PartyAct,
    partyState: PartyState,
    context: PartyContext
  ): PartyActResult {
    if (!act.order) {
      return {
        success: false,
        newActs: [],
        summary: 'Set formation failed: missing order',
        errors: ['Missing order for PARTY_SET_FORMATION'],
      };
    }

    const result = partyEngine.setFormation(partyState, act.order);

    if (result.success) {
      return {
        success: true,
        newActs: [],
        summary: `Set formation: ${act.order.join(', ')}`,
        errors: [],
      };
    }

    return {
      success: false,
      newActs: [],
      summary: `Set formation failed: ${result.errors.join(', ')}`,
      errors: result.errors,
    };
  }

  /**
   * Auto-update intents based on context
   */
  autoUpdateIntents(
    partyState: PartyState,
    context: PartyContext
  ): PartyAct[] {
    const newActs: PartyAct[] = [];

    for (const npcId of partyState.companions) {
      const companion = partyEngine.getCompanion(npcId);
      if (!companion) continue;

      const intentContext = {
        sessionId: context.sessionId,
        turnId: context.turnId,
        activeNodeType: context.activeNodeType,
        nodeDifficulty: context.nodeDifficulty,
        resources: context.resources,
        pacing: context.pacing,
        companionTraits: companion.traits,
        companionTrust: context.trustLevels[npcId] || 0,
        companionRole: companion.role,
      };

      const currentIntent = partyState.intents[npcId];
      const newIntent = partyIntentPolicy.updateIntent(currentIntent, intentContext);

      if (newIntent.intent !== currentIntent) {
        newActs.push({
          type: 'PARTY_SET_INTENT',
          npcId,
          intent: newIntent.intent,
        });
      }
    }

    return newActs;
  }
}

// Singleton instance
export const partyActsIntegration = new PartyActsIntegration();


