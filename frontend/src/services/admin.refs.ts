/**
 * Admin References Service
 * Phase 4: Lookup helpers for ref ID pickers
 */

import { apiGet } from '@/lib/api';
import { worldsService } from './admin.worlds';
import { rulesetsService } from './admin.rulesets';
import { entryPointsService } from './admin.entryPoints';
import { npcsService } from './admin.npcs';

export interface RefItem {
  id: string;
  name: string;
  type?: string;
  world_id?: string;
}

export interface SearchOptions {
  q?: string;
  world_id?: string;
  limit?: number;
}

export class RefsService {
  /**
   * Search worlds for picker
   */
  async searchWorlds(options: SearchOptions = {}): Promise<RefItem[]> {
    try {
      const response = await worldsService.listWorlds(
        { search: options.q },
        1,
        options.limit || 100
      );
      
      return (response.data || []).map(world => ({
        id: world.id,
        name: world.name,
        type: 'world'
      }));
    } catch (error) {
      console.error('Error searching worlds:', error);
      return [];
    }
  }

  /**
   * Search rulesets for picker
   */
  async searchRulesets(options: SearchOptions = {}): Promise<RefItem[]> {
    try {
      const response = await rulesetsService.listRulesets(
        { search: options.q },
        1,
        options.limit || 100
      );
      
      return (response.data || []).map(ruleset => ({
        id: ruleset.id,
        name: ruleset.name,
        type: 'ruleset'
      }));
    } catch (error) {
      console.error('Error searching rulesets:', error);
      return [];
    }
  }

  /**
   * Search entry points for picker
   */
  async searchEntryPoints(options: SearchOptions = {}): Promise<RefItem[]> {
    try {
      const response = await entryPointsService.listEntryPoints(
        { 
          world_id: options.world_id,
          search: options.q 
        },
        1,
        options.limit || 100
      );
      
      return (response.data || []).map(entry => ({
        id: entry.id,
        name: entry.title || entry.name || entry.id,
        type: entry.type,
        world_id: entry.world_id
      }));
    } catch (error) {
      console.error('Error searching entry points:', error);
      return [];
    }
  }

  /**
   * Search NPCs for picker
   */
  async searchNPCs(options: SearchOptions = {}): Promise<RefItem[]> {
    try {
      const response = await npcsService.listNPCs(
        { search: options.q },
        1,
        options.limit || 100
      );
      
      // Filter by world_id if provided (client-side filter since API doesn't support it yet)
      let npcs = response.data || [];
      if (options.world_id) {
        // Note: NPCs don't have world_id in current schema, so we can't filter by it
        // This will return all NPCs until we add world_id to NPCs table
      }
      
      return npcs.map(npc => ({
        id: npc.id,
        name: npc.name || npc.id,
        type: 'npc'
      }));
    } catch (error) {
      console.error('Error searching NPCs:', error);
      return [];
    }
  }

  /**
   * Get ref item by ID and type
   */
  async getRefItem(id: string, type: 'world' | 'ruleset' | 'entry' | 'npc'): Promise<RefItem | null> {
    try {
      switch (type) {
        case 'world': {
          const world = await worldsService.getWorld(id);
          return {
            id: world.id,
            name: world.name,
            type: 'world'
          };
        }

        case 'ruleset': {
          const ruleset = await rulesetsService.getRuleset(id);
          return {
            id: ruleset.id,
            name: ruleset.name,
            type: 'ruleset'
          };
        }

        case 'entry': {
          const entry = await entryPointsService.getEntryPoint(id);
          return {
            id: entry.id,
            name: entry.title || entry.name || entry.id,
            type: entry.type,
            world_id: entry.world_id
          };
        }

        case 'npc': {
          const npc = await npcsService.getNPC(id);
          return {
            id: npc.id,
            name: npc.name || npc.id,
            type: 'npc'
          };
        }

        default:
          return null;
      }
    } catch (error) {
      console.error('Error fetching ref item:', error);
      return null;
    }
  }

  /**
   * Get available worlds for filtering
   */
  async getWorldsForFilter(): Promise<RefItem[]> {
    return this.searchWorlds({ limit: 100 });
  }

  /**
   * Get available rulesets for filtering
   */
  async getRulesetsForFilter(): Promise<RefItem[]> {
    return this.searchRulesets({ limit: 100 });
  }

  /**
   * Get available entry points for filtering
   */
  async getEntryPointsForFilter(worldId?: string): Promise<RefItem[]> {
    return this.searchEntryPoints({ world_id: worldId, limit: 100 });
  }

  /**
   * Get available NPCs for filtering
   */
  async getNPCsForFilter(worldId?: string): Promise<RefItem[]> {
    return this.searchNPCs({ world_id: worldId, limit: 100 });
  }
}

export const refsService = new RefsService();




