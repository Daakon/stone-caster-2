/**
 * Phase 19: World Tick Engine
 * Deterministic world simulation that advances in ticks/bands
 */

import { z } from 'zod';

// Types
export interface WorldTickOptions {
  dryRun?: boolean;
  maxEvents?: number;
  maxRegions?: number;
}

export interface WorldTickResult {
  success: boolean;
  newActs: WorldAct[];
  summary: string;
  errors: string[];
  deltas: {
    regions: Record<string, RegionDelta>;
    weather: Record<string, WeatherChange>;
    events: EventTrigger[];
    npcs: Record<string, NPCScheduleHint>;
  };
}

export interface WorldAct {
  type: 'WORLD_FLAG_SET' | 'REGION_DELTA' | 'WEATHER_SET' | 'NPC_SCHEDULE_SET' | 'EVENT_TRIGGER';
  key?: string;
  val?: any;
  regionId?: string;
  threatDelta?: number;
  prosperityDelta?: number;
  travelRiskDelta?: number;
  state?: string;
  front?: string;
  npcId?: string;
  band?: string;
  loc?: string;
  intent?: string;
  eventId?: string;
}

export interface RegionDelta {
  regionId: string;
  threatDelta: number;
  prosperityDelta: number;
  travelRiskDelta: number;
}

export interface WeatherChange {
  regionId: string;
  state: string;
  front: string;
}

export interface EventTrigger {
  eventId: string;
  regionId: string;
  effects: WorldAct[];
}

export interface NPCScheduleHint {
  npcId: string;
  locKey: string;
  intent: string;
}

export interface SimulationState {
  clock: {
    day_index: number;
    band: string;
  };
  weather: {
    region: string;
    state: string;
    front: string;
  };
  regions: Record<string, {
    prosperity: number;
    threat: number;
    travel_risk: number;
    last_event?: string;
  }>;
  npcs: Record<string, {
    current_location: string;
    current_intent: string;
    last_update: number;
  }>;
}

// Schemas
const WorldActSchema = z.object({
  type: z.enum(['WORLD_FLAG_SET', 'REGION_DELTA', 'WEATHER_SET', 'NPC_SCHEDULE_SET', 'EVENT_TRIGGER']),
  key: z.string().optional(),
  val: z.any().optional(),
  regionId: z.string().optional(),
  threatDelta: z.number().optional(),
  prosperityDelta: z.number().optional(),
  travelRiskDelta: z.number().optional(),
  state: z.string().optional(),
  front: z.string().optional(),
  npcId: z.string().optional(),
  band: z.string().optional(),
  loc: z.string().optional(),
  intent: z.string().optional(),
  eventId: z.string().optional(),
});

export class WorldTickEngine {
  private regions: Map<string, any> = new Map();
  private events: Map<string, any> = new Map();
  private npcSchedules: Map<string, any> = new Map();
  private weatherEngine: any;
  private regionEventEngine: any;
  private npcScheduleResolver: any;

  constructor() {
    // Initialize with empty registries
  }

  /**
   * Advance world simulation by one tick
   */
  async advance(
    worldRef: string,
    gameState: SimulationState,
    options: WorldTickOptions = {}
  ): Promise<WorldTickResult> {
    const errors: string[] = [];
    const newActs: WorldAct[] = [];
    const deltas = {
      regions: {} as Record<string, RegionDelta>,
      weather: {} as Record<string, WeatherChange>,
      events: [] as EventTrigger[],
      npcs: {} as Record<string, NPCScheduleHint>,
    };

    try {
      // Generate deterministic seed
      const seed = this.generateSeed(worldRef, gameState.clock.day_index, gameState.clock.band);
      const rng = this.createRNG(seed);

      // 1. Roll weather transitions
      const weatherChanges = await this.rollWeatherTransitions(worldRef, gameState, rng);
      for (const change of weatherChanges) {
        deltas.weather[change.regionId] = change;
        newActs.push({
          type: 'WEATHER_SET',
          regionId: change.regionId,
          state: change.state,
          front: change.front,
        });
      }

      // 2. Drift region metrics
      const regionDeltas = await this.driftRegionMetrics(worldRef, gameState, rng);
      for (const delta of regionDeltas) {
        deltas.regions[delta.regionId] = delta;
        newActs.push({
          type: 'REGION_DELTA',
          regionId: delta.regionId,
          threatDelta: delta.threatDelta,
          prosperityDelta: delta.prosperityDelta,
          travelRiskDelta: delta.travelRiskDelta,
        });
      }

      // 3. Evaluate and trigger events
      const eventTriggers = await this.evaluateEvents(worldRef, gameState, rng);
      for (const trigger of eventTriggers) {
        deltas.events.push(trigger);
        newActs.push({
          type: 'EVENT_TRIGGER',
          eventId: trigger.eventId,
        });
        // Add event effects as separate acts
        newActs.push(...trigger.effects);
      }

      // 4. Resolve NPC schedules
      const npcHints = await this.resolveNPCSchedules(worldRef, gameState, rng);
      for (const hint of npcHints) {
        deltas.npcs[hint.npcId] = hint;
        newActs.push({
          type: 'NPC_SCHEDULE_SET',
          npcId: hint.npcId,
          band: gameState.clock.band,
          loc: hint.locKey,
          intent: hint.intent,
        });
      }

      // 5. Update simulation state (if not dry run)
      if (!options.dryRun) {
        await this.updateSimulationState(gameState, deltas);
      }

      return {
        success: true,
        newActs,
        summary: this.generateSummary(deltas),
        errors: [],
        deltas,
      };
    } catch (error) {
      errors.push(`World tick failed: ${error}`);
      return {
        success: false,
        newActs: [],
        summary: 'World tick failed',
        errors,
        deltas,
      };
    }
  }

