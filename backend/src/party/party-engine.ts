/**
 * Phase 18: Party Engine
 * Handles companion recruitment, party formation, and lifecycle management
 */

import { z } from 'zod';

// Types
export interface PartyState {
  leader: string;
  companions: string[];
  reserve: string[];
  marching_order: string[];
  intents: Record<string, string>;
}

export interface Companion {
  id: string;
  name: string;
  role: string;
  traits: string[];
  recruitment_conditions: {
    trust_min: number;
    quests_completed: string[];
    world_events: string[];
  };
  join_banter: string;
  leave_banter: string;
  party_rules: {
    refuses_hard_difficulty: boolean;
    trust_threshold: number;
    preferred_intent: string;
  };
  equipment_slots: Record<string, string | null>;
  skill_baselines: Record<string, number>;
}

export interface PartyConfig {
  max_active: number;
  max_reserve: number;
  max_acts_per_turn: number;
  default_intent: string;
  module_mode: 'off' | 'readonly' | 'full';
}

export interface RecruitmentResult {
  success: boolean;
  reason?: string;
  moved_to_reserve?: boolean;
  errors: string[];
}

export interface FormationResult {
  success: boolean;
  new_order: string[];
  errors: string[];
}

// Schemas
const PartyStateSchema = z.object({
  leader: z.string(),
  companions: z.array(z.string()),
  reserve: z.array(z.string()),
  marching_order: z.array(z.string()),
  intents: z.record(z.string(), z.string()),
});

const CompanionSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  traits: z.array(z.string()),
  recruitment_conditions: z.object({
    trust_min: z.number().min(0),
    quests_completed: z.array(z.string()),
    world_events: z.array(z.string()),
  }),
  join_banter: z.string(),
  leave_banter: z.string(),
  party_rules: z.object({
    refuses_hard_difficulty: z.boolean(),
    trust_threshold: z.number().min(0),
    preferred_intent: z.string(),
  }),
  equipment_slots: z.record(z.string(), z.string().nullable()),
  skill_baselines: z.record(z.string(), z.number().min(0).max(100)),
});

const PartyConfigSchema = z.object({
  max_active: z.number().int().min(1).max(10),
  max_reserve: z.number().int().min(0).max(20),
  max_acts_per_turn: z.number().int().min(1).max(10),
  default_intent: z.string(),
  module_mode: z.enum(['off', 'readonly', 'full']),
});

export class PartyEngine {
  private companionsRegistry: Map<string, Companion> = new Map();
  private partyConfig: PartyConfig = {
    max_active: 4,
    max_reserve: 6,
    max_acts_per_turn: 3,
    default_intent: 'support',
    module_mode: 'full',
  };

  constructor() {
    // Initialize with empty registry
  }

  /**
   * Recruit a companion to the party
   */
  recruitCompanion(
    partyState: PartyState,
    npcId: string,
    trustLevel: number = 0,
    completedQuests: string[] = [],
    worldEvents: string[] = []
  ): RecruitmentResult {
    const errors: string[] = [];

    // Check if companion exists in registry
    const companion = this.companionsRegistry.get(npcId);
    if (!companion) {
      errors.push(`Unknown companion: ${npcId}`);
      return { success: false, errors };
    }

    // Check if already in party
    if (partyState.companions.includes(npcId) || partyState.reserve.includes(npcId)) {
      errors.push(`Companion already in party: ${npcId}`);
      return { success: false, errors };
    }

    // Check recruitment conditions
    if (trustLevel < companion.recruitment_conditions.trust_min) {
      errors.push(`Insufficient trust: ${trustLevel} < ${companion.recruitment_conditions.trust_min}`);
      return { success: false, errors };
    }

    // Check quest requirements
    for (const requiredQuest of companion.recruitment_conditions.quests_completed) {
      if (!completedQuests.includes(requiredQuest)) {
        errors.push(`Missing required quest: ${requiredQuest}`);
        return { success: false, errors };
      }
    }

    // Check world event requirements
    for (const requiredEvent of companion.recruitment_conditions.world_events) {
      if (!worldEvents.includes(requiredEvent)) {
        errors.push(`Missing required world event: ${requiredEvent}`);
        return { success: false, errors };
      }
    }

    // Check party capacity
    if (partyState.companions.length >= this.partyConfig.max_active) {
      // Move to reserve if reserve has space
      if (partyState.reserve.length < this.partyConfig.max_reserve) {
        partyState.reserve.push(npcId);
        return { success: true, moved_to_reserve: true, errors: [] };
      } else {
        errors.push('Party and reserve are full');
        return { success: false, errors };
      }
    }

    // Add to active companions
    partyState.companions.push(npcId);
    partyState.marching_order.push(npcId);
    partyState.intents[npcId] = companion.party_rules.preferred_intent;

    return { success: true, errors: [] };
  }

  /**
   * Dismiss a companion from the party
   */
  dismissCompanion(
    partyState: PartyState,
    npcId: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if companion is in party
    if (!partyState.companions.includes(npcId) && !partyState.reserve.includes(npcId)) {
      errors.push(`Companion not in party: ${npcId}`);
      return { success: false, errors };
    }

    // Remove from companions
    const companionIndex = partyState.companions.indexOf(npcId);
    if (companionIndex !== -1) {
      partyState.companions.splice(companionIndex, 1);
    }

    // Remove from reserve
    const reserveIndex = partyState.reserve.indexOf(npcId);
    if (reserveIndex !== -1) {
      partyState.reserve.splice(reserveIndex, 1);
    }

    // Remove from marching order
    const orderIndex = partyState.marching_order.indexOf(npcId);
    if (orderIndex !== -1) {
      partyState.marching_order.splice(orderIndex, 1);
    }

    // Remove intent
    delete partyState.intents[npcId];

    return { success: true, errors: [] };
  }

