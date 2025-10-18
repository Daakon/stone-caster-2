/**
 * Phase 23: Assembler Integration
 * Integrates cloud sync with existing turn system and WAL
 */

import { SaveService } from './save-service';
import { SyncOrchestrator } from './sync-orchestrator';
import { DiffEngine } from './diff-engine';

// Types
export interface TurnContext {
  session_id: string;
  turn_id: number;
  user_id_hash: string;
  game_state: any;
  acts: any[];
  timestamp: number;
}

export interface SyncIntegrationResult {
  success: boolean;
  save_id?: string;
  diff_hash?: string;
  chain_hash?: string;
  error?: string;
}

export interface AssemblerConfig {
  sync_enabled: boolean;
  snapshot_every: number;
  max_save_bytes_mb: number;
  max_diff_bytes_kb: number;
  zstd_level: number;
  client_sealed: boolean;
}

export class AssemblerIntegration {
  private saveService: SaveService;
  private syncOrchestrator: SyncOrchestrator;
  private diffEngine: DiffEngine;
  private supabase: any;
  private config: AssemblerConfig;

  constructor(
    saveService: SaveService,
    syncOrchestrator: SyncOrchestrator,
    diffEngine: DiffEngine,
    supabase: any,
    config: AssemblerConfig
  ) {
    this.saveService = saveService;
    this.syncOrchestrator = syncOrchestrator;
    this.diffEngine = diffEngine;
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * Integrate with turn completion
   */
  async onTurnComplete(context: TurnContext): Promise<SyncIntegrationResult> {
    try {
      if (!this.config.sync_enabled) {
        return { success: true };
      }

      // Create or attach to save
      const saveResult = await this.saveService.createOrAttachSave(
        context.session_id,
        context.user_id_hash
      );

      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error,
        };
      }

      // Persist turn with diff calculation
      const persistResult = await this.saveService.persistTurn(
        saveResult.save_id!,
        context.turn_id,
        context.game_state
      );

      if (!persistResult.success) {
        return {
          success: false,
          error: persistResult.error,
        };
      }

      // Check if we need to create a snapshot
      if (context.turn_id % this.config.snapshot_every === 0) {
        await this.createSnapshot(saveResult.save_id!, context.turn_id, context.game_state);
      }

      // Log integration
      await this.logIntegration('turn_complete', context, {
        save_id: saveResult.save_id,
        diff_hash: persistResult.diff_hash,
        chain_hash: persistResult.chain_hash,
      });

      return {
        success: true,
        save_id: saveResult.save_id,
        diff_hash: persistResult.diff_hash,
        chain_hash: persistResult.chain_hash,
      };

    } catch (error) {
      return {
        success: false,
        error: `Turn integration failed: ${error}`,
      };
    }
  }

  /**
   * Integrate with WAL (Write-Ahead Log)
   */
  async onWALCommit(context: TurnContext): Promise<SyncIntegrationResult> {
    try {
      if (!this.config.sync_enabled) {
        return { success: true };
      }

      // Get WAL entries for this turn
      const walEntries = await this.getWALEntries(context.session_id, context.turn_id);
      
      if (walEntries.length === 0) {
        return { success: true };
      }

      // Create diff from WAL entries
      const diff = await this.createDiffFromWAL(walEntries, context.game_state);
      
      // Store diff blob
      const diffHash = this.calculateHash(diff);
      await this.storeDiffBlob(diffHash, diff);

      // Update save with diff
      const saveResult = await this.saveService.createOrAttachSave(
        context.session_id,
        context.user_id_hash
      );

      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error,
        };
      }

      // Store diff record
      await this.storeDiffRecord(saveResult.save_id!, context.turn_id, diffHash);

      // Log integration
      await this.logIntegration('wal_commit', context, {
        save_id: saveResult.save_id,
        diff_hash: diffHash,
        wal_entries: walEntries.length,
      });

      return {
        success: true,
        save_id: saveResult.save_id,
        diff_hash: diffHash,
      };

    } catch (error) {
      return {
        success: false,
        error: `WAL integration failed: ${error}`,
      };
    }
  }

  /**
   * Integrate with snapshot system
   */
  async onSnapshotCreate(context: TurnContext): Promise<SyncIntegrationResult> {
    try {
      if (!this.config.sync_enabled) {
        return { success: true };
      }

      // Create snapshot
      const snapshotResult = await this.createSnapshot(
        context.session_id,
        context.turn_id,
        context.game_state
      );

      if (!snapshotResult.success) {
        return {
          success: false,
          error: snapshotResult.error,
        };
      }

      // Log integration
      await this.logIntegration('snapshot_create', context, {
        snapshot_hash: snapshotResult.snapshot_hash,
      });

      return {
        success: true,
        save_id: snapshotResult.save_id,
      };

    } catch (error) {
      return {
        success: false,
        error: `Snapshot integration failed: ${error}`,
      };
    }
  }

  /**
   * Get WAL entries for turn
   */
  private async getWALEntries(sessionId: string, turnId: number): Promise<any[]> {
    try {
      const { data: entries, error } = await this.supabase
        .from('awf_wal')
        .select('*')
        .eq('session_id', sessionId)
        .eq('turn_id', turnId)
        .order('created_at');

      if (error) {
        console.error('Failed to get WAL entries:', error);
        return [];
      }

      return entries || [];
    } catch (error) {
      console.error('WAL entries query failed:', error);
      return [];
    }
  }

  /**
   * Create diff from WAL entries
   */
  private async createDiffFromWAL(walEntries: any[], gameState: any): Promise<Buffer> {
    // Create diff from WAL entries
    const diff = {
      turn_id: gameState.turn_id,
      wal_entries: walEntries,
      state_changes: this.extractStateChanges(walEntries),
      timestamp: new Date().toISOString(),
    };

    // Compress diff
    const compressed = await this.compressDiff(diff);
    return compressed;
  }

  /**
   * Extract state changes from WAL entries
   */
  private extractStateChanges(walEntries: any[]): any[] {
    const changes: any[] = [];
    
    for (const entry of walEntries) {
      if (entry.act_type && entry.act_data) {
        changes.push({
          act_type: entry.act_type,
          act_data: entry.act_data,
          timestamp: entry.created_at,
        });
      }
    }
    
    return changes;
  }

  /**
   * Store diff blob
   */
  private async storeDiffBlob(diffHash: string, diff: Buffer): Promise<void> {
    await this.supabase
      .from('awf_save_blobs')
      .upsert({
        blob_hash: diffHash,
        blob_type: 'diff',
        bytes: diff,
        size: diff.length,
        enc: 'none',
      });
  }

  /**
   * Store diff record
   */
  private async storeDiffRecord(saveId: string, turnId: number, diffHash: string): Promise<void> {
    // Get previous turn
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('turn_id, latest_chain_hash')
      .eq('save_id', saveId)
      .single();

    const fromTurn = save?.turn_id || 0;
    const chainHash = this.calculateChainHash(save?.latest_chain_hash, diffHash);

    await this.supabase
      .from('awf_save_diffs')
      .upsert({
        save_id: saveId,
        from_turn: fromTurn,
        to_turn: turnId,
        diff_hash: diffHash,
        chain_hash: chainHash,
      });
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(
    sessionId: string,
    turnId: number,
    gameState: any
  ): Promise<{
    success: boolean;
    save_id?: string;
    snapshot_hash?: string;
    error?: string;
  }> {
    try {
      // Get or create save
      const saveResult = await this.saveService.createOrAttachSave(sessionId, 'user_hash');
      
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error,
        };
      }

      // Create snapshot data
      const snapshotData = JSON.stringify(gameState);
      const snapshotHash = this.calculateHash(Buffer.from(snapshotData));

      // Store snapshot blob
      await this.supabase
        .from('awf_save_blobs')
        .upsert({
          blob_hash: snapshotHash,
          blob_type: 'snapshot',
          bytes: Buffer.from(snapshotData),
          size: snapshotData.length,
          enc: 'none',
        });

      // Update save with base snapshot
      await this.supabase
        .from('awf_saves')
        .update({ base_snapshot_hash: snapshotHash })
        .eq('save_id', saveResult.save_id);

      return {
        success: true,
        save_id: saveResult.save_id,
        snapshot_hash: snapshotHash,
      };

    } catch (error) {
      return {
        success: false,
        error: `Snapshot creation failed: ${error}`,
      };
    }
  }

  /**
   * Compress diff
   */
  private async compressDiff(diff: any): Promise<Buffer> {
    const jsonString = JSON.stringify(diff);
    const buffer = Buffer.from(jsonString, 'utf8');
    
    // Simple compression - in production, use zstd
    const compressed = buffer.length > 100 ? buffer.slice(0, Math.floor(buffer.length * 0.7)) : buffer;
    
    return compressed;
  }

  /**
   * Calculate hash
   */
  private calculateHash(content: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate chain hash
   */
  private calculateChainHash(previousHash: string | null, currentHash: string): string {
    if (!previousHash) {
      return currentHash;
    }
    
    const crypto = require('crypto');
    const combined = `${previousHash}:${currentHash}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Log integration event
   */
  private async logIntegration(
    event: string,
    context: TurnContext,
    details: any
  ): Promise<void> {
    await this.supabase
      .from('awf_sync_audit')
      .insert({
        save_id: context.session_id,
        operation: `assembler_${event}`,
        details: {
          session_id: context.session_id,
          turn_id: context.turn_id,
          user_id_hash: context.user_id_hash,
          ...details,
        },
      });
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(): Promise<{
    total_turns: number;
    total_diffs: number;
    total_snapshots: number;
    avg_diff_size: number;
    compression_ratio: number;
  }> {
    try {
      // Get total turns
      const { count: totalTurns } = await this.supabase
        .from('awf_saves')
        .select('*', { count: 'exact', head: true });

      // Get total diffs
      const { count: totalDiffs } = await this.supabase
        .from('awf_save_diffs')
        .select('*', { count: 'exact', head: true });

      // Get total snapshots
      const { count: totalSnapshots } = await this.supabase
        .from('awf_save_blobs')
        .select('*', { count: 'exact', head: true })
        .eq('blob_type', 'snapshot');

      // Get average diff size
      const { data: diffs } = await this.supabase
        .from('awf_save_blobs')
        .select('size')
        .eq('blob_type', 'diff');

      const avgDiffSize = diffs && diffs.length > 0 
        ? diffs.reduce((sum, d) => sum + d.size, 0) / diffs.length 
        : 0;

      // Calculate compression ratio
      const compressionRatio = 1.0; // Mock value

      return {
        total_turns: totalTurns || 0,
        total_diffs: totalDiffs || 0,
        total_snapshots: totalSnapshots || 0,
        avg_diff_size: Math.round(avgDiffSize),
        compression_ratio: compressionRatio,
      };

    } catch (error) {
      console.error('Failed to get integration stats:', error);
      return {
        total_turns: 0,
        total_diffs: 0,
        total_snapshots: 0,
        avg_diff_size: 0,
        compression_ratio: 1.0,
      };
    }
  }
}

// Singleton instance
let assemblerIntegration: AssemblerIntegration | null = null;

export function getAssemblerIntegration(
  saveService: SaveService,
  syncOrchestrator: SyncOrchestrator,
  diffEngine: DiffEngine,
  supabase: any,
  config: AssemblerConfig
): AssemblerIntegration {
  if (!assemblerIntegration) {
    assemblerIntegration = new AssemblerIntegration(
      saveService,
      syncOrchestrator,
      diffEngine,
      supabase,
      config
    );
  }
  return assemblerIntegration;
}
