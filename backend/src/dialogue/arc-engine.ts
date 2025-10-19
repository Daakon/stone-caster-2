/**
 * Phase 21: Story Arc Engine
 * Manages arc state machine and step progression
 */

import { z } from 'zod';

// Types
export interface ArcPhase {
  id: string;
  name: string;
  description: string;
}

export interface ArcStep {
  id: string;
  name: string;
  description: string;
  guards: Array<{
    type: string;
    [key: string]: any;
  }>;
  rewards: Array<{
    type: string;
    [key: string]: any;
  }>;
}

export interface RomanceFlags {
  eligible: boolean;
  min_trust?: number;
  consent_required?: boolean;
  cooldown_turns?: number;
}

export interface StoryArc {
  id: string;
  scope: 'npc' | 'relationship';
  world_ref: string;
  adventure_ref?: string;
  npc_id?: string;
  participants?: string[];
  phases: ArcPhase[];
  steps: ArcStep[];
  romance_flags: RomanceFlags;
  cooldowns: Record<string, number>;
}

export interface ArcState {
  arcId: string;
  currentPhase: string;
  currentStep?: string;
  progress: number;
  startedAt: number;
  completedAt?: number;
}

export interface ArcContext {
  sessionId: string;
  turnId: number;
  worldRef: string;
  adventureRef?: string;
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
}

export interface ArcResult {
  success: boolean;
  newState?: ArcState;
  newActs: Array<{
    type: string;
    [key: string]: any;
  }>;
  errors: string[];
}

// Schemas
const ArcPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const ArcStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  guards: z.array(z.object({
    type: z.string(),
  }).passthrough()),
  rewards: z.array(z.object({
    type: z.string(),
  }).passthrough()),
});

const RomanceFlagsSchema = z.object({
  eligible: z.boolean(),
  min_trust: z.number().int().min(0).max(100).optional(),
  consent_required: z.boolean().optional(),
  cooldown_turns: z.number().int().min(0).optional(),
});

const StoryArcSchema = z.object({
  id: z.string(),
  scope: z.enum(['npc', 'relationship']),
  world_ref: z.string(),
  adventure_ref: z.string().optional(),
  npc_id: z.string().optional(),
  participants: z.array(z.string()).optional(),
  phases: z.array(ArcPhaseSchema),
  steps: z.array(ArcStepSchema),
  romance_flags: RomanceFlagsSchema,
  cooldowns: z.record(z.string(), z.number().int().min(0)),
});

export class ArcEngine {
  private arcs: Map<string, StoryArc> = new Map();
  private states: Map<string, ArcState> = new Map();

  constructor() {
    // Initialize with empty state
  }

  /**
   * Start an arc
   */
  async startArc(
    arcId: string,
    context: ArcContext
  ): Promise<ArcResult> {
    try {
      const arc = this.arcs.get(arcId);
      if (!arc) {
        return {
          success: false,
          newActs: [],
          errors: [`Story arc not found: ${arcId}`],
        };
      }

      // Check if arc can be started
      if (!this.canStartArc(arc, context)) {
        return {
          success: false,
          newActs: [],
          errors: ['Arc cannot be started - requirements not met'],
        };
      }

      // Create new arc state
      const newState: ArcState = {
        arcId,
        currentPhase: 'available',
        progress: 0,
        startedAt: context.turnId,
      };

      this.states.set(arcId, newState);

      // Generate acts
      const newActs = this.generateStartActs(arc, newState);

      return {
        success: true,
        newState,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        newActs: [],
        errors: [`Arc start failed: ${error}`],
      };
    }
  }

  /**
   * Progress an arc
   */
  async progressArc(
    arcId: string,
    stepId: string,
    context: ArcContext
  ): Promise<ArcResult> {
    try {
      const arc = this.arcs.get(arcId);
      const state = this.states.get(arcId);
      
      if (!arc || !state) {
        return {
          success: false,
          newActs: [],
          errors: ['Arc or state not found'],
        };
      }

      // Find the step
      const step = arc.steps.find(s => s.id === stepId);
      if (!step) {
        return {
          success: false,
          newActs: [],
          errors: [`Step not found: ${stepId}`],
        };
      }

      // Check if step can be progressed
      if (!this.canProgressStep(arc, step, state, context)) {
        return {
          success: false,
          newActs: [],
          errors: ['Step cannot be progressed - requirements not met'],
        };
      }

      // Update state
      const updatedState: ArcState = {
        ...state,
        currentStep: stepId,
        progress: state.progress + 1,
      };

      this.states.set(arcId, updatedState);

      // Generate acts
      const newActs = this.generateProgressActs(arc, step, updatedState);

      return {
        success: true,
        newState: updatedState,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        newActs: [],
        errors: [`Arc progress failed: ${error}`],
      };
    }
  }

