/**
 * Admin References Service
 * Phase 4: Lookup helpers for ref ID pickers
 */

import { apiGet } from '@/lib/api';
import { entryPointsService } from './admin.entryPoints';
// TODO: These services don't exist yet - need to implement or use alternative APIs
// import { worldsService } from './admin.worlds';
// import { rulesetsService } from './admin.rulesets';
// import { npcsService } from './admin.npcs';

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
    // TODO: Implement when admin.worlds service is available
    console.warn('searchWorlds not implemented - admin.worlds service missing');
    return [];
  }

  /**
   * Search rulesets for picker
   */
  async searchRulesets(options: SearchOptions = {}): Promise<RefItem[]> {
    // TODO: Implement when admin.rulesets service is available
    console.warn('searchRulesets not implemented - admin.rulesets service missing');
    return [];
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
    // TODO: Implement when admin.npcs service is available
    console.warn('searchNPCs not implemented - admin.npcs service missing');
    return [];
  }

  /**
   * Get ref item by ID and type
   */
  async getRefItem(id: string, type: 'world' | 'ruleset' | 'entry' | 'npc'): Promise<RefItem | null> {
    try {
      switch (type) {
        case 'world': {
          // TODO: Implement when admin.worlds service is available
          console.warn('getRefItem for world not implemented');
          return null;
        }

        case 'ruleset': {
          // TODO: Implement when admin.rulesets service is available
          console.warn('getRefItem for ruleset not implemented');
          return null;
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
          // TODO: Implement when admin.npcs service is available
          console.warn('getRefItem for npc not implemented');
          return null;
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




