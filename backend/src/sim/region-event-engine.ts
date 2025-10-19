/**
 * Phase 19: Region & Event Engine
 * Handles region state drift and event triggering
 */

import { z } from 'zod';

// Types
export interface RegionState {
  regionId: string;
  prosperity: number;
  threat: number;
  travel_risk: number;
  last_event?: string;
}

export interface RegionConfig {
  id: string;
  name: string;
  coords: [number, number];
  tags: string[];
  base_prosperity: number;
  base_threat: number;
  base_travel_risk: number;
  drift_rules: {
    prosperity: { min: number; max: number; step: number };
    threat: { min: number; max: number; step: number };
    travel_risk: { min: number; max: number; step: number };
  };
  weather_zone: string;
  nearby_regions: string[];
}

export interface EventConfig {
  id: string;
  name: string;
  type: string;
  guards: {
    region_prosperity_min?: number;
    region_prosperity_max?: number;
    region_threat_min?: number;
    region_threat_max?: number;
    band?: string[];
    rarity: number;
  };
  trigger_window: {
    start_day: number;
    end_day: number;
    frequency: string;
  };
  effects: Array<{
    type: string;
    regionId?: string;
    threatDelta?: number;
    prosperityDelta?: number;
    travelRiskDelta?: number;
    key?: string;
    val?: any;
  }>;
  duration: number;
  rarity_weight: number;
}

export interface EventTrigger {
  eventId: string;
  regionId: string;
  effects: Array<{
    type: string;
    regionId?: string;
    threatDelta?: number;
    prosperityDelta?: number;
    travelRiskDelta?: number;
    key?: string;
    val?: any;
  }>;
}

export interface RegionDelta {
  regionId: string;
  threatDelta: number;
  prosperityDelta: number;
  travelRiskDelta: number;
}

// Schemas
const RegionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  coords: z.tuple([z.number(), z.number()]),
  tags: z.array(z.string()),
  base_prosperity: z.number().min(0).max(100),
  base_threat: z.number().min(0).max(100),
  base_travel_risk: z.number().min(0).max(100),
  drift_rules: z.object({
    prosperity: z.object({ min: z.number(), max: z.number(), step: z.number() }),
    threat: z.object({ min: z.number(), max: z.number(), step: z.number() }),
    travel_risk: z.object({ min: z.number(), max: z.number(), step: z.number() }),
  }),
  weather_zone: z.string(),
  nearby_regions: z.array(z.string()),
});

const EventConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  guards: z.object({
    region_prosperity_min: z.number().optional(),
    region_prosperity_max: z.number().optional(),
    region_threat_min: z.number().optional(),
    region_threat_max: z.number().optional(),
    band: z.array(z.string()).optional(),
    rarity: z.number().min(0).max(1),
  }),
  trigger_window: z.object({
    start_day: z.number().min(0),
    end_day: z.number().min(0),
    frequency: z.string(),
  }),
  effects: z.array(z.object({
    type: z.string(),
    regionId: z.string().optional(),
    threatDelta: z.number().optional(),
    prosperityDelta: z.number().optional(),
    travelRiskDelta: z.number().optional(),
    key: z.string().optional(),
    val: z.any().optional(),
  })),
  duration: z.number().min(1),
  rarity_weight: z.number().min(0),
});

export class RegionEventEngine {
  private regions: Map<string, RegionConfig> = new Map();
  private events: Map<string, EventConfig> = new Map();
  private activeEvents: Map<string, { eventId: string; startTime: number; duration: number }> = new Map();

  constructor() {
    // Initialize with empty registries
  }

  /**
   * Drift region metrics based on configuration
   */
  driftRegionMetrics(
    regions: Record<string, RegionState>,
    rng: () => number
  ): RegionDelta[] {
    const deltas: RegionDelta[] = [];

    for (const [regionId, regionState] of Object.entries(regions)) {
      const regionConfig = this.regions.get(regionId);
      if (!regionConfig) continue;

      const driftRules = regionConfig.drift_rules;
      
      // Calculate drift for each metric
      const prosperityDelta = this.calculateDrift(
        regionState.prosperity,
        driftRules.prosperity,
        rng
      );
      
      const threatDelta = this.calculateDrift(
        regionState.threat,
        driftRules.threat,
        rng
      );
      
      const travelRiskDelta = this.calculateDrift(
        regionState.travel_risk,
        driftRules.travel_risk,
        rng
      );

      // Only include deltas that have actual changes
      if (prosperityDelta !== 0 || threatDelta !== 0 || travelRiskDelta !== 0) {
        deltas.push({
          regionId,
          threatDelta,
          prosperityDelta,
          travelRiskDelta,
        });
      }
    }

    return deltas;
  }

