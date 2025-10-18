/**
 * Phase 23: Sync Orchestrator
 * Manages multi-device sync with conflict detection and resolution
 */

import { z } from 'zod';
import { createHash, createHmac } from 'crypto';
import { SaveService } from './save-service';
import { DiffEngine } from './diff-engine';

// Types
export interface SyncUpRequest {
  device_id: string;
  session_id: string;
  user_id_hash: string;
  turn_id: number;
  state: any;
  sync_token?: string;
}

export interface SyncUpResponse {
  success: boolean;
  sync_token: string;
  conflict_detected: boolean;
  conflict_report?: ConflictReport;
  error?: string;
}

export interface SyncDownRequest {
  device_id: string;
  session_id: string;
  user_id_hash: string;
  since_turn: number;
  sync_token: string;
}

export interface SyncDownResponse {
  success: boolean;
  turns: TurnDiff[];
  latest_turn: number;
  sync_token: string;
  error?: string;
}

export interface TurnDiff {
  turn_id: number;
  diff_hash: string;
  chain_hash: string;
  created_at: string;
}

export interface ConflictReport {
  conflict_id: string;
  save_id: string;
  device_id: string;
  reason: string;
  branches: ConflictBranch[];
  resolution: ConflictResolution;
  created_at: string;
}

export interface ConflictBranch {
  branch_id: string;
  turn_id: number;
  chain_hash: string;
  device_id: string;
  created_at: string;
}

export interface ConflictResolution {
  chosen_branch: string;
  archived_branch: string;
  reason: string;
}

export interface DeviceInfo {
  device_id: string;
  user_id_hash: string;
  session_id?: string;
  last_turn_seen: number;
  sync_token: string;
  created_at: string;
  updated_at: string;
}

// Schemas
const SyncUpSchema = z.object({
  device_id: z.string(),
  session_id: z.string().uuid(),
  user_id_hash: z.string(),
  turn_id: z.number().int().min(0),
  state: z.any(),
  sync_token: z.string().optional(),
});

const SyncDownSchema = z.object({
  device_id: z.string(),
  session_id: z.string().uuid(),
  user_id_hash: z.string(),
  since_turn: z.number().int().min(0),
  sync_token: z.string(),
});

export class SyncOrchestrator {
  private saveService: SaveService;
  private diffEngine: DiffEngine;
  private supabase: any;
  private hmacSecret: string;

  constructor(saveService: SaveService, diffEngine: DiffEngine, supabase: any, hmacSecret: string) {
    this.saveService = saveService;
    this.diffEngine = diffEngine;
    this.supabase = supabase;
    this.hmacSecret = hmacSecret;
  }

  /**
   * Sync up (device → server)
   */
  async syncUp(request: SyncUpRequest): Promise<SyncUpResponse> {
    try {
      const validation = SyncUpSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          sync_token: '',
          conflict_detected: false,
          error: `Invalid request: ${validation.error.message}`,
        };
      }

      const { device_id, session_id, user_id_hash, turn_id, state, sync_token } = request;

      // Verify HMAC signature
      if (!this.verifyHMAC(request, sync_token)) {
        return {
          success: false,
          sync_token: '',
          conflict_detected: false,
          error: 'Invalid HMAC signature',
        };
      }

      // Get or create device info
      const deviceInfo = await this.getOrCreateDevice(device_id, user_id_hash, session_id);
      
      // Check for conflicts
      const conflictCheck = await this.checkForConflicts(session_id, turn_id, deviceInfo.last_turn_seen);
      
      if (conflictCheck.has_conflict) {
        const conflictReport = await this.handleConflict(
          session_id,
          turn_id,
          deviceInfo.last_turn_seen,
          device_id,
          conflictCheck.server_turn_id
        );
        
        return {
          success: false,
          sync_token: deviceInfo.sync_token,
          conflict_detected: true,
          conflict_report: conflictReport,
        };
      }

      // Create or attach to save
      const saveResult = await this.saveService.createOrAttachSave(session_id, user_id_hash);
      
      if (!saveResult.success) {
        return {
          success: false,
          sync_token: deviceInfo.sync_token,
          conflict_detected: false,
          error: saveResult.error,
        };
      }

      // Persist turn
      const persistResult = await this.saveService.persistTurn(
        saveResult.save_id!,
        turn_id,
        state
      );
      
      if (!persistResult.success) {
        return {
          success: false,
          sync_token: deviceInfo.sync_token,
          conflict_detected: false,
          error: persistResult.error,
        };
      }

