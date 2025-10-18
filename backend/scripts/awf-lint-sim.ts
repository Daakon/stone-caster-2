/**
 * Phase 19: Sim Linter
 * Validates world simulation data for common authoring mistakes
 */

import { z } from 'zod';

// Types
export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    regions: number;
    events: number;
    schedules: number;
    weather_zones: number;
  };
}

export interface LintOptions {
  checkSchedules: boolean;
  checkEvents: boolean;
  checkRegions: boolean;
  checkWeather: boolean;
  checkTokenCaps: boolean;
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

const ScheduleEntrySchema = z.object({
  band: z.string(),
  location: z.string(),
  intent: z.string(),
  except: z.object({
    weather: z.array(z.string()).optional(),
    events: z.array(z.string()).optional(),
    quests: z.array(z.string()).optional(),
    flags: z.record(z.any()).optional(),
  }).optional(),
});

const NPCScheduleSchema = z.object({
  npc_id: z.string(),
  world_ref: z.string(),
  entries: z.array(ScheduleEntrySchema),
  behavior_variance: z.object({
    curiosity: z.number().min(0).max(1),
    caution: z.number().min(0).max(1),
    social: z.number().min(0).max(1),
  }),
});

export class SimLinter {
  private regions: Map<string, any> = new Map();
  private events: Map<string, any> = new Map();
  private schedules: Map<string, any> = new Map();
  private weatherZones: Map<string, any> = new Map();
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Lint simulation data
   */
  async lint(options: LintOptions = {
    checkSchedules: true,
    checkEvents: true,
    checkRegions: true,
    checkWeather: true,
    checkTokenCaps: true,
  }): Promise<LintResult> {
    this.errors = [];
    this.warnings = [];

    // Load data (this would integrate with database)
    await this.loadData();

    // Run checks
    if (options.checkSchedules) {
      this.checkSchedules();
    }

    if (options.checkEvents) {
      this.checkEvents();
    }

    if (options.checkRegions) {
      this.checkRegions();
    }

    if (options.checkWeather) {
      this.checkWeather();
    }

    if (options.checkTokenCaps) {
      this.checkTokenCaps();
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      stats: {
        regions: this.regions.size,
        events: this.events.size,
        schedules: this.schedules.size,
        weather_zones: this.weatherZones.size,
      },
    };
  }

  /**
   * Load data from database
   */
  private async loadData(): Promise<void> {
    // This would integrate with database
    // For now, use mock data
    this.regions.set('region.forest_glade', {
      id: 'region.forest_glade',
      name: 'Forest Glade',
      coords: [45.2, 12.8],
      tags: ['forest', 'safe', 'herbal'],
      base_prosperity: 60,
      base_threat: 20,
      base_travel_risk: 10,
      drift_rules: {
        prosperity: { min: 40, max: 80, step: 2 },
        threat: { min: 10, max: 40, step: 1 },
        travel_risk: { min: 5, max: 25, step: 1 },
      },
      weather_zone: 'temperate',
      nearby_regions: ['region.mountain_pass', 'region.river_crossing'],
    });

    this.events.set('event.festival_herbal', {
      id: 'event.festival_herbal',
      name: 'Herbal Festival',
      type: 'festival',
      guards: {
        region_prosperity_min: 50,
        band: ['Dawn', 'Morning'],
        rarity: 0.1,
      },
      trigger_window: {
        start_day: 0,
        end_day: 365,
        frequency: 'weekly',
      },
      effects: [
        { type: 'REGION_DELTA', regionId: 'region.forest_glade', prosperityDelta: 10 },
        { type: 'WORLD_FLAG_SET', key: 'festival_active', val: true },
      ],
      duration: 2,
      rarity_weight: 10,
    });

    this.schedules.set('npc.kiera', {
      npc_id: 'npc.kiera',
      world_ref: 'world.forest_glade',
      entries: [
        { band: 'Dawn', location: 'herbal_garden', intent: 'gather_herbs' },
        { band: 'Morning', location: 'herbal_garden', intent: 'tend_garden' },
        { band: 'Afternoon', location: 'herbal_shop', intent: 'sell_herbs' },
        { band: 'Evening', location: 'herbal_garden', intent: 'rest' },
        { band: 'Night', location: 'herbal_cottage', intent: 'sleep' },
      ],
      behavior_variance: {
        curiosity: 0.1,
        caution: 0.05,
        social: 0.15,
      },
    });

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
  }

