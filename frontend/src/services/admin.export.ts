/**
 * Admin Export Service
 * Export entities as normalized JSON
 */

import { supabase } from '@/lib/supabase';
import { worldsService } from './admin.worlds';
import { rulesetsService } from './admin.rulesets';
import { npcsService } from './admin.npcs';
import { npcPacksService } from './admin.npcPacks';
import { entryPointsService } from './admin.entryPoints';

export interface ExportOptions {
  includeAssociations?: boolean;
  includeMetadata?: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ExportService {
  /**
   * Export a world with all its data
   */
  async exportWorld(id: string, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const world = await worldsService.getWorld(id);
      
      const exportData = {
        type: 'world',
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: {
          id: world.id,
          name: world.name,
          slug: world.slug,
          description: world.description,
          status: world.status,
          created_at: world.created_at,
          updated_at: world.updated_at
        }
      };

      if (options.includeMetadata) {
        exportData.metadata = {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: 1
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Export a ruleset with all its data
   */
  async exportRuleset(id: string, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const ruleset = await rulesetsService.getRuleset(id);
      
      const exportData = {
        type: 'ruleset',
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: {
          id: ruleset.id,
          name: ruleset.name,
          slug: ruleset.slug,
          description: ruleset.description,
          status: ruleset.status,
          version_major: ruleset.version_major,
          version_minor: ruleset.version_minor,
          version_patch: ruleset.version_patch,
          version_semver: ruleset.version_semver,
          published_at: ruleset.published_at,
          is_mutable: ruleset.is_mutable,
          created_at: ruleset.created_at,
          updated_at: ruleset.updated_at
        }
      };

      if (options.includeMetadata) {
        exportData.metadata = {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: 1,
          version_info: {
            semver: ruleset.version_semver,
            is_published: ruleset.status === 'active'
          }
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Export an NPC with all its data
   */
  async exportNPC(id: string, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const npc = await npcsService.getNPC(id);
      
      const exportData = {
        type: 'npc',
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: {
          id: npc.id,
          name: npc.name,
          slug: npc.slug,
          description: npc.description,
          status: npc.status,
          created_at: npc.created_at,
          updated_at: npc.updated_at
        }
      };

      if (options.includeMetadata) {
        exportData.metadata = {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: 1
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Export an NPC pack with all its data
   */
  async exportNPCPack(id: string, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const pack = await npcPacksService.getNPCPack(id);
      
      const exportData = {
        type: 'npc_pack',
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: {
          id: pack.id,
          name: pack.name,
          slug: pack.slug,
          description: pack.description,
          status: pack.status,
          created_at: pack.created_at,
          updated_at: pack.updated_at,
          members: pack.members || []
        }
      };

      if (options.includeMetadata) {
        exportData.metadata = {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: 1,
          member_count: pack.members?.length || 0
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Export a story (entry point) with all its associations
   */
  async exportEntry(id: string, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const entryPoint = await entryPointsService.getEntryPoint(id);
      
      const exportData = {
        type: 'story',
        version: '1.0',
        exported_at: new Date().toISOString(),
        data: {
          id: entryPoint.id,
          name: entryPoint.name,
          slug: entryPoint.slug,
          title: entryPoint.title,
          description: entryPoint.description,
          lifecycle: entryPoint.lifecycle,
          world_id: entryPoint.world_id,
          created_at: entryPoint.created_at,
          updated_at: entryPoint.updated_at
        }
      };

      if (options.includeAssociations) {
        exportData.data.associations = {
          world: entryPoint.world,
          rulesets: entryPoint.rulesets,
          npcs: entryPoint.npcs,
          npc_packs: entryPoint.npc_packs
        };
      }

      if (options.includeMetadata) {
        exportData.metadata = {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: 1,
          association_counts: {
            rulesets: entry.rulesets?.length || 0,
            npcs: entry.npcs?.length || 0,
            npc_packs: entry.npc_packs?.length || 0
          }
        };
      }

      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Export multiple entities as a bundle
   */
  async exportBundle(entities: Array<{
    type: 'world' | 'ruleset' | 'npc' | 'npc_pack' | 'entry';
    id: string;
  }>, options: ExportOptions = {}): Promise<ExportResult> {
    try {
      const results = await Promise.all(
        entities.map(async (entity) => {
          switch (entity.type) {
            case 'world':
              return await this.exportWorld(entity.id, options);
            case 'ruleset':
              return await this.exportRuleset(entity.id, options);
            case 'npc':
              return await this.exportNPC(entity.id, options);
            case 'npc_pack':
              return await this.exportNPCPack(entity.id, options);
            case 'entry':
              return await this.exportEntry(entity.id, options);
            default:
              throw new Error(`Unknown entity type: ${entity.type}`);
          }
        })
      );

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        return { 
          success: false, 
          error: `Failed to export ${failed.length} entities: ${failed.map(f => f.error).join(', ')}` 
        };
      }

      const bundleData = {
        type: 'bundle',
        version: '1.0',
        exported_at: new Date().toISOString(),
        entities: results.map(r => r.data),
        metadata: {
          export_version: '1.0',
          exported_by: 'admin',
          entity_count: entities.length,
          entity_types: [...new Set(entities.map(e => e.type))]
        }
      };

      return { success: true, data: bundleData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Download export data as JSON file
   */
  downloadAsFile(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();
