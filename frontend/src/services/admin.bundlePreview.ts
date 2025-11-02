/**
 * Admin Bundle Preview Service
 * Assembles entry data for runtime consumption
 */

import { supabase } from '@/lib/supabase';
import { entryPointsService } from './admin.entryPoints';
import { rulesetsService } from './admin.rulesets';
import { worldsService } from './admin.worlds';

export interface BundlePreview {
  entry: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    status: string;
  };
  world: {
    id: string;
    name: string;
    slug: string;
    description?: string;
  };
  rulesets: Array<{
    id: string;
    name: string;
    slug: string;
    version_semver: string;
    status: string;
    sort_order: number;
  }>;
  npcs: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
  }>;
  npc_packs: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    members: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
  }>;
  metadata: {
    total_rulesets: number;
    total_npcs: number;
    total_npc_packs: number;
    total_members: number;
    estimated_size: number;
    warnings: string[];
    assembly_order: string[];
  };
}

export interface BundlePreviewOptions {
  includeDrafts?: boolean;
  maxSize?: number;
}

export class BundlePreviewService {
  /**
   * Generate bundle preview for an entry
   */
  async generatePreview(
    entryId: string, 
    options: BundlePreviewOptions = {}
  ): Promise<BundlePreview> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get story (entry point) with all associations
    const entryPoint = await entryPointsService.getEntryPoint(entryId);
    if (!entryPoint) {
      throw new Error('Story not found');
    }

    // Get world
    const world = entryPoint.world;
    if (!world) {
      throw new Error('Story has no associated world');
    }

    // Get rulesets in order
    const rulesets = entryPoint.rulesets || [];
    
    // Filter out archived rulesets
    const activeRulesets = rulesets.filter((r: any) => r.status !== 'archived');
    
    // Filter out drafts if not requested
    const filteredRulesets = options.includeDrafts 
      ? activeRulesets 
      : activeRulesets.filter((r: any) => r.status === 'active');

    // Get NPCs
    const npcs = entryPoint.npcs || [];
    const activeNPCs = npcs.filter((n: any) => n.status !== 'archived');

    // Get NPC packs with members
    const npcPacks = entryPoint.npc_packs || [];
    const activeNPCPacks = npcPacks.filter((p: any) => p.status !== 'archived');

    // Calculate metadata
    const totalMembers = activeNPCPacks.reduce((sum: number, pack: any) => sum + (pack.members?.length || 0), 0);
    
    // Estimate size (rough calculation)
    const estimatedSize = this.estimateBundleSize(entryPoint, world, filteredRulesets, activeNPCs, activeNPCPacks);
    
    // Generate warnings
    const warnings = this.generateWarnings(entryPoint, world, filteredRulesets, activeNPCs, activeNPCPacks, estimatedSize, options.maxSize);
    
    // Generate assembly order
    const assemblyOrder = this.generateAssemblyOrder(entryPoint, world, filteredRulesets);

    return {
      entry: {
        id: entryPoint.id,
        name: entryPoint.name || entryPoint.title,
        slug: entryPoint.slug,
        description: entryPoint.description,
        status: entryPoint.lifecycle
      },
      world: {
        id: world.id,
        name: world.name,
        slug: world.slug,
        description: world.description
      },
      rulesets: filteredRulesets.map((r, index) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        version_semver: r.version_semver,
        status: r.status,
        sort_order: r.sort_order || index
      })),
      npcs: activeNPCs.map(n => ({
        id: n.id,
        name: n.name,
        slug: n.slug,
        description: n.description
      })),
      npc_packs: activeNPCPacks.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        members: p.members?.map(m => ({
          id: m.id,
          name: m.name,
          slug: m.slug
        })) || []
      })),
      metadata: {
        total_rulesets: filteredRulesets.length,
        total_npcs: activeNPCs.length,
        total_npc_packs: activeNPCPacks.length,
        total_members: totalMembers,
        estimated_size: estimatedSize,
        warnings,
        assembly_order: assemblyOrder
      }
    };
  }

  /**
   * Generate the runtime JSON that would be consumed
   */
  async generateRuntimeJSON(entryId: string, options: BundlePreviewOptions = {}): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const preview = await this.generatePreview(entryId, options);
      
      // Assemble the runtime JSON structure
      const runtimeJSON = {
        entry: preview.entry,
        world: preview.world,
        rulesets: preview.rulesets,
        npcs: preview.npcs,
        npc_packs: preview.npc_packs,
        metadata: {
          ...preview.metadata,
          generated_at: new Date().toISOString(),
          version: '1.0'
        }
      };

      return { success: true, data: runtimeJSON };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Copy bundle preview to clipboard
   */
  async copyToClipboard(entryId: string, options: BundlePreviewOptions = {}): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.generateRuntimeJSON(entryId, options);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to copy to clipboard' 
      };
    }
  }

  /**
   * Estimate bundle size in characters
   */
  private estimateBundleSize(
    entry: any,
    world: any,
    rulesets: any[],
    npcs: any[],
    npcPacks: any[]
  ): number {
    let size = 0;
    
    // Entry size
    size += JSON.stringify(entry).length;
    
    // World size
    size += JSON.stringify(world).length;
    
    // Rulesets size
    size += rulesets.reduce((sum, r) => sum + JSON.stringify(r).length, 0);
    
    // NPCs size
    size += npcs.reduce((sum, n) => sum + JSON.stringify(n).length, 0);
    
    // NPC packs size
    size += npcPacks.reduce((sum, p) => sum + JSON.stringify(p).length, 0);
    
    // Add overhead for structure
    size += 1000;
    
    return size;
  }

  /**
   * Generate warnings for the bundle
   */
  private generateWarnings(
    entry: any,
    world: any,
    rulesets: any[],
    npcs: any[],
    npcPacks: any[],
    estimatedSize: number,
    maxSize?: number
  ): string[] {
    const warnings: string[] = [];
    
    // Size warnings
    if (maxSize && estimatedSize > maxSize) {
      warnings.push(`Bundle size (${estimatedSize} chars) exceeds maximum (${maxSize} chars)`);
    }
    
    // Draft rulesets warning
    const draftRulesets = rulesets.filter(r => r.status === 'draft');
    if (draftRulesets.length > 0) {
      warnings.push(`${draftRulesets.length} draft ruleset(s) included - these may not be available in production`);
    }
    
    // Empty rulesets warning
    if (rulesets.length === 0) {
      warnings.push('No rulesets associated with this entry');
    }
    
    // Empty NPCs warning
    if (npcs.length === 0 && npcPacks.length === 0) {
      warnings.push('No NPCs or NPC packs associated with this entry');
    }
    
    // Large number of rulesets warning
    if (rulesets.length > 10) {
      warnings.push(`Large number of rulesets (${rulesets.length}) may impact performance`);
    }
    
    return warnings;
  }

  /**
   * Generate assembly order description
   */
  private generateAssemblyOrder(entry: any, world: any, rulesets: any[]): string[] {
    const order: string[] = [];
    
    order.push('1. Core system rules');
    order.push(`2. World: ${world.name}`);
    
    if (rulesets.length > 0) {
      order.push('3. Entry-specific rulesets (in order):');
      rulesets
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .forEach((r, index) => {
          order.push(`   ${index + 1}. ${r.name} (v${r.version_semver})`);
        });
    }
    
    return order;
  }
}

export const bundlePreviewService = new BundlePreviewService();
