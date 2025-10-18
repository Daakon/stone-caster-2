/**
 * Phase 19: Weather Engine
 * Handles weather transitions and effects
 */

import { z } from 'zod';

// Types
export interface WeatherState {
  region: string;
  state: string;
  front: string;
}

export interface WeatherTransition {
  from: string;
  to: string;
  probability: number;
}

export interface WeatherZone {
  name: string;
  transitions: WeatherTransition[];
  base_states: string[];
}

export interface WeatherEffect {
  type: 'travel_penalty' | 'visibility_penalty' | 'resource_drain' | 'status_effect';
  magnitude: number;
  duration?: number;
  description: string;
}

export interface WeatherChange {
  regionId: string;
  state: string;
  front: string;
  effects: WeatherEffect[];
}

// Schemas
const WeatherTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  probability: z.number().min(0).max(1),
});

const WeatherZoneSchema = z.object({
  name: z.string(),
  transitions: z.array(WeatherTransitionSchema),
  base_states: z.array(z.string()),
});

const WeatherEffectSchema = z.object({
  type: z.enum(['travel_penalty', 'visibility_penalty', 'resource_drain', 'status_effect']),
  magnitude: z.number(),
  duration: z.number().optional(),
  description: z.string(),
});

export class WeatherEngine {
  private weatherZones: Map<string, WeatherZone> = new Map();
  private currentWeather: Map<string, WeatherState> = new Map();

  constructor() {
    this.initializeDefaultZones();
  }

  /**
   * Transition weather for a region
   */
  transitionWeather(
    regionId: string,
    currentState: string,
    weatherZone: string,
    rng: () => number
  ): WeatherChange {
    const zone = this.weatherZones.get(weatherZone);
    if (!zone) {
      return {
        regionId,
        state: currentState,
        front: 'none',
        effects: [],
      };
    }

    // Get transition probabilities for current state
    const transitions = zone.transitions.filter(t => t.from === currentState);
    if (transitions.length === 0) {
      return {
        regionId,
        state: currentState,
        front: 'none',
        effects: [],
      };
    }

    // Select new state based on probabilities
    const newState = this.selectNewState(transitions, rng);
    const front = this.getWeatherFront(newState);
    const effects = this.getWeatherEffects(newState);

    return {
      regionId,
      state: newState,
      front,
      effects,
    };
  }

  /**
   * Get weather effects for a state
   */
  getWeatherEffects(state: string): WeatherEffect[] {
    const effects: WeatherEffect[] = [];

    switch (state) {
      case 'clear':
        // No negative effects
        break;
      
      case 'overcast':
        effects.push({
          type: 'visibility_penalty',
          magnitude: 0.1,
          description: 'Reduced visibility due to overcast skies',
        });
        break;
      
      case 'rain':
        effects.push({
          type: 'travel_penalty',
          magnitude: 0.2,
          description: 'Wet conditions slow travel',
        });
        effects.push({
          type: 'visibility_penalty',
          magnitude: 0.3,
          description: 'Rain reduces visibility',
        });
        effects.push({
          type: 'status_effect',
          magnitude: 1,
          duration: 2,
          description: 'Soaked - reduced comfort and warmth',
        });
        break;
      
      case 'storm':
        effects.push({
          type: 'travel_penalty',
          magnitude: 0.5,
          description: 'Dangerous storm conditions prevent safe travel',
        });
        effects.push({
          type: 'visibility_penalty',
          magnitude: 0.6,
          description: 'Storm severely limits visibility',
        });
        effects.push({
          type: 'resource_drain',
          magnitude: 0.1,
          description: 'Storm drains energy and resources',
        });
        effects.push({
          type: 'status_effect',
          magnitude: 2,
          duration: 3,
          description: 'Soaked and chilled - significant discomfort',
        });
        break;
    }

    return effects;
  }

  /**
   * Get weather front for a state
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
   * Select new weather state based on transition probabilities
   */
  private selectNewState(transitions: WeatherTransition[], rng: () => number): string {
    const roll = rng();
    let cumulative = 0;

    for (const transition of transitions) {
      cumulative += transition.probability;
      if (roll <= cumulative) {
        return transition.to;
      }
    }

    // Fallback to first transition if probabilities don't sum to 1
    return transitions[0]?.to || 'clear';
  }