  /**
   * Swap companions in marching order
   */
  swapCompanions(
    partyState: PartyState,
    a: string,
    b: string
  ): FormationResult {
    const errors: string[] = [];

    // Validate both companions are in marching order
    const aIndex = partyState.marching_order.indexOf(a);
    const bIndex = partyState.marching_order.indexOf(b);

    if (aIndex === -1) {
      errors.push(`Companion not in marching order: ${a}`);
      return { success: false, new_order: partyState.marching_order, errors };
    }

    if (bIndex === -1) {
      errors.push(`Companion not in marching order: ${b}`);
      return { success: false, new_order: partyState.marching_order, errors };
    }

    // Perform swap
    const newOrder = [...partyState.marching_order];
    [newOrder[aIndex], newOrder[bIndex]] = [newOrder[bIndex], newOrder[aIndex]];
    partyState.marching_order = newOrder;

    return { success: true, new_order: newOrder, errors: [] };
  }

  /**
   * Set party formation order
   */
  setFormation(
    partyState: PartyState,
    newOrder: string[]
  ): FormationResult {
    const errors: string[] = [];

    // Validate all members are in the party
    const allMembers = [...partyState.companions, partyState.leader];
    for (const member of newOrder) {
      if (!allMembers.includes(member)) {
        errors.push(`Member not in party: ${member}`);
        return { success: false, new_order: partyState.marching_order, errors };
      }
    }

    // Validate it's a permutation
    const sortedNew = [...newOrder].sort();
    const sortedCurrent = [...allMembers].sort();
    if (JSON.stringify(sortedNew) !== JSON.stringify(sortedCurrent)) {
      errors.push('Formation must include all party members');
      return { success: false, new_order: partyState.marching_order, errors };
    }

    partyState.marching_order = newOrder;
    return { success: true, new_order: newOrder, errors: [] };
  }

  /**
   * Set companion intent
   */
  setIntent(
    partyState: PartyState,
    npcId: string,
    intent: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if companion is in party
    if (!partyState.companions.includes(npcId)) {
      errors.push(`Companion not in active party: ${npcId}`);
      return { success: false, errors };
    }

    // Validate intent
    const validIntents = ['support', 'guard', 'scout', 'assist_skill', 'harass', 'heal'];
    if (!validIntents.includes(intent)) {
      errors.push(`Invalid intent: ${intent}`);
      return { success: false, errors };
    }

    partyState.intents[npcId] = intent;
    return { success: true, errors: [] };
  }

  /**
   * Promote companion from reserve to active
   */
  promoteFromReserve(
    partyState: PartyState,
    npcId: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if companion is in reserve
    if (!partyState.reserve.includes(npcId)) {
      errors.push(`Companion not in reserve: ${npcId}`);
      return { success: false, errors };
    }

    // Check if party has space
    if (partyState.companions.length >= this.partyConfig.max_active) {
      errors.push('Party is full');
      return { success: false, errors };
    }

    // Move from reserve to active
    const reserveIndex = partyState.reserve.indexOf(npcId);
    partyState.reserve.splice(reserveIndex, 1);
    partyState.companions.push(npcId);
    partyState.marching_order.push(npcId);

    // Set default intent
    const companion = this.companionsRegistry.get(npcId);
    if (companion) {
      partyState.intents[npcId] = companion.party_rules.preferred_intent;
    } else {
      partyState.intents[npcId] = this.partyConfig.default_intent;
    }

    return { success: true, errors: [] };
  }

  /**
   * Get companion by ID
   */
  getCompanion(npcId: string): Companion | undefined {
    return this.companionsRegistry.get(npcId);
  }

  /**
   * Get all companions
   */
  getAllCompanions(): Companion[] {
    return Array.from(this.companionsRegistry.values());
  }

  /**
   * Validate party state
   */
  validatePartyState(partyState: PartyState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check leader is set
    if (!partyState.leader) {
      errors.push('Party leader must be set');
    }

    // Check companion count
    if (partyState.companions.length > this.partyConfig.max_active) {
      errors.push(`Too many active companions: ${partyState.companions.length} > ${this.partyConfig.max_active}`);
    }

    // Check reserve count
    if (partyState.reserve.length > this.partyConfig.max_reserve) {
      errors.push(`Too many reserve companions: ${partyState.reserve.length} > ${this.partyConfig.max_reserve}`);
    }

    // Check marching order includes all active members
    const expectedMembers = [partyState.leader, ...partyState.companions];
    for (const member of expectedMembers) {
      if (!partyState.marching_order.includes(member)) {
        errors.push(`Member missing from marching order: ${member}`);
      }
    }

    // Check intents are valid
    for (const [npcId, intent] of Object.entries(partyState.intents)) {
      const validIntents = ['support', 'guard', 'scout', 'assist_skill', 'harass', 'heal'];
      if (!validIntents.includes(intent)) {
        errors.push(`Invalid intent for ${npcId}: ${intent}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Set companions registry (for testing)
   */
  setCompanionsRegistry(registry: Map<string, Companion>): void {
    this.companionsRegistry = registry;
  }

  /**
   * Set party configuration
   */
  setPartyConfig(config: PartyConfig): void {
    this.partyConfig = config;
  }
}

// Singleton instance
export const partyEngine = new PartyEngine();


