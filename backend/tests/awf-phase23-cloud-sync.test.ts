/**
 * Phase 23: Cloud Sync Tests
 * Comprehensive tests for cloud save/sync system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveService } from '../src/saves/save-service';
import { SyncOrchestrator } from '../src/saves/sync-orchestrator';
import { ConflictResolver } from '../src/saves/conflict-resolver';
import { PrivacyOps } from '../src/saves/privacy-ops';
import { DiffEngine } from '../src/saves/diff-engine';
import { AssemblerIntegration } from '../src/saves/assembler-integration';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: null, error: null })),
        order: vi.fn(() => ({ data: [], error: null })),
      })),
      order: vi.fn(() => ({ data: [], error: null })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({ data: { save_id: 'test-save-id' }, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ data: null, error: null })),
    })),
    upsert: vi.fn(() => ({ data: null, error: null })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({ count: 0, error: null })),
    })),
  })),
};

// Mock configuration
const mockConfig = {
  sync_enabled: true,
  snapshot_every: 25,
  max_save_bytes_mb: 200,
  max_diff_bytes_kb: 128,
  zstd_level: 10,
  verify_sample_pct: 1,
  retention_days: 365,
  user_quota_mb: 1024,
  client_sealed: false,
  hmac_secret: 'test-secret',
};

describe('Phase 23: Cloud Sync System', () => {
  let saveService: SaveService;
  let syncOrchestrator: SyncOrchestrator;
  let conflictResolver: ConflictResolver;
  let privacyOps: PrivacyOps;
  let diffEngine: DiffEngine;
  let assemblerIntegration: AssemblerIntegration;

  beforeEach(() => {
    saveService = new SaveService(mockSupabase);
    syncOrchestrator = new SyncOrchestrator(saveService, diffEngine, mockSupabase, 'test-secret');
    conflictResolver = new ConflictResolver(mockSupabase);
    privacyOps = new PrivacyOps(mockSupabase, mockConfig);
    diffEngine = new DiffEngine({
      compression_level: 10,
      max_diff_size: 128 * 1024,
      binary_fast_path: true,
    });
    assemblerIntegration = new AssemblerIntegration(
      saveService,
      syncOrchestrator,
      diffEngine,
      mockSupabase,
      mockConfig
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SaveService', () => {
    it('should create or attach save successfully', async () => {
      const result = await saveService.createOrAttachSave(
        'test-session-id',
        'user-hash-123'
      );

      expect(result.success).toBe(true);
      expect(result.save_id).toBeDefined();
    });

    it('should persist turn with diff calculation', async () => {
      const result = await saveService.persistTurn(
        'test-save-id',
        1,
        { test: 'state' }
      );

      expect(result.success).toBe(true);
      expect(result.diff_hash).toBeDefined();
      expect(result.chain_hash).toBeDefined();
    });

    it('should materialize save to specific turn', async () => {
      const result = await saveService.materialize('test-save-id', 5);

      expect(result.success).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.turn_id).toBeDefined();
    });

    it('should verify save integrity', async () => {
      const result = await saveService.verify('test-save-id');

      expect(result.success).toBe(true);
      expect(typeof result.integrity_ok).toBe('boolean');
    });
  });

  describe('SyncOrchestrator', () => {
    it('should sync up successfully', async () => {
      const request = {
        device_id: 'device-123',
        session_id: 'session-123',
        user_id_hash: 'user-hash-123',
        turn_id: 1,
        state: { test: 'state' },
        sync_token: 'token-123',
      };

      const result = await syncOrchestrator.syncUp(request);

      expect(result.success).toBe(true);
      expect(result.sync_token).toBeDefined();
      expect(typeof result.conflict_detected).toBe('boolean');
    });

    it('should sync down successfully', async () => {
      const request = {
        device_id: 'device-123',
        session_id: 'session-123',
        user_id_hash: 'user-hash-123',
        since_turn: 0,
        sync_token: 'token-123',
      };

      const result = await syncOrchestrator.syncDown(request);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.turns)).toBe(true);
      expect(typeof result.latest_turn).toBe('number');
      expect(result.sync_token).toBeDefined();
    });

    it('should get sync statistics', async () => {
      const stats = await syncOrchestrator.getSyncStats();

      expect(stats.total_devices).toBeDefined();
      expect(stats.active_syncs).toBeDefined();
      expect(stats.conflicts_resolved).toBeDefined();
      expect(stats.last_sync).toBeDefined();
    });
  });

  describe('ConflictResolver', () => {
    it('should resolve conflict with server wins strategy', async () => {
      const branches = [
        {
          branch_id: 'server',
          turn_id: 10,
          chain_hash: 'chain-123',
          device_id: 'server',
          integrity_score: 95,
          created_at: new Date().toISOString(),
        },
        {
          branch_id: 'client',
          turn_id: 8,
          chain_hash: 'chain-456',
          device_id: 'device-123',
          integrity_score: 90,
          created_at: new Date().toISOString(),
        },
      ];

      const result = await conflictResolver.resolveConflict(
        'test-save-id',
        branches,
        'server_wins'
      );

      expect(result.conflict_id).toBeDefined();
      expect(result.save_id).toBe('test-save-id');
      expect(result.branches).toHaveLength(2);
      expect(result.resolution.chosen_branch).toBe('server');
    });

    it('should resolve conflict with longest chain strategy', async () => {
      const branches = [
        {
          branch_id: 'client',
          turn_id: 12,
          chain_hash: 'chain-789',
          device_id: 'device-123',
          integrity_score: 85,
          created_at: new Date().toISOString(),
        },
        {
          branch_id: 'server',
          turn_id: 10,
          chain_hash: 'chain-123',
          device_id: 'server',
          integrity_score: 95,
          created_at: new Date().toISOString(),
        },
      ];

      const result = await conflictResolver.resolveConflict(
        'test-save-id',
        branches,
        'longest_chain'
      );

      expect(result.resolution.chosen_branch).toBe('client');
    });

    it('should get conflict statistics', async () => {
      const stats = await conflictResolver.getConflictStats();

      expect(stats.total_conflicts).toBeDefined();
      expect(stats.resolved_conflicts).toBeDefined();
      expect(stats.pending_conflicts).toBeDefined();
      expect(typeof stats.resolution_strategies).toBe('object');
    });
  });

  describe('PrivacyOps', () => {
    it('should export save data successfully', async () => {
      const request = {
        save_id: 'test-save-id',
        user_id_hash: 'user-hash-123',
        format: 'jsonl' as const,
        include_metadata: true,
        include_audit_logs: true,
      };

      const result = await privacyOps.exportSave(request);

      expect(result.success).toBe(true);
      expect(result.export_id).toBeDefined();
      expect(result.download_url).toBeDefined();
      expect(typeof result.file_size).toBe('number');
    });

    it('should delete save data successfully', async () => {
      const request = {
        save_id: 'test-save-id',
        user_id_hash: 'user-hash-123',
        reason: 'user_request',
        redact_pii: true,
        create_tombstone: true,
      };

      const result = await privacyOps.deleteSave(request);

      expect(result.success).toBe(true);
      expect(typeof result.deleted_items).toBe('number');
      expect(result.tombstone_id).toBeDefined();
    });

    it('should get user quota information', async () => {
      const quotaInfo = await privacyOps.getUserQuota('user-hash-123');

      expect(quotaInfo.user_id_hash).toBe('user-hash-123');
      expect(typeof quotaInfo.used_bytes).toBe('number');
      expect(typeof quotaInfo.quota_bytes).toBe('number');
      expect(typeof quotaInfo.percentage_used).toBe('number');
    });

    it('should enforce retention policy', async () => {
      const result = await privacyOps.enforceRetentionPolicy();

      expect(typeof result.deleted_saves).toBe('number');
      expect(typeof result.deleted_blobs).toBe('number');
      expect(typeof result.freed_bytes).toBe('number');
    });
  });

  describe('DiffEngine', () => {
    it('should calculate diff between states', async () => {
      const oldState = { turn: 1, health: 100, mana: 50 };
      const newState = { turn: 2, health: 90, mana: 60 };

      const result = await diffEngine.calculateDiff(oldState, newState);

      expect(result.diff_hash).toBeDefined();
      expect(typeof result.diff_size).toBe('number');
      expect(typeof result.compression_ratio).toBe('number');
      expect(Array.isArray(result.patches)).toBe(true);
    });

    it('should apply diff to state', async () => {
      const state = { turn: 1, health: 100 };
      const patches = [
        { op: 'replace', path: '/health', value: 90 },
        { op: 'add', path: '/mana', value: 50 },
      ];

      const result = diffEngine.applyDiff(state, patches);

      expect(result.health).toBe(90);
      expect(result.mana).toBe(50);
    });

    it('should calculate compression statistics', () => {
      const original = Buffer.from('test data');
      const compressed = Buffer.from('test');
      const stats = diffEngine.calculateCompressionStats(original, compressed);

      expect(stats.original_size).toBe(9);
      expect(stats.compressed_size).toBe(4);
      expect(stats.ratio).toBe(2.25);
      expect(stats.algorithm).toBe('zstd');
    });
  });

  describe('AssemblerIntegration', () => {
    it('should integrate with turn completion', async () => {
      const context = {
        session_id: 'session-123',
        turn_id: 1,
        user_id_hash: 'user-hash-123',
        game_state: { test: 'state' },
        acts: [{ type: 'MOVE', data: {} }],
        timestamp: Date.now(),
      };

      const result = await assemblerIntegration.onTurnComplete(context);

      expect(result.success).toBe(true);
      expect(result.save_id).toBeDefined();
      expect(result.diff_hash).toBeDefined();
      expect(result.chain_hash).toBeDefined();
    });

    it('should integrate with WAL commit', async () => {
      const context = {
        session_id: 'session-123',
        turn_id: 1,
        user_id_hash: 'user-hash-123',
        game_state: { test: 'state' },
        acts: [{ type: 'MOVE', data: {} }],
        timestamp: Date.now(),
      };

      const result = await assemblerIntegration.onWALCommit(context);

      expect(result.success).toBe(true);
      expect(result.save_id).toBeDefined();
      expect(result.diff_hash).toBeDefined();
    });

    it('should integrate with snapshot creation', async () => {
      const context = {
        session_id: 'session-123',
        turn_id: 25,
        user_id_hash: 'user-hash-123',
        game_state: { test: 'state' },
        acts: [{ type: 'MOVE', data: {} }],
        timestamp: Date.now(),
      };

      const result = await assemblerIntegration.onSnapshotCreate(context);

      expect(result.success).toBe(true);
      expect(result.save_id).toBeDefined();
    });

    it('should get integration statistics', async () => {
      const stats = await assemblerIntegration.getIntegrationStats();

      expect(typeof stats.total_turns).toBe('number');
      expect(typeof stats.total_diffs).toBe('number');
      expect(typeof stats.total_snapshots).toBe('number');
      expect(typeof stats.avg_diff_size).toBe('number');
      expect(typeof stats.compression_ratio).toBe('number');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete sync workflow', async () => {
      // Create save
      const saveResult = await saveService.createOrAttachSave(
        'session-123',
        'user-hash-123'
      );
      expect(saveResult.success).toBe(true);

      // Persist turn
      const persistResult = await saveService.persistTurn(
        saveResult.save_id!,
        1,
        { test: 'state' }
      );
      expect(persistResult.success).toBe(true);

      // Sync up
      const syncUpResult = await syncOrchestrator.syncUp({
        device_id: 'device-123',
        session_id: 'session-123',
        user_id_hash: 'user-hash-123',
        turn_id: 1,
        state: { test: 'state' },
        sync_token: 'token-123',
      });
      expect(syncUpResult.success).toBe(true);

      // Sync down
      const syncDownResult = await syncOrchestrator.syncDown({
        device_id: 'device-123',
        session_id: 'session-123',
        user_id_hash: 'user-hash-123',
        since_turn: 0,
        sync_token: syncUpResult.sync_token,
      });
      expect(syncDownResult.success).toBe(true);
    });

    it('should handle conflict resolution', async () => {
      const branches = [
        {
          branch_id: 'server',
          turn_id: 10,
          chain_hash: 'chain-123',
          device_id: 'server',
          integrity_score: 95,
          created_at: new Date().toISOString(),
        },
        {
          branch_id: 'client',
          turn_id: 8,
          chain_hash: 'chain-456',
          device_id: 'device-123',
          integrity_score: 90,
          created_at: new Date().toISOString(),
        },
      ];

      const result = await conflictResolver.resolveConflict(
        'test-save-id',
        branches,
        'server_wins'
      );

      expect(result.conflict_id).toBeDefined();
      expect(result.resolution.chosen_branch).toBe('server');
    });

    it('should handle privacy operations', async () => {
      // Export save
      const exportResult = await privacyOps.exportSave({
        save_id: 'test-save-id',
        user_id_hash: 'user-hash-123',
        format: 'jsonl',
        include_metadata: true,
        include_audit_logs: true,
      });
      expect(exportResult.success).toBe(true);

      // Delete save
      const deleteResult = await privacyOps.deleteSave({
        save_id: 'test-save-id',
        user_id_hash: 'user-hash-123',
        reason: 'user_request',
        redact_pii: true,
        create_tombstone: true,
      });
      expect(deleteResult.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large state diffs efficiently', async () => {
      const largeState = {
        turn: 100,
        inventory: Array(1000).fill(0).map((_, i) => ({ id: i, name: `item_${i}` })),
        stats: Array(100).fill(0).map((_, i) => ({ stat: `stat_${i}`, value: Math.random() })),
      };

      const startTime = Date.now();
      const result = await diffEngine.calculateDiff({}, largeState);
      const endTime = Date.now();

      expect(result.diff_hash).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent syncs', async () => {
      const syncPromises = Array(10).fill(0).map((_, i) =>
        syncOrchestrator.syncUp({
          device_id: `device-${i}`,
          session_id: `session-${i}`,
          user_id_hash: `user-hash-${i}`,
          turn_id: i,
          state: { test: `state-${i}` },
          sync_token: `token-${i}`,
        })
      );

      const results = await Promise.all(syncPromises);
      
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.sync_token).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle save service errors gracefully', async () => {
      // Mock error response
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'Database error' } })),
          })),
        })),
      });

      const result = await saveService.createOrAttachSave('invalid-session', 'invalid-user');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle sync orchestrator errors gracefully', async () => {
      const result = await syncOrchestrator.syncUp({
        device_id: '',
        session_id: '',
        user_id_hash: '',
        turn_id: -1,
        state: null,
        sync_token: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle privacy ops errors gracefully', async () => {
      const result = await privacyOps.exportSave({
        save_id: '',
        user_id_hash: '',
        format: 'jsonl',
        include_metadata: true,
        include_audit_logs: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
