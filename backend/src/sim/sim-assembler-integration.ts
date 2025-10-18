/**
 * Phase 19: Sim Assembler Integration
 * Integrates world simulation into AWF bundle with token caps
 */

import { z } from 'zod';

// Types
export interface SimBlock {
  time: {
    band: string;
    day_index: number;
  };
  weather: {
    current: string;
    forecast: string;
  };
  regions: Array<{
    id: string;
    name: string;
    prosperity: number;
    threat: number;
    status: string;
  }>;
  npcs: Array<{
    id: string;
    location: string;
    intent: string;
  }>;
}

export interface AssemblerContext {
  sessionId: string;
  turnId: number;
  nodeId: string;
  activeNodeType: string;
  playerLocation: string;
  nearbyRegions: string[];
  nearbyNPCs: string[];
  maxTokens: number;
}

export interface SimConfig {
  max_sim_tokens: number;
  max_nearby_npcs: number;
  max_nearby_regions: number;
  event_rate: 'low' | 'normal' | 'high';
}

// Schemas
const SimBlockSchema = z.object({
  time: z.object({
    band: z.string(),
    day_index: z.number().int().min(0),
  }),
  weather: z.object({
    current: z.string(),
    forecast: z.string(),
  }),
  regions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    prosperity: z.number().min(0).max(100),
    threat: z.number().min(0).max(100),
    status: z.string(),
  })),
  npcs: z.array(z.object({
    id: z.string(),
    location: z.string(),
    intent: z.string(),
  })),
});

export class SimAssemblerIntegration {
  private config: SimConfig = {
    max_sim_tokens: 260,
    max_nearby_npcs: 4,
    max_nearby_regions: 3,
    event_rate: 'normal',
  };

  constructor() {
    // Initialize with default config
  }

  /**
   * Assemble simulation block for AWF bundle
   */
  assembleSimBlock(
    simState: any,
    context: AssemblerContext
  ): SimBlock | null {
    try {
      // Extract relevant data from simulation state
      const time = this.extractTimeInfo(simState);
      const weather = this.extractWeatherInfo(simState, context);
      const regions = this.extractRegionInfo(simState, context);
      const npcs = this.extractNPCInfo(simState, context);

      // Build sim block
      const simBlock: SimBlock = {
        time,
        weather,
        regions,
        npcs,
      };

      // Check token limit
      const tokenCount = this.estimateTokenCount(simBlock);
      if (tokenCount > this.config.max_sim_tokens) {
        return this.trimSimBlock(simBlock, context);
      }

      return simBlock;
    } catch (error) {
      console.error('Failed to assemble sim block:', error);
      return null;
    }
  }

  /**
   * Extract time information
   */
  private extractTimeInfo(simState: any): { band: string; day_index: number } {
    return {
      band: simState.clock?.band || 'Dawn',
      day_index: simState.clock?.day_index || 0,
    };
  }

  /**
   * Extract weather information
   */
  private extractWeatherInfo(simState: any, context: AssemblerContext): { current: string; forecast: string } {
    const currentWeather = simState.weather?.state || 'clear';
    const forecast = this.generateWeatherForecast(currentWeather);
    
    return {
      current: currentWeather,
      forecast,
    };
  }

  /**
   * Extract region information
   */
  private extractRegionInfo(simState: any, context: AssemblerContext): Array<{
    id: string;
    name: string;
    prosperity: number;
    threat: number;
    status: string;
  }> {
    const regions: Array<{
      id: string;
      name: string;
      prosperity: number;
      threat: number;
      status: string;
    }> = [];

    // Get nearby regions
    const nearbyRegions = context.nearbyRegions.slice(0, this.config.max_nearby_regions);
    
    for (const regionId of nearbyRegions) {
      const regionState = simState.regions?.[regionId];
      if (regionState) {
        regions.push({
          id: regionId,
          name: this.getRegionDisplayName(regionId),
          prosperity: regionState.prosperity || 50,
          threat: regionState.threat || 25,
          status: this.getRegionStatus(regionState),
        });
      }
    }

    return regions;
  }