  /**
   * Initialize default weather zones
   */
  private initializeDefaultZones(): void {
    // Temperate zone
    this.weatherZones.set('temperate', {
      name: 'temperate',
      base_states: ['clear', 'overcast', 'rain', 'storm'],
      transitions: [
        { from: 'clear', to: 'clear', probability: 0.7 },
        { from: 'clear', to: 'overcast', probability: 0.2 },
        { from: 'clear', to: 'rain', probability: 0.1 },
        { from: 'overcast', to: 'clear', probability: 0.3 },
        { from: 'overcast', to: 'overcast', probability: 0.4 },
        { from: 'overcast', to: 'rain', probability: 0.3 },
        { from: 'rain', to: 'overcast', probability: 0.4 },
        { from: 'rain', to: 'rain', probability: 0.5 },
        { from: 'rain', to: 'storm', probability: 0.1 },
        { from: 'storm', to: 'rain', probability: 0.6 },
        { from: 'storm', to: 'storm', probability: 0.4 },
      ],
    });

    // Alpine zone
    this.weatherZones.set('alpine', {
      name: 'alpine',
      base_states: ['clear', 'overcast', 'storm'],
      transitions: [
        { from: 'clear', to: 'clear', probability: 0.5 },
        { from: 'clear', to: 'overcast', probability: 0.3 },
        { from: 'clear', to: 'storm', probability: 0.2 },
        { from: 'overcast', to: 'clear', probability: 0.2 },
        { from: 'overcast', to: 'overcast', probability: 0.3 },
        { from: 'overcast', to: 'storm', probability: 0.5 },
        { from: 'storm', to: 'overcast', probability: 0.4 },
        { from: 'storm', to: 'storm', probability: 0.6 },
      ],
    });

    // Desert zone
    this.weatherZones.set('desert', {
      name: 'desert',
      base_states: ['clear', 'overcast', 'storm'],
      transitions: [
        { from: 'clear', to: 'clear', probability: 0.9 },
        { from: 'clear', to: 'overcast', probability: 0.08 },
        { from: 'clear', to: 'storm', probability: 0.02 },
        { from: 'overcast', to: 'clear', probability: 0.8 },
        { from: 'overcast', to: 'overcast', probability: 0.15 },
        { from: 'overcast', to: 'storm', probability: 0.05 },
        { from: 'storm', to: 'clear', probability: 0.7 },
        { from: 'storm', to: 'overcast', probability: 0.2 },
        { from: 'storm', to: 'storm', probability: 0.1 },
      ],
    });
  }

  /**
   * Get weather zone
   */
  getWeatherZone(zoneName: string): WeatherZone | undefined {
    return this.weatherZones.get(zoneName);
  }

  /**
   * Get current weather for a region
   */
  getCurrentWeather(regionId: string): WeatherState | undefined {
    return this.currentWeather.get(regionId);
  }

  /**
   * Set current weather for a region
   */
  setCurrentWeather(regionId: string, weather: WeatherState): void {
    this.currentWeather.set(regionId, weather);
  }

  /**
   * Get all weather zones
   */
  getAllWeatherZones(): WeatherZone[] {
    return Array.from(this.weatherZones.values());
  }

  /**
   * Add custom weather zone
   */
  addWeatherZone(zone: WeatherZone): void {
    this.weatherZones.set(zone.name, zone);
  }

  /**
   * Validate weather zone transitions
   */
  validateWeatherZone(zone: WeatherZone): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that probabilities sum to 1 for each from state
    const fromStates = new Set(zone.transitions.map(t => t.from));
    
    for (const fromState of fromStates) {
      const transitions = zone.transitions.filter(t => t.from === fromState);
      const totalProbability = transitions.reduce((sum, t) => sum + t.probability, 0);
      
      if (Math.abs(totalProbability - 1) > 0.01) {
        errors.push(`Transitions from ${fromState} sum to ${totalProbability}, should be 1.0`);
      }
    }

    // Check that all transitions reference valid states
    const validStates = new Set(zone.base_states);
    for (const transition of zone.transitions) {
      if (!validStates.has(transition.from)) {
        errors.push(`Invalid from state: ${transition.from}`);
      }
      if (!validStates.has(transition.to)) {
        errors.push(`Invalid to state: ${transition.to}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const weatherEngine = new WeatherEngine();