  /**
   * Evaluate and trigger events
   */
  evaluateEvents(
    regions: Record<string, RegionState>,
    context: {
      dayIndex: number;
      band: string;
      worldFlags: Record<string, any>;
    },
    rng: () => number
  ): EventTrigger[] {
    const triggers: EventTrigger[] = [];

    for (const [eventId, eventConfig] of this.events) {
      // Check if event is already active
      if (this.activeEvents.has(eventId)) {
        continue;
      }

      // Check if event is within trigger window
      if (!this.isWithinTriggerWindow(eventConfig, context.dayIndex)) {
        continue;
      }

      // Check if event guards are met
      if (this.checkEventGuards(eventConfig, regions, context)) {
        // Roll for event trigger based on rarity
        const roll = rng();
        const triggerChance = eventConfig.rarity_weight / 100;
        
        if (roll < triggerChance) {
          const trigger = this.createEventTrigger(eventConfig, regions, context);
          if (trigger) {
            triggers.push(trigger);
            this.activeEvents.set(eventId, {
              eventId,
              startTime: context.dayIndex,
              duration: eventConfig.duration,
            });
          }
        }
      }
    }

    // Clean up expired events
    this.cleanupExpiredEvents(context.dayIndex);

    return triggers;
  }

  /**
   * Calculate drift for a metric
   */
  private calculateDrift(current: number, rules: { min: number; max: number; step: number }, rng: () => number): number {
    const step = rules.step;
    const direction = rng() < 0.5 ? -1 : 1;
    const magnitude = Math.floor(rng() * step) + 1;
    
    const newValue = current + (direction * magnitude);
    const clampedValue = Math.max(rules.min, Math.min(rules.max, newValue));
    
    return clampedValue - current;
  }

  /**
   * Check if event is within trigger window
   */
  private isWithinTriggerWindow(eventConfig: EventConfig, dayIndex: number): boolean {
    const window = eventConfig.trigger_window;
    return dayIndex >= window.start_day && dayIndex <= window.end_day;
  }

  /**
   * Check if event guards are met
   */
  private checkEventGuards(
    eventConfig: EventConfig,
    regions: Record<string, RegionState>,
    context: { band: string; worldFlags: Record<string, any> }
  ): boolean {
    const guards = eventConfig.guards;

    // Check band requirement
    if (guards.band && !guards.band.includes(context.band)) {
      return false;
    }

    // Check region requirements
    for (const [regionId, regionState] of Object.entries(regions)) {
      if (guards.region_prosperity_min && regionState.prosperity < guards.region_prosperity_min) {
        return false;
      }
      if (guards.region_prosperity_max && regionState.prosperity > guards.region_prosperity_max) {
        return false;
      }
      if (guards.region_threat_min && regionState.threat < guards.region_threat_min) {
        return false;
      }
      if (guards.region_threat_max && regionState.threat > guards.region_threat_max) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create event trigger
   */
  private createEventTrigger(
    eventConfig: EventConfig,
    regions: Record<string, RegionState>,
    context: { dayIndex: number; band: string; worldFlags: Record<string, any> }
  ): EventTrigger | null {
    // Find the most appropriate region for this event
    const targetRegion = this.findTargetRegion(eventConfig, regions);
    if (!targetRegion) {
      return null;
    }

    return {
      eventId: eventConfig.id,
      regionId: targetRegion,
      effects: eventConfig.effects,
    };
  }

  /**
   * Find target region for event
   */
  private findTargetRegion(eventConfig: EventConfig, regions: Record<string, RegionState>): string | null {
    // For now, return the first region that meets the requirements
    // In a more sophisticated implementation, this could consider proximity, importance, etc.
    for (const [regionId, regionState] of Object.entries(regions)) {
      const guards = eventConfig.guards;
      
      let meetsRequirements = true;
      
      if (guards.region_prosperity_min && regionState.prosperity < guards.region_prosperity_min) {
        meetsRequirements = false;
      }
      if (guards.region_prosperity_max && regionState.prosperity > guards.region_prosperity_max) {
        meetsRequirements = false;
      }
      if (guards.region_threat_min && regionState.threat < guards.region_threat_min) {
        meetsRequirements = false;
      }
      if (guards.region_threat_max && regionState.threat > guards.region_threat_max) {
        meetsRequirements = false;
      }

      if (meetsRequirements) {
        return regionId;
      }
    }

    return null;
  }

  /**
   * Clean up expired events
   */
  private cleanupExpiredEvents(dayIndex: number): void {
    for (const [eventId, activeEvent] of this.activeEvents) {
      if (dayIndex >= activeEvent.startTime + activeEvent.duration) {
        this.activeEvents.delete(eventId);
      }
    }
  }

  /**
   * Get region configuration
   */
  getRegionConfig(regionId: string): RegionConfig | undefined {
    return this.regions.get(regionId);
  }

  /**
   * Get event configuration
   */
  getEventConfig(eventId: string): EventConfig | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get active events
   */
  getActiveEvents(): string[] {
    return Array.from(this.activeEvents.keys());
  }

  /**
   * Set regions (for testing)
   */
  setRegions(regions: Map<string, RegionConfig>): void {
    this.regions = regions;
  }

  /**
   * Set events (for testing)
   */
  setEvents(events: Map<string, EventConfig>): void {
    this.events = events;
  }

  /**
   * Clear active events (for testing)
   */
  clearActiveEvents(): void {
    this.activeEvents.clear();
  }
}

// Singleton instance
export const regionEventEngine = new RegionEventEngine();