  /**
   * Extract NPC information
   */
  private extractNPCInfo(simState: any, context: AssemblerContext): Array<{
    id: string;
    location: string;
    intent: string;
  }> {
    const npcs: Array<{
      id: string;
      location: string;
      intent: string;
    }> = [];

    // Get nearby NPCs
    const nearbyNPCs = context.nearbyNPCs.slice(0, this.config.max_nearby_npcs);
    
    for (const npcId of nearbyNPCs) {
      const npcState = simState.npcs?.[npcId];
      if (npcState) {
        npcs.push({
          id: npcId,
          location: npcState.current_location || 'unknown',
          intent: npcState.current_intent || 'idle',
        });
      }
    }

    return npcs;
  }

  /**
   * Generate weather forecast
   */
  private generateWeatherForecast(currentWeather: string): string {
    const forecasts: Record<string, string> = {
      clear: 'clear skies',
      overcast: 'cloudy conditions',
      rain: 'rainy weather',
      storm: 'stormy conditions',
    };
    return forecasts[currentWeather] || 'unknown';
  }

  /**
   * Get region display name
   */
  private getRegionDisplayName(regionId: string): string {
    // This would integrate with i18n system from Phase 12
    const displayNames: Record<string, string> = {
      'region.forest_glade': 'Forest Glade',
      'region.mountain_pass': 'Mountain Pass',
      'region.river_crossing': 'River Crossing',
    };
    return displayNames[regionId] || regionId;
  }

  /**
   * Get region status
   */
  private getRegionStatus(regionState: any): string {
    const prosperity = regionState.prosperity || 50;
    const threat = regionState.threat || 25;
    
    if (prosperity > 70 && threat < 30) {
      return 'prosperous';
    } else if (prosperity < 30 && threat > 70) {
      return 'dangerous';
    } else if (threat > 50) {
      return 'unstable';
    } else {
      return 'stable';
    }
  }

  /**
   * Estimate token count for sim block
   */
  private estimateTokenCount(simBlock: SimBlock): number {
    let tokens = 0;
    
    // Time tokens
    tokens += simBlock.time.band.length + simBlock.time.day_index.toString().length + 10;
    
    // Weather tokens
    tokens += simBlock.weather.current.length + simBlock.weather.forecast.length + 10;
    
    // Region tokens
    for (const region of simBlock.regions) {
      tokens += region.id.length + region.name.length + region.status.length + 20;
    }
    
    // NPC tokens
    for (const npc of simBlock.npcs) {
      tokens += npc.id.length + npc.location.length + npc.intent.length + 15;
    }
    
    return tokens;
  }

  /**
   * Trim sim block to fit token limit
   */
  private trimSimBlock(simBlock: SimBlock, context: AssemblerContext): SimBlock {
    const trimmed = { ...simBlock };
    
    // Trim regions by distance/importance
    if (trimmed.regions.length > this.config.max_nearby_regions) {
      trimmed.regions = trimmed.regions.slice(0, this.config.max_nearby_regions);
    }
    
    // Trim NPCs by relevance
    if (trimmed.npcs.length > this.config.max_nearby_npcs) {
      trimmed.npcs = trimmed.npcs.slice(0, this.config.max_nearby_npcs);
    }
    
    // Simplify region information
    trimmed.regions = trimmed.regions.map(region => ({
      ...region,
      name: this.shortenDisplayName(region.name),
    }));
    
    // Simplify NPC information
    trimmed.npcs = trimmed.npcs.map(npc => ({
      ...npc,
      location: this.shortenLocationName(npc.location),
    }));
    
    return trimmed;
  }

  /**
   * Shorten display name
   */
  private shortenDisplayName(name: string): string {
    if (name.length > 12) {
      return name.substring(0, 12) + '...';
    }
    return name;
  }

  /**
   * Shorten location name
   */
  private shortenLocationName(location: string): string {
    if (location.length > 8) {
      return location.substring(0, 8) + '...';
    }
    return location;
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<SimConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): SimConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const simAssemblerIntegration = new SimAssemblerIntegration();


