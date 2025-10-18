/**
 * Phase 23: Conflict Resolver
 * Handles conflict resolution for concurrent writes with three-way merge
 */

import { z } from 'zod';
import { createHash } from 'crypto';

// Types
export interface ConflictResolution {
  resolution_id: string;
  save_id: string;
  chosen_branch: string;
  archived_branch: string;
  reason: string;
  merge_strategy: 'server_wins' | 'client_wins' | 'three_way_merge' | 'longest_chain';
  created_at: string;
}

export interface ConflictBranch {
  branch_id: string;
  turn_id: number;
  chain_hash: string;
  device_id: string;
  integrity_score: number;
  created_at: string;
}

export interface ConflictReport {
  conflict_id: string;
  save_id: string;
  branches: ConflictBranch[];
  resolution: ConflictResolution;
  merge_result?: any;
  created_at: string;
}

export interface ThreeWayMerge {
  base: any;
  server: any;
  client: any;
  result: any;
  conflicts: MergeConflict[];
}

export interface MergeConflict {
  path: string;
  server_value: any;
  client_value: any;
  resolution: 'server' | 'client' | 'manual';
}

// Schemas
const ConflictResolutionSchema = z.object({
  save_id: z.string().uuid(),
  branches: z.array(z.object({
    branch_id: z.string(),
    turn_id: z.number().int().min(0),
    chain_hash: z.string(),
    device_id: z.string(),
    integrity_score: z.number().min(0).max(100),
    created_at: z.string(),
  })),
  strategy: z.enum(['server_wins', 'client_wins', 'three_way_merge', 'longest_chain']),
});