  /**
   * Complete an arc
   */
  async completeArc(
    arcId: string,
    context: ArcContext
  ): Promise<ArcResult> {
    try {
      const arc = this.arcs.get(arcId);
      const state = this.states.get(arcId);
      
      if (!arc || !state) {
        return {
          success: false,
          newActs: [],
          errors: ['Arc or state not found'],
        };
      }

      // Check if arc can be completed
      if (!this.canCompleteArc(arc, state, context)) {
        return {
          success: false,
          newActs: [],
          errors: ['Arc cannot be completed - requirements not met'],
        };
      }

      // Update state
      const updatedState: ArcState = {
        ...state,
        currentPhase: 'completed',
        completedAt: context.turnId,
      };

      this.states.set(arcId, updatedState);

      // Generate acts
      const newActs = this.generateCompleteActs(arc, updatedState);

      return {
        success: true,
        newState: updatedState,
        newActs,
        errors: [],
      };

    } catch (error) {
      return {
        success: false,
        newActs: [],
        errors: [`Arc completion failed: ${error}`],
      };
    }
  }

  /**
   * Check if arc can be started
   */
  private canStartArc(arc: StoryArc, context: ArcContext): boolean {
    // Check world/adventure match
    if (arc.world_ref !== context.worldRef) return false;
    if (arc.adventure_ref && arc.adventure_ref !== context.adventureRef) return false;

    // Check if already started
    const existingState = this.states.get(arc.id);
    if (existingState) return false;

    // Check romance requirements
    if (arc.romance_flags.eligible) {
      if (arc.romance_flags.consent_required) {
        const npcId = arc.npc_id || arc.participants?.[0];
        if (npcId) {
          const relationship = context.relationships[npcId];
          if (!relationship || relationship.consent !== 'yes') {
            return false;
          }
        }
      }

      if (arc.romance_flags.min_trust) {
        const npcId = arc.npc_id || arc.participants?.[0];
        if (npcId) {
          const relationship = context.relationships[npcId];
          if (!relationship || relationship.trust < arc.romance_flags.min_trust!) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Check if step can be progressed
   */
  private canProgressStep(
    arc: StoryArc,
    step: ArcStep,
    state: ArcState,
    context: ArcContext
  ): boolean {
    // Check guards
    for (const guard of step.guards) {
      if (!this.evaluateGuard(guard, context)) {
        return false;
      }
    }

    // Check cooldowns
    if (arc.cooldowns.step_progression) {
      const lastProgress = state.startedAt;
      const cooldownTurns = arc.cooldowns.step_progression;
      if (context.turnId - lastProgress < cooldownTurns) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if arc can be completed
   */
  private canCompleteArc(
    arc: StoryArc,
    state: ArcState,
    context: ArcContext
  ): boolean {
    // Check if all steps are completed
    if (state.progress < arc.steps.length) {
      return false;
    }

    // Check romance cooldowns
    if (arc.romance_flags.eligible && arc.romance_flags.cooldown_turns) {
      const lastRomanceScene = state.startedAt; // Simplified
      const cooldownTurns = arc.romance_flags.cooldown_turns;
      if (context.turnId - lastRomanceScene < cooldownTurns) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate guard condition
   */
  private evaluateGuard(guard: any, context: ArcContext): boolean {
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
        
      case 'sim':
        const event = guard.event;
        return context.sim.events.includes(event);
        
      default:
        return true;
    }
  }

  /**
   * Generate acts for arc start
   */
  private generateStartActs(arc: StoryArc, state: ArcState): Array<{
    type: string;
    [key: string]: any;
  }> {
    const acts: Array<{ type: string; [key: string]: any }> = [];

    // Set arc state
    acts.push({
      type: 'ARC_SET_STATE',
      arcId: arc.id,
      state: 'active',
    });

    return acts;
  }

  /**
   * Generate acts for arc progress
   */
  private generateProgressActs(
    arc: StoryArc,
    step: ArcStep,
    state: ArcState
  ): Array<{
    type: string;
    [key: string]: any;
  }> {
    const acts: Array<{ type: string; [key: string]: any }> = [];

    // Progress arc
    acts.push({
      type: 'ARC_PROGRESS',
      arcId: arc.id,
      stepId: step.id,
    });

    // Add step rewards
    for (const reward of step.rewards) {
      acts.push(reward);
    }

    return acts;
  }

  /**
   * Generate acts for arc completion
   */
  private generateCompleteActs(
    arc: StoryArc,
    state: ArcState
  ): Array<{
    type: string;
    [key: string]: any;
  }> {
    const acts: Array<{ type: string; [key: string]: any }> = [];

    // Complete arc
    acts.push({
      type: 'ARC_SET_STATE',
      arcId: arc.id,
      state: 'completed',
    });

    return acts;
  }

  /**
   * Get available arcs for context
   */
  getAvailableArcs(context: ArcContext): StoryArc[] {
    const available: StoryArc[] = [];

    for (const arc of this.arcs.values()) {
      if (this.canStartArc(arc, context)) {
        available.push(arc);
      }
    }

    return available;
  }

  /**
   * Get active arcs
   */
  getActiveArcs(): ArcState[] {
    return Array.from(this.states.values()).filter(state => 
      state.currentPhase === 'active'
    );
  }

  /**
   * Set arcs
   */
  setArcs(arcs: Map<string, StoryArc>): void {
    this.arcs = arcs;
  }

  /**
   * Set states
   */
  setStates(states: Map<string, ArcState>): void {
    this.states = states;
  }

  /**
   * Get arc state
   */
  getArcState(arcId: string): ArcState | undefined {
    return this.states.get(arcId);
  }
}

// Singleton instance
export const arcEngine = new ArcEngine();


