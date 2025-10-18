/**
 * Resource Curves & Clamp Policies
 * Manages resource regeneration, decay, and clamping
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ResourceDefinition {
  id: string;
  minValue: number;
  maxValue: number;
  regenPerTick: number;
  decayPerTick: number;
}

export interface ResourceMap {
  [key: string]: number;
}

export interface ResourceAction {
  type: 'RESOURCE_DELTA';
  key: string;
  delta: number;
  clamp?: 'soft' | 'hard';
}

export interface ResourceClampResult {
  newValue: number;
  clamped: boolean;
  reason?: string;
}

export class ResourcesEngine {
  private resourceRegistry: Map<string, ResourceDefinition> = new Map();

  constructor() {
    this.loadResourceRegistry();
  }

  /**
   * Apply resource delta with clamping
   */
  applyResourceDelta(
    currentValue: number,
    resourceId: string,
    delta: number,
    clamp: 'soft' | 'hard' = 'soft'
  ): ResourceClampResult {
    const resource = this.resourceRegistry.get(resourceId);
    if (!resource) {
      throw new Error(`Unknown resource: ${resourceId}`);
    }

    const newValue = currentValue + delta;
    const clampedValue = this.clampValue(newValue, resource, clamp);
    
    return {
      newValue: clampedValue,
      clamped: clampedValue !== newValue,
      reason: clampedValue !== newValue ? 'Resource bounds exceeded' : undefined,
    };
  }

  /**
   * Process resource regeneration and decay on TIME_ADVANCE
   */
  processResourceCurves(resources: ResourceMap): ResourceAction[] {
    const actions: ResourceAction[] = [];

    for (const [resourceId, currentValue] of Object.entries(resources)) {
      const resource = this.resourceRegistry.get(resourceId);
      if (!resource) continue;

      // Apply regeneration
      if (resource.regenPerTick > 0) {
        const regenDelta = this.calculateRegenDelta(currentValue, resource);
        if (regenDelta !== 0) {
          actions.push({
            type: 'RESOURCE_DELTA',
            key: resourceId,
            delta: regenDelta,
            clamp: 'soft',
          });
        }
      }

      // Apply decay
      if (resource.decayPerTick > 0) {
        const decayDelta = this.calculateDecayDelta(currentValue, resource);
        if (decayDelta !== 0) {
          actions.push({
            type: 'RESOURCE_DELTA',
            key: resourceId,
            delta: decayDelta,
            clamp: 'soft',
          });
        }
      }
    }

    return actions;
  }

  /**
   * Clamp resource value to bounds
   */
  clampValue(
    value: number,
    resource: ResourceDefinition,
    clamp: 'soft' | 'hard' = 'soft'
  ): number {
    if (clamp === 'hard') {
      return Math.max(resource.minValue, Math.min(resource.maxValue, value));
    } else {
      // Soft clamping - allow temporary over/under but apply gentle pressure
      if (value < resource.minValue) {
        return Math.max(resource.minValue, value + 1); // Gentle recovery
      }
      if (value > resource.maxValue) {
        return Math.min(resource.maxValue, value - 1); // Gentle decay
      }
      return value;
    }
  }

  /**
   * Get resource definition
   */
  getResourceDefinition(resourceId: string): ResourceDefinition | undefined {
    return this.resourceRegistry.get(resourceId);
  }

  /**
   * Get all resource definitions
   */
  getAllResourceDefinitions(): ResourceDefinition[] {
    return Array.from(this.resourceRegistry.values());
  }

  /**
   * Validate resource value against bounds
   */
  validateResourceValue(resourceId: string, value: number): boolean {
    const resource = this.resourceRegistry.get(resourceId);
    if (!resource) return false;
    
    return value >= resource.minValue && value <= resource.maxValue;
  }

  /**
   * Calculate regeneration delta based on current value
   */
  private calculateRegenDelta(currentValue: number, resource: ResourceDefinition): number {
    // Don't regenerate if at max
    if (currentValue >= resource.maxValue) return 0;
    
    // Apply diminishing returns for high values
    const regenRate = resource.regenPerTick;
    const maxGap = resource.maxValue - resource.minValue;
    const currentGap = resource.maxValue - currentValue;
    
    // Diminishing returns: regen rate decreases as we approach max
    const diminishingFactor = currentGap / maxGap;
    return Math.max(0, regenRate * diminishingFactor);
  }

  /**
   * Calculate decay delta based on current value
   */
  private calculateDecayDelta(currentValue: number, resource: ResourceDefinition): number {
    // Don't decay if at min
    if (currentValue <= resource.minValue) return 0;
    
    // Apply increasing decay for high values
    const decayRate = resource.decayPerTick;
    const maxGap = resource.maxValue - resource.minValue;
    const currentGap = currentValue - resource.minValue;
    
    // Increasing decay: decay rate increases as we move away from min
    const increasingFactor = currentGap / maxGap;
    return Math.min(0, -decayRate * increasingFactor);
  }

  /**
   * Load resource registry from database
   */
  private async loadResourceRegistry(): Promise<void> {
    try {
      const { data: resources, error } = await supabase
        .from('mechanics_resources')
        .select('*');

      if (error) {
        console.error('Failed to load resource registry:', error);
        return;
      }

      for (const resource of resources || []) {
        this.resourceRegistry.set(resource.id, {
          id: resource.id,
          minValue: resource.min_value,
          maxValue: resource.max_value,
          regenPerTick: parseFloat(resource.regen_per_tick || '0'),
          decayPerTick: parseFloat(resource.decay_per_tick || '0'),
        });
      }
    } catch (error) {
      console.error('Error loading resource registry:', error);
    }
  }
}

// Singleton instance
export const resourcesEngine = new ResourcesEngine();