  /**
   * Check NPC schedules
   */
  private checkSchedules(): void {
    const bands = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'];
    
    for (const [npcId, schedule] of this.schedules) {
      // Check schedule coverage
      const coveredBands = new Set(schedule.entries.map((entry: any) => entry.band));
      for (const band of bands) {
        if (!coveredBands.has(band)) {
          this.errors.push(`NPC ${npcId}: Missing schedule for band ${band}`);
        }
      }

      // Check for duplicate bands
      const bandCounts = new Map<string, number>();
      for (const entry of schedule.entries) {
        const count = bandCounts.get(entry.band) || 0;
        bandCounts.set(entry.band, count + 1);
      }
      
      for (const [band, count] of bandCounts) {
        if (count > 1) {
          this.errors.push(`NPC ${npcId}: Duplicate schedule entries for band ${band}`);
        }
      }

      // Check behavior variance bounds
      const variance = schedule.behavior_variance;
      if (variance.curiosity < 0 || variance.curiosity > 1) {
        this.errors.push(`NPC ${npcId}: Invalid curiosity variance: ${variance.curiosity}`);
      }
      if (variance.caution < 0 || variance.caution > 1) {
        this.errors.push(`NPC ${npcId}: Invalid caution variance: ${variance.caution}`);
      }
      if (variance.social < 0 || variance.social > 1) {
        this.errors.push(`NPC ${npcId}: Invalid social variance: ${variance.social}`);
      }

      // Check for valid intents
      const validIntents = ['gather_herbs', 'tend_garden', 'sell_herbs', 'rest', 'sleep', 'scout', 'guard', 'hunt', 'socialize'];
      for (const entry of schedule.entries) {
        if (!validIntents.includes(entry.intent)) {
          this.warnings.push(`NPC ${npcId}: Unknown intent '${entry.intent}' for band ${entry.band}`);
        }
      }
    }
  }

  /**
   * Check events
   */
  private checkEvents(): void {
    for (const [eventId, event] of this.events) {
      // Check guard references
      if (event.guards.region_prosperity_min && event.guards.region_prosperity_max) {
        if (event.guards.region_prosperity_min > event.guards.region_prosperity_max) {
          this.errors.push(`Event ${eventId}: Invalid prosperity range (min > max)`);
        }
      }

      if (event.guards.region_threat_min && event.guards.region_threat_max) {
        if (event.guards.region_threat_min > event.guards.region_threat_max) {
          this.errors.push(`Event ${eventId}: Invalid threat range (min > max)`);
        }
      }

      // Check band references
      const validBands = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'];
      if (event.guards.band) {
        for (const band of event.guards.band) {
          if (!validBands.includes(band)) {
            this.errors.push(`Event ${eventId}: Invalid band '${band}' in guards`);
          }
        }
      }

      // Check trigger window
      if (event.trigger_window.start_day > event.trigger_window.end_day) {
        this.errors.push(`Event ${eventId}: Invalid trigger window (start > end)`);
      }

      // Check frequency
      const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!validFrequencies.includes(event.trigger_window.frequency)) {
        this.errors.push(`Event ${eventId}: Invalid frequency '${event.trigger_window.frequency}'`);
      }

      // Check effects
      for (const effect of event.effects) {
        if (effect.type === 'REGION_DELTA' && !effect.regionId) {
          this.errors.push(`Event ${eventId}: REGION_DELTA effect missing regionId`);
        }
        if (effect.type === 'WORLD_FLAG_SET' && !effect.key) {
          this.errors.push(`Event ${eventId}: WORLD_FLAG_SET effect missing key`);
        }
      }

      // Check rarity weight
      if (event.rarity_weight < 0 || event.rarity_weight > 100) {
        this.errors.push(`Event ${eventId}: Invalid rarity weight: ${event.rarity_weight}`);
      }
    }
  }