export class ConflictResolver {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Resolve conflict between branches
   */
  async resolveConflict(
    saveId: string,
    branches: ConflictBranch[],
    strategy: 'server_wins' | 'client_wins' | 'three_way_merge' | 'longest_chain' = 'longest_chain'
  ): Promise<ConflictReport> {
    try {
      const validation = ConflictResolutionSchema.safeParse({
        save_id: saveId,
        branches,
        strategy,
      });

      if (!validation.success) {
        throw new Error(`Invalid conflict resolution request: ${validation.error.message}`);
      }

      // Determine resolution strategy
      const resolution = await this.determineResolution(branches, strategy);
      
      // Create conflict report
      const conflictId = this.generateConflictId();
      const conflictReport: ConflictReport = {
        conflict_id: conflictId,
        save_id: saveId,
        branches,
        resolution: {
          resolution_id: this.generateResolutionId(),
          save_id: saveId,
          chosen_branch: resolution.chosen_branch,
          archived_branch: resolution.archived_branch,
          reason: resolution.reason,
          merge_strategy: strategy,
          created_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      };

      // Perform merge if needed
      if (strategy === 'three_way_merge') {
        const mergeResult = await this.performThreeWayMerge(saveId, branches);
        conflictReport.merge_result = mergeResult.result;
      }

      // Archive losing branch
      await this.archiveBranch(saveId, resolution.archived_branch, conflictId);

      // Log resolution
      await this.logConflictResolution(conflictReport);

      return conflictReport;

    } catch (error) {
      throw new Error(`Conflict resolution failed: ${error}`);
    }
  }

  /**
   * Determine resolution based on strategy
   */
  private async determineResolution(
    branches: ConflictBranch[],
    strategy: string
  ): Promise<{
    chosen_branch: string;
    archived_branch: string;
    reason: string;
  }> {
    if (branches.length < 2) {
      throw new Error('At least two branches required for conflict resolution');
    }

    switch (strategy) {
      case 'server_wins':
        return this.resolveServerWins(branches);
      
      case 'client_wins':
        return this.resolveClientWins(branches);
      
      case 'longest_chain':
        return this.resolveLongestChain(branches);
      
      case 'three_way_merge':
        return this.resolveThreeWayMerge(branches);
      
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  /**
   * Resolve with server wins strategy
   */
  private resolveServerWins(branches: ConflictBranch[]): {
    chosen_branch: string;
    archived_branch: string;
    reason: string;
  } {
    const serverBranch = branches.find(b => b.device_id === 'server');
    const clientBranch = branches.find(b => b.device_id !== 'server');
    
    if (!serverBranch || !clientBranch) {
      throw new Error('Server and client branches required for server_wins strategy');
    }

    return {
      chosen_branch: serverBranch.branch_id,
      archived_branch: clientBranch.branch_id,
      reason: 'Server branch chosen by policy',
    };
  }

  /**
   * Resolve with client wins strategy
   */
  private resolveClientWins(branches: ConflictBranch[]): {
    chosen_branch: string;
    archived_branch: string;
    reason: string;
  } {
    const serverBranch = branches.find(b => b.device_id === 'server');
    const clientBranch = branches.find(b => b.device_id !== 'server');
    
    if (!serverBranch || !clientBranch) {
      throw new Error('Server and client branches required for client_wins strategy');
    }

    return {
      chosen_branch: clientBranch.branch_id,
      archived_branch: serverBranch.branch_id,
      reason: 'Client branch chosen by policy',
    };
  }

  /**
   * Resolve with longest chain strategy
   */
  private resolveLongestChain(branches: ConflictBranch[]): {
    chosen_branch: string;
    archived_branch: string;
    reason: string;
  } {
    // Sort by turn_id (longest chain)
    const sortedBranches = branches.sort((a, b) => b.turn_id - a.turn_id);
    
    // If turn counts are equal, prefer higher integrity score
    if (sortedBranches[0].turn_id === sortedBranches[1].turn_id) {
      const sortedByIntegrity = branches.sort((a, b) => b.integrity_score - a.integrity_score);
      return {
        chosen_branch: sortedByIntegrity[0].branch_id,
        archived_branch: sortedByIntegrity[1].branch_id,
        reason: 'Branch with higher integrity score chosen',
      };
    }

    return {
      chosen_branch: sortedBranches[0].branch_id,
      archived_branch: sortedBranches[1].branch_id,
      reason: `Branch with longer chain (${sortedBranches[0].turn_id} vs ${sortedBranches[1].turn_id} turns)`,
    };
  }

  /**
   * Resolve with three-way merge strategy
   */
  private resolveThreeWayMerge(branches: ConflictBranch[]): {
    chosen_branch: string;
    archived_branch: string;
    reason: string;
  } {
    // For three-way merge, we'll create a new merged branch
    const mergedBranchId = this.generateBranchId();
    
    return {
      chosen_branch: mergedBranchId,
      archived_branch: branches.map(b => b.branch_id).join(','),
      reason: 'Three-way merge performed, original branches archived',
    };
  }

  /**
   * Perform three-way merge
   */
  private async performThreeWayMerge(
    saveId: string,
    branches: ConflictBranch[]
  ): Promise<ThreeWayMerge> {
    // Get base state (common ancestor)
    const baseState = await this.getBaseState(saveId);
    
    // Get server and client states
    const serverBranch = branches.find(b => b.device_id === 'server');
    const clientBranch = branches.find(b => b.device_id !== 'server');
    
    if (!serverBranch || !clientBranch) {
      throw new Error('Server and client branches required for three-way merge');
    }

    const serverState = await this.getBranchState(saveId, serverBranch);
    const clientState = await this.getBranchState(saveId, clientBranch);

    // Perform three-way merge
    const mergeResult = this.mergeStates(baseState, serverState, clientState);

    return {
      base: baseState,
      server: serverState,
      client: clientState,
      result: mergeResult.result,
      conflicts: mergeResult.conflicts,
    };
  }

  /**
   * Merge three states using three-way merge algorithm
   */
  private mergeStates(base: any, server: any, client: any): {
    result: any;
    conflicts: MergeConflict[];
  } {
    const result: any = {};
    const conflicts: MergeConflict[] = [];

    // Get all keys from all states
    const allKeys = new Set([
      ...Object.keys(base || {}),
      ...Object.keys(server || {}),
      ...Object.keys(client || {}),
    ]);

    for (const key of allKeys) {
      const baseValue = base?.[key];
      const serverValue = server?.[key];
      const clientValue = client?.[key];

      // Check for conflicts
      if (this.hasConflict(baseValue, serverValue, clientValue)) {
        conflicts.push({
          path: `/${key}`,
          server_value: serverValue,
          client_value: clientValue,
          resolution: 'server', // Default to server, could be configurable
        });
        
        // Use server value as default
        result[key] = serverValue;
      } else {
        // No conflict, use the non-base value
        result[key] = serverValue !== baseValue ? serverValue : clientValue;
      }
    }

    return { result, conflicts };
  }

  /**
   * Check if there's a conflict between three values
   */
  private hasConflict(base: any, server: any, client: any): boolean {
    // No conflict if server and client are the same
    if (JSON.stringify(server) === JSON.stringify(client)) {
      return false;
    }

    // No conflict if one branch matches base (no change)
    if (JSON.stringify(server) === JSON.stringify(base) || 
        JSON.stringify(client) === JSON.stringify(base)) {
      return false;
    }

    // Conflict if both branches changed from base
    return true;
  }

  /**
   * Get base state for merge
   */
  private async getBaseState(saveId: string): Promise<any> {
    // Get the base snapshot
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('base_snapshot_hash')
      .eq('save_id', saveId)
      .single();

    if (!save?.base_snapshot_hash) {
      return {};
    }

    const { data: snapshot } = await this.supabase
      .from('awf_save_blobs')
      .select('bytes')
      .eq('blob_hash', save.base_snapshot_hash)
      .single();

    if (!snapshot) {
      return {};
    }

    return JSON.parse(snapshot.bytes.toString());
  }

  /**
   * Get branch state
   */
  private async getBranchState(saveId: string, branch: ConflictBranch): Promise<any> {
    // This would rebuild the state for the specific branch
    // For now, return mock state
    return { branch_id: branch.branch_id, turn_id: branch.turn_id };
  }

  /**
   * Archive losing branch
   */
  private async archiveBranch(
    saveId: string,
    branchId: string,
    conflictId: string
  ): Promise<void> {
    await this.supabase
      .from('awf_save_archives')
      .insert({
        save_id: saveId,
        reason: 'conflict',
        meta: {
          conflict_id: conflictId,
          archived_branch: branchId,
          archived_at: new Date().toISOString(),
        },
      });
  }

  /**
   * Log conflict resolution
   */
  private async logConflictResolution(report: ConflictReport): Promise<void> {
    await this.supabase
      .from('awf_sync_audit')
      .insert({
        save_id: report.save_id,
        operation: 'conflict_resolved',
        details: {
          conflict_id: report.conflict_id,
          resolution: report.resolution,
          branches_count: report.branches.length,
        },
      });
  }

  /**
   * Get conflict statistics
   */
  async getConflictStats(): Promise<{
    total_conflicts: number;
    resolved_conflicts: number;
    pending_conflicts: number;
    resolution_strategies: Record<string, number>;
  }> {
    try {
      // Get total conflicts
      const { count: totalConflicts } = await this.supabase
        .from('awf_save_archives')
        .select('*', { count: 'exact', head: true })
        .eq('reason', 'conflict');

      // Get resolved conflicts (archives with resolution metadata)
      const { count: resolvedConflicts } = await this.supabase
        .from('awf_save_archives')
        .select('*', { count: 'exact', head: true })
        .eq('reason', 'conflict')
        .not('meta->resolution', 'is', null);

      // Get resolution strategies
      const { data: resolutions } = await this.supabase
        .from('awf_sync_audit')
        .select('details')
        .eq('operation', 'conflict_resolved');

      const strategies: Record<string, number> = {};
      for (const resolution of resolutions || []) {
        const strategy = resolution.details?.resolution?.merge_strategy || 'unknown';
        strategies[strategy] = (strategies[strategy] || 0) + 1;
      }

      return {
        total_conflicts: totalConflicts || 0,
        resolved_conflicts: resolvedConflicts || 0,
        pending_conflicts: (totalConflicts || 0) - (resolvedConflicts || 0),
        resolution_strategies: strategies,
      };

    } catch (error) {
      console.error('Failed to get conflict stats:', error);
      return {
        total_conflicts: 0,
        resolved_conflicts: 0,
        pending_conflicts: 0,
        resolution_strategies: {},
      };
    }
  }

  /**
   * Generate conflict ID
   */
  private generateConflictId(): string {
    return createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate resolution ID
   */
  private generateResolutionId(): string {
    return createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate branch ID
   */
  private generateBranchId(): string {
    return createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }
}

// Singleton instance
let conflictResolver: ConflictResolver | null = null;

export function getConflictResolver(supabase: any): ConflictResolver {
  if (!conflictResolver) {
    conflictResolver = new ConflictResolver(supabase);
  }
  return conflictResolver;
}
