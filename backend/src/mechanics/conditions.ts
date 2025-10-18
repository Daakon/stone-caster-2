/**
 * Conditions/Status System
 * Manages status effects with stacking rules and per-tick hooks
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StatusCondition {
  id: string;
  stacking: 'none' | 'add' | 'cap';
  cap?: number;
  cleanseKeys: string[];
  tickHooks: {
    resourceDeltas?: Array<{
      key: string;
      delta: number;
    }>;
    [key: string]: any;
  };
}

export interface StatusInstance {
  conditionId: string;
  stacks: number;
  duration: number; // turns remaining
  potency?: number; // additional effect strength
  appliedAt: string;
}

export interface StatusMap {
  [targetKey: string]: {
    [conditionId: string]: StatusInstance;
  };
}

export interface StatusAction {
  type: 'APPLY_STATUS' | 'REMOVE_STATUS' | 'TICK_STATUS';
  target: string;
  key: string;
  stacks?: number;
  duration?: number;
  potency?: number;
}

export class ConditionsEngine {
  private readonly maxStack: number;
  private conditionRegistry: Map<string, StatusCondition> = new Map();

  constructor() {
    this.maxStack = parseInt(process.env.AWF_STATUS_MAX_STACK || '5');
    this.loadConditionRegistry();
  }

  /**
   * Apply a status condition to a target
   */
  applyStatus(
    target: string,
    conditionId: string,
    stacks: number = 1,
    duration: number = -1, // -1 = permanent until removed
    potency?: number
  ): StatusAction[] {
    const condition = this.conditionRegistry.get(conditionId);
    if (!condition) {
      throw new Error(`Unknown condition: ${conditionId}`);
    }

    const actions: StatusAction[] = [];
    
    // Check for cleansing conditions
    const cleanseActions = this.checkCleansing(target, conditionId);
    actions.push(...cleanseActions);

    // Apply stacking rules
    const finalStacks = this.calculateStacks(target, conditionId, stacks, condition);
    
    if (finalStacks > 0) {
      actions.push({
        type: 'APPLY_STATUS',
        target,
        key: conditionId,
        stacks: finalStacks,
        duration,
        potency,
      });
    }

    return actions;
  }

  /**
   * Remove a status condition from a target
   */
  removeStatus(target: string, conditionId: string): StatusAction[] {
    return [{
      type: 'REMOVE_STATUS',
      target,
      key: conditionId,
    }];
  }

  /**
   * Tick all status conditions (called on TIME_ADVANCE)
   */
  tickStatuses(statusMap: StatusMap): StatusAction[] {
    const actions: StatusAction[] = [];

    for (const [targetKey, targetStatuses] of Object.entries(statusMap)) {
      for (const [conditionId, instance] of Object.entries(targetStatuses)) {
        // Decrease duration
        if (instance.duration > 0) {
          instance.duration--;
          if (instance.duration === 0) {
            // Condition expired
            actions.push({
              type: 'REMOVE_STATUS',
              target: targetKey,
              key: conditionId,
            });
            continue;
          }
        }

        // Apply tick hooks
        const condition = this.conditionRegistry.get(conditionId);
        if (condition && condition.tickHooks) {
          const tickActions = this.processTickHooks(targetKey, conditionId, instance, condition.tickHooks);
          actions.push(...tickActions);
        }
      }
    }

    return actions;
  }

  /**
   * Get status conditions for a target
   */
  getTargetStatuses(statusMap: StatusMap, target: string): StatusInstance[] {
    const targetStatuses = statusMap[target] || {};
    return Object.values(targetStatuses);
  }

  /**
   * Check if target has a specific condition
   */
  hasCondition(statusMap: StatusMap, target: string, conditionId: string): boolean {
    const targetStatuses = statusMap[target] || {};
    return conditionId in targetStatuses;
  }

  /**
   * Get condition registry
   */
  getConditionRegistry(): Map<string, StatusCondition> {
    return this.conditionRegistry;
  }

  /**
   * Load condition registry from database
   */
  private async loadConditionRegistry(): Promise<void> {
    try {
      const { data: conditions, error } = await supabase
        .from('mechanics_conditions')
        .select('*');

      if (error) {
        console.error('Failed to load condition registry:', error);
        return;
      }

      for (const condition of conditions || []) {
        this.conditionRegistry.set(condition.id, {
          id: condition.id,
          stacking: condition.stacking,
          cap: condition.cap,
          cleanseKeys: condition.cleanse_keys || [],
          tickHooks: condition.tick_hooks || {},
        });
      }
    } catch (error) {
      console.error('Error loading condition registry:', error);
    }
  }

  /**
   * Check for cleansing conditions
   */
  private checkCleansing(target: string, conditionId: string): StatusAction[] {
    const actions: StatusAction[] = [];
    const condition = this.conditionRegistry.get(conditionId);
    
    if (!condition) return actions;

    // Check if this condition cleanses others
    for (const [otherConditionId, otherCondition] of this.conditionRegistry) {
      if (otherCondition.cleanseKeys.includes(conditionId)) {
        actions.push({
          type: 'REMOVE_STATUS',
          target,
          key: otherConditionId,
        });
      }
    }

    return actions;
  }

  /**
   * Calculate final stacks based on stacking rules
   */
  private calculateStacks(
    target: string,
    conditionId: string,
    newStacks: number,
    condition: StatusCondition
  ): number {
    switch (condition.stacking) {
      case 'none':
        // Only one instance allowed
        return newStacks;
      
      case 'add':
        // Additive stacking
        return newStacks;
      
      case 'cap':
        // Capped stacking
        const maxStacks = condition.cap || this.maxStack;
        return Math.min(newStacks, maxStacks);
      
      default:
        return newStacks;
    }
  }

  /**
   * Process tick hooks for a condition
   */
  private processTickHooks(
    target: string,
    conditionId: string,
    instance: StatusInstance,
    tickHooks: any
  ): StatusAction[] {
    const actions: StatusAction[] = [];

    // Process resource deltas
    if (tickHooks.resourceDeltas) {
      for (const delta of tickHooks.resourceDeltas) {
        const finalDelta = delta.delta * instance.stacks;
        if (instance.potency) {
          finalDelta *= instance.potency;
        }
        
        actions.push({
          type: 'TICK_STATUS',
          target,
          key: conditionId,
          stacks: instance.stacks,
          duration: instance.duration,
          potency: instance.potency,
        });
      }
    }

    return actions;
  }
}

// Singleton instance
export const conditionsEngine = new ConditionsEngine();