  /**
   * Check regions
   */
  private checkRegions(): void {
    for (const [regionId, region] of this.regions) {
      // Check base values
      if (region.base_prosperity < 0 || region.base_prosperity > 100) {
        this.errors.push(`Region ${regionId}: Invalid base prosperity: ${region.base_prosperity}`);
      }
      if (region.base_threat < 0 || region.base_threat > 100) {
        this.errors.push(`Region ${regionId}: Invalid base threat: ${region.base_threat}`);
      }
      if (region.base_travel_risk < 0 || region.base_travel_risk > 100) {
        this.errors.push(`Region ${regionId}: Invalid base travel risk: ${region.base_travel_risk}`);
      }

      // Check drift rules
      const driftRules = region.drift_rules;
      if (driftRules.prosperity.min > driftRules.prosperity.max) {
        this.errors.push(`Region ${regionId}: Invalid prosperity drift range (min > max)`);
      }
      if (driftRules.threat.min > driftRules.threat.max) {
        this.errors.push(`Region ${regionId}: Invalid threat drift range (min > max)`);
      }
      if (driftRules.travel_risk.min > driftRules.travel_risk.max) {
        this.errors.push(`Region ${regionId}: Invalid travel risk drift range (min > max)`);
      }

      // Check step values
      if (driftRules.prosperity.step <= 0) {
        this.errors.push(`Region ${regionId}: Invalid prosperity step: ${driftRules.prosperity.step}`);
      }
      if (driftRules.threat.step <= 0) {
        this.errors.push(`Region ${regionId}: Invalid threat step: ${driftRules.threat.step}`);
      }
      if (driftRules.travel_risk.step <= 0) {
        this.errors.push(`Region ${regionId}: Invalid travel risk step: ${driftRules.travel_risk.step}`);
      }

      // Check nearby regions
      for (const nearbyRegion of region.nearby_regions) {
        if (!this.regions.has(nearbyRegion)) {
          this.warnings.push(`Region ${regionId}: Unknown nearby region '${nearbyRegion}'`);
        }
      }

      // Check weather zone
      if (!this.weatherZones.has(region.weather_zone)) {
        this.warnings.push(`Region ${regionId}: Unknown weather zone '${region.weather_zone}'`);
      }
    }
  }

  /**
   * Check weather zones
   */
  private checkWeather(): void {
    for (const [zoneName, zone] of this.weatherZones) {
      // Check that probabilities sum to 1 for each from state
      const fromStates = new Set(zone.transitions.map((t: any) => t.from));
      
      for (const fromState of fromStates) {
        const transitions = zone.transitions.filter((t: any) => t.from === fromState);
        const totalProbability = transitions.reduce((sum: number, t: any) => sum + t.probability, 0);
        
        if (Math.abs(totalProbability - 1) > 0.01) {
          this.errors.push(`Weather zone ${zoneName}: Transitions from ${fromState} sum to ${totalProbability}, should be 1.0`);
        }
      }

      // Check that all transitions reference valid states
      const validStates = new Set(zone.base_states);
      for (const transition of zone.transitions) {
        if (!validStates.has(transition.from)) {
          this.errors.push(`Weather zone ${zoneName}: Invalid from state '${transition.from}'`);
        }
        if (!validStates.has(transition.to)) {
          this.errors.push(`Weather zone ${zoneName}: Invalid to state '${transition.to}'`);
        }
      }

      // Check probability bounds
      for (const transition of zone.transitions) {
        if (transition.probability < 0 || transition.probability > 1) {
          this.errors.push(`Weather zone ${zoneName}: Invalid probability ${transition.probability} for transition ${transition.from} -> ${transition.to}`);
        }
      }
    }
  }

  /**
   * Check token caps
   */
  private checkTokenCaps(): void {
    // This would check actual token counts in production
    // For now, just validate that configs are reasonable
    const maxTokens = 260;
    const maxNPCs = 4;
    const maxRegions = 3;

    if (this.schedules.size > maxNPCs) {
      this.warnings.push(`Too many NPC schedules (${this.schedules.size} > ${maxNPCs})`);
    }

    if (this.regions.size > maxRegions) {
      this.warnings.push(`Too many regions (${this.regions.size} > ${maxRegions})`);
    }

    // Check for overly long names that might exceed token limits
    for (const [regionId, region] of this.regions) {
      if (region.name.length > 20) {
        this.warnings.push(`Region ${regionId}: Long name '${region.name}' may exceed token limits`);
      }
    }

    for (const [eventId, event] of this.events) {
      if (event.name.length > 20) {
        this.warnings.push(`Event ${eventId}: Long name '${event.name}' may exceed token limits`);
      }
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const linter = new SimLinter();
  const options: LintOptions = {
    checkSchedules: true,
    checkEvents: true,
    checkRegions: true,
    checkWeather: true,
    checkTokenCaps: true,
  };

  linter.lint(options).then(result => {
    console.log('Sim Lint Results:');
    console.log(`Valid: ${result.valid}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Stats: ${JSON.stringify(result.stats, null, 2)}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    process.exit(result.valid ? 0 : 1);
  }).catch(error => {
    console.error('Lint failed:', error);
    process.exit(1);
  });
}

export { SimLinter };