  /**
   * Roll weather transitions for all regions
   */
  private async rollWeatherTransitions(
    worldRef: string,
    gameState: SimulationState,
    rng: () => number
  ): Promise<WeatherChange[]> {
    const changes: WeatherChange[] = [];
    
    // This would integrate with weather engine
    // For now, return mock changes
    const currentWeather = gameState.weather;
    const newState = this.getWeatherTransition(currentWeather.state, rng);
    
    if (newState !== currentWeather.state) {
      changes.push({
        regionId: currentWeather.region,
        state: newState,
        front: this.getWeatherFront(newState),
      });
    }

    return changes;
  }

  /**
   * Drift region metrics based on configuration
   */
  private async driftRegionMetrics(
    worldRef: string,
    gameState: SimulationState,
    rng: () => number
  ): Promise<RegionDelta[]> {
    const deltas: RegionDelta[] = [];
    
    for (const [regionId, regionState] of Object.entries(gameState.regions)) {
      const region = this.regions.get(regionId);
      if (!region) continue;

      const driftRules = region.drift_rules;
      const threatDelta = this.calculateDrift(regionState.threat, driftRules.threat, rng);
      const prosperityDelta = this.calculateDrift(regionState.prosperity, driftRules.prosperity, rng);
      const travelRiskDelta = this.calculateDrift(regionState.travel_risk, driftRules.travel_risk, rng);

      if (threatDelta !== 0 || prosperityDelta !== 0 || travelRiskDelta !== 0) {
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
  private async evaluateEvents(
    worldRef: string,
    gameState: SimulationState,
    rng: () => number
  ): Promise<EventTrigger[]> {
    const triggers: EventTrigger[] = [];
    
    for (const [eventId, event] of this.events) {
      if (event.world_ref !== worldRef) continue;

      // Check if event guards are met
      if (this.checkEventGuards(event, gameState)) {
        // Roll for event trigger based on rarity
        const roll = rng();
        if (roll < event.rarity_weight / 100) {
          triggers.push({
            eventId,
            regionId: event.region_id || 'default',
            effects: event.effects || [],
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Resolve NPC schedules for current band
   */
  private async resolveNPCSchedules(
    worldRef: string,
    gameState: SimulationState,
    rng: () => number
  ): Promise<NPCScheduleHint[]> {
    const hints: NPCScheduleHint[] = [];
    
    for (const [npcId, schedule] of this.npcSchedules) {
      if (schedule.world_ref !== worldRef) continue;

      const currentBand = gameState.clock.band;
      const scheduleEntry = schedule.entries.find((entry: any) => entry.band === currentBand);
      
      if (scheduleEntry) {
        // Apply behavior variance based on personality
        const variance = this.applyBehaviorVariance(scheduleEntry, schedule.behavior_variance, rng);
        
        hints.push({
          npcId,
          locKey: variance.location,
          intent: variance.intent,
        });
      }
    }

    return hints;
  }

  /**
   * Update simulation state with deltas
   */
  private async updateSimulationState(
    gameState: SimulationState,
    deltas: any
  ): Promise<void> {
    // Update regions
    for (const [regionId, delta] of Object.entries(deltas.regions)) {
      if (!gameState.regions[regionId]) {
        gameState.regions[regionId] = { prosperity: 50, threat: 25, travel_risk: 15 };
      }
      
      gameState.regions[regionId].prosperity = Math.max(0, Math.min(100, 
        gameState.regions[regionId].prosperity + delta.prosperityDelta));
      gameState.regions[regionId].threat = Math.max(0, Math.min(100, 
        gameState.regions[regionId].threat + delta.threatDelta));
      gameState.regions[regionId].travel_risk = Math.max(0, Math.min(100, 
        gameState.regions[regionId].travel_risk + delta.travelRiskDelta));
    }

    // Update weather
    for (const [regionId, change] of Object.entries(deltas.weather)) {
      gameState.weather.region = regionId;
      gameState.weather.state = change.state;
      gameState.weather.front = change.front;
    }

    // Update NPCs
    for (const [npcId, hint] of Object.entries(deltas.npcs)) {
      gameState.npcs[npcId] = {
        current_location: hint.locKey,
        current_intent: hint.intent,
        last_update: Date.now(),
      };
    }
  }

  /**
   * Check if event guards are met
   */
  private checkEventGuards(event: any, gameState: SimulationState): boolean {
    const guards = event.guards || {};
    
    // Check region prosperity
    if (guards.region_prosperity_min) {
      const regionState = gameState.regions[event.region_id || 'default'];
      if (!regionState || regionState.prosperity < guards.region_prosperity_min) {
        return false;
      }
    }

    // Check region threat
    if (guards.region_threat_min) {
      const regionState = gameState.regions[event.region_id || 'default'];
      if (!regionState || regionState.threat < guards.region_threat_min) {
        return false;
      }
    }

    // Check band
    if (guards.band && !guards.band.includes(gameState.clock.band)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate drift for a metric
   */
  private calculateDrift(current: number, rules: any, rng: () => number): number {
    const step = rules.step || 1;
    const direction = rng() < 0.5 ? -1 : 1;
    const magnitude = Math.floor(rng() * step) + 1;
    
    const newValue = current + (direction * magnitude);
    const clampedValue = Math.max(rules.min || 0, Math.min(rules.max || 100, newValue));
    
    return clampedValue - current;
  }

  /**
   * Get weather transition
   */
  private getWeatherTransition(currentState: string, rng: () => number): string {
    const transitions: Record<string, Record<string, number>> = {
      clear: { clear: 0.7, overcast: 0.2, rain: 0.1 },
      overcast: { clear: 0.3, overcast: 0.4, rain: 0.3 },
      rain: { overcast: 0.4, rain: 0.5, storm: 0.1 },
      storm: { rain: 0.6, storm: 0.4 },
    };

    const stateTransitions = transitions[currentState] || transitions.clear;
    const roll = rng();
    let cumulative = 0;

    for (const [state, probability] of Object.entries(stateTransitions)) {
      cumulative += probability;
      if (roll <= cumulative) {
        return state;
      }
    }

    return currentState;
  }

  /**
   * Get weather front
   */
  private getWeatherFront(state: string): string {
    const fronts: Record<string, string> = {
      clear: 'none',
      overcast: 'light',
      rain: 'moderate',
      storm: 'severe',
    };
    return fronts[state] || 'none';
  }

  /**
   * Apply behavior variance to schedule
   */
  private applyBehaviorVariance(scheduleEntry: any, variance: any, rng: () => number): any {
    const result = { ...scheduleEntry };
    
    // Apply curiosity variance
    if (variance.curiosity && rng() < variance.curiosity) {
      if (result.intent === 'guard' && rng() < 0.5) {
        result.intent = 'scout';
      }
    }

    // Apply caution variance
    if (variance.caution && rng() < variance.caution) {
      if (result.intent === 'scout' && rng() < 0.3) {
        result.intent = 'guard';
      }
    }

    return result;
  }

  /**
   * Generate summary of changes
   */
  private generateSummary(deltas: any): string {
    const parts: string[] = [];
    
    if (Object.keys(deltas.regions).length > 0) {
      parts.push(`${Object.keys(deltas.regions).length} regions updated`);
    }
    
    if (Object.keys(deltas.weather).length > 0) {
      parts.push(`weather changed in ${Object.keys(deltas.weather).length} regions`);
    }
    
    if (deltas.events.length > 0) {
      parts.push(`${deltas.events.length} events triggered`);
    }
    
    if (Object.keys(deltas.npcs).length > 0) {
      parts.push(`${Object.keys(deltas.npcs).length} NPCs scheduled`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }

  /**
   * Generate deterministic seed
   */
  private generateSeed(worldRef: string, dayIndex: number, band: string): number {
    const seedString = `${worldRef}:${dayIndex}:${band}`;
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
   * Set registries (for testing)
   */
  setRegions(regions: Map<string, any>): void {
    this.regions = regions;
  }

  setEvents(events: Map<string, any>): void {
    this.events = events;
  }

  setNPCSchedules(schedules: Map<string, any>): void {
    this.npcSchedules = schedules;
  }
}

// Singleton instance
export const worldTickEngine = new WorldTickEngine();