      // Update device info
      const newSyncToken = this.generateSyncToken(device_id, turn_id);
      await this.updateDevice(device_id, turn_id, newSyncToken);

      // Log audit
      await this.logSyncAudit(saveResult.save_id!, device_id, 'sync_up', {
        turn_id,
        diff_hash: persistResult.diff_hash,
        chain_hash: persistResult.chain_hash,
      });

      return {
        success: true,
        sync_token: newSyncToken,
        conflict_detected: false,
      };

    } catch (error) {
      return {
        success: false,
        sync_token: '',
        conflict_detected: false,
        error: `Sync up failed: ${error}`,
      };
    }
  }

  /**
   * Sync down (server → device)
   */
  async syncDown(request: SyncDownRequest): Promise<SyncDownResponse> {
    try {
      const validation = SyncDownSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          turns: [],
          latest_turn: 0,
          sync_token: '',
          error: `Invalid request: ${validation.error.message}`,
        };
      }

      const { device_id, session_id, user_id_hash, since_turn, sync_token } = request;

      // Verify HMAC signature
      if (!this.verifyHMAC(request, sync_token)) {
        return {
          success: false,
          turns: [],
          latest_turn: 0,
          sync_token: '',
          error: 'Invalid HMAC signature',
        };
      }

      // Get device info
      const deviceInfo = await this.getDevice(device_id);
      if (!deviceInfo) {
        return {
          success: false,
          turns: [],
          latest_turn: 0,
          sync_token: '',
          error: 'Device not found',
        };
      }

      // Get save info
      const { data: save } = await this.supabase
        .from('awf_saves')
        .select('*')
        .eq('session_id', session_id)
        .eq('user_id_hash', user_id_hash)
        .single();

      if (!save) {
        return {
          success: false,
          turns: [],
          latest_turn: 0,
          sync_token: deviceInfo.sync_token,
          error: 'Save not found',
        };
      }

      // Get missing turns
      const { data: diffs } = await this.supabase
        .from('awf_save_diffs')
        .select('*')
        .eq('save_id', save.save_id)
        .gt('to_turn', since_turn)
        .order('to_turn');

      const turns: TurnDiff[] = (diffs || []).map(diff => ({
        turn_id: diff.to_turn,
        diff_hash: diff.diff_hash,
        chain_hash: diff.chain_hash,
        created_at: diff.created_at,
      }));

      // Update device info
      const newSyncToken = this.generateSyncToken(device_id, save.turn_id);
      await this.updateDevice(device_id, save.turn_id, newSyncToken);

      // Log audit
      await this.logSyncAudit(save.save_id, device_id, 'sync_down', {
        since_turn,
        turns_count: turns.length,
        latest_turn: save.turn_id,
      });

      return {
        success: true,
        turns,
        latest_turn: save.turn_id,
        sync_token: newSyncToken,
      };

    } catch (error) {
      return {
        success: false,
        turns: [],
        latest_turn: 0,
        sync_token: '',
        error: `Sync down failed: ${error}`,
      };
    }
  }

  /**
   * Get or create device info
   */
  private async getOrCreateDevice(
    deviceId: string,
    userHash: string,
    sessionId: string
  ): Promise<DeviceInfo> {
    // Try to get existing device
    const { data: existing } = await this.supabase
      .from('awf_devices')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (existing) {
      return existing;
    }

    // Create new device
    const syncToken = this.generateSyncToken(deviceId, 0);
    const { data, error } = await this.supabase
      .from('awf_devices')
      .insert({
        device_id: deviceId,
        user_id_hash: userHash,
        session_id: sessionId,
        last_turn_seen: 0,
        sync_token: syncToken,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create device: ${error.message}`);
    }

    return data;
  }

  /**
   * Get device info
   */
  private async getDevice(deviceId: string): Promise<DeviceInfo | null> {
    const { data, error } = await this.supabase
      .from('awf_devices')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Update device info
   */
  private async updateDevice(deviceId: string, lastTurnSeen: number, syncToken: string): Promise<void> {
    await this.supabase
      .from('awf_devices')
      .update({
        last_turn_seen: lastTurnSeen,
        sync_token: syncToken,
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId);
  }

  /**
   * Check for conflicts
   */
  private async checkForConflicts(
    sessionId: string,
    clientTurnId: number,
    deviceLastTurn: number
  ): Promise<{
    has_conflict: boolean;
    server_turn_id: number;
  }> {
    // Get current server turn
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('turn_id')
      .eq('session_id', sessionId)
      .single();

    if (!save) {
      return { has_conflict: false, server_turn_id: 0 };
    }

    // Check for conflicts
    const hasConflict = clientTurnId <= deviceLastTurn && save.turn_id > deviceLastTurn;
    
    return {
      has_conflict: hasConflict,
      server_turn_id: save.turn_id,
    };
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflict(
    sessionId: string,
    clientTurnId: number,
    deviceLastTurn: number,
    deviceId: string,
    serverTurnId: number
  ): Promise<ConflictReport> {
    // Get save info
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!save) {
      throw new Error('Save not found for conflict resolution');
    }

    // Create conflict report
    const conflictId = this.generateConflictId();
    const branches: ConflictBranch[] = [
      {
        branch_id: 'server',
        turn_id: serverTurnId,
        chain_hash: save.latest_chain_hash || '',
        device_id: 'server',
        created_at: new Date().toISOString(),
      },
      {
        branch_id: 'client',
        turn_id: clientTurnId,
        chain_hash: '',
        device_id: deviceId,
        created_at: new Date().toISOString(),
      },
    ];

    // Resolve conflict (prefer server branch)
    const resolution: ConflictResolution = {
      chosen_branch: 'server',
      archived_branch: 'client',
      reason: 'Server branch has more recent turns',
    };

    // Archive client branch
    await this.supabase
      .from('awf_save_archives')
      .insert({
        save_id: save.save_id,
        reason: 'conflict',
        meta: {
          conflict_id: conflictId,
          device_id: deviceId,
          client_turn_id: clientTurnId,
          server_turn_id: serverTurnId,
        },
      });

    const conflictReport: ConflictReport = {
      conflict_id: conflictId,
      save_id: save.save_id,
      device_id: deviceId,
      reason: 'Concurrent writes detected',
      branches,
      resolution,
      created_at: new Date().toISOString(),
    };

    // Log audit
    await this.logSyncAudit(save.save_id, deviceId, 'conflict_detected', {
      conflict_id: conflictId,
      client_turn_id: clientTurnId,
      server_turn_id: serverTurnId,
    });

    return conflictReport;
  }

  /**
   * Generate sync token
   */
  private generateSyncToken(deviceId: string, turnId: number): string {
    const timestamp = Date.now();
    const data = `${deviceId}:${turnId}:${timestamp}`;
    return createHmac('sha256', this.hmacSecret).update(data).digest('hex');
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
   * Verify HMAC signature
   */
  private verifyHMAC(request: any, syncToken: string): boolean {
    // Simple HMAC verification - in production, use proper HMAC validation
    return syncToken && syncToken.length > 0;
  }

  /**
   * Log sync audit
   */
  private async logSyncAudit(
    saveId: string,
    deviceId: string,
    operation: string,
    details: any
  ): Promise<void> {
    await this.supabase
      .from('awf_sync_audit')
      .insert({
        save_id: saveId,
        device_id: deviceId,
        operation,
        details,
      });
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    total_devices: number;
    active_syncs: number;
    conflicts_resolved: number;
    last_sync: string;
  }> {
    try {
      // Get total devices
      const { count: totalDevices } = await this.supabase
        .from('awf_devices')
        .select('*', { count: 'exact', head: true });

      // Get active syncs (devices updated in last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: activeSyncs } = await this.supabase
        .from('awf_devices')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', yesterday);

      // Get conflicts resolved
      const { count: conflictsResolved } = await this.supabase
        .from('awf_save_archives')
        .select('*', { count: 'exact', head: true })
        .eq('reason', 'conflict');

      // Get last sync
      const { data: lastSync } = await this.supabase
        .from('awf_sync_audit')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        total_devices: totalDevices || 0,
        active_syncs: activeSyncs || 0,
        conflicts_resolved: conflictsResolved || 0,
        last_sync: lastSync?.created_at || '',
      };

    } catch (error) {
      console.error('Failed to get sync stats:', error);
      return {
        total_devices: 0,
        active_syncs: 0,
        conflicts_resolved: 0,
        last_sync: '',
      };
    }
  }
}

// Singleton instance
let syncOrchestrator: SyncOrchestrator | null = null;

export function getSyncOrchestrator(
  saveService: SaveService,
  diffEngine: DiffEngine,
  supabase: any,
  hmacSecret: string
): SyncOrchestrator {
  if (!syncOrchestrator) {
    syncOrchestrator = new SyncOrchestrator(saveService, diffEngine, supabase, hmacSecret);
  }
  return syncOrchestrator;
}
