/**
 * Phase 23: Cloud Sync Admin API Routes
 * Handles cloud save/sync endpoints with RBAC and audit logging
 */

import { Router } from 'express';
import { z } from 'zod';
import { SaveService } from '../saves/save-service';
import { SyncOrchestrator } from '../saves/sync-orchestrator';
import { ConflictResolver } from '../saves/conflict-resolver';
import { PrivacyOps } from '../saves/privacy-ops';
import { DiffEngine } from '../saves/diff-engine';

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

const MaterializeSchema = z.object({
  save_id: z.string().uuid(),
  target_turn: z.number().int().min(0).optional(),
});

const ExportSchema = z.object({
  save_id: z.string().uuid(),
  user_id_hash: z.string(),
  format: z.enum(['jsonl', 'json', 'zip']).default('jsonl'),
  include_metadata: z.boolean().default(true),
  include_audit_logs: z.boolean().default(true),
});

const DeleteSchema = z.object({
  save_id: z.string().uuid(),
  user_id_hash: z.string(),
  reason: z.string(),
  redact_pii: z.boolean().default(true),
  create_tombstone: z.boolean().default(true),
});

const RestoreSchema = z.object({
  save_id: z.string().uuid(),
  target_turn: z.number().int().min(0).optional(),
  snapshot_hash: z.string().optional(),
});

export function createCloudSyncRouter(
  supabase: any,
  saveService: SaveService,
  syncOrchestrator: SyncOrchestrator,
  conflictResolver: ConflictResolver,
  privacyOps: PrivacyOps,
  diffEngine: DiffEngine
): Router {
  const router = Router();

  // Middleware to check user authentication
  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          ok: false,
          error: 'Authentication required',
        });
      }
      next();
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: 'Authentication check failed',
      });
    }
  };

  // Middleware to check admin role
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('auth_user_id', req.user?.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return res.status(403).json({
          ok: false,
          error: 'Admin role required',
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to check admin role',
      });
    }
  };

  // Sync up (device → server)
  router.post('/sync/up', requireAuth, async (req, res) => {
    try {
      const validation = SyncUpSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const result = await syncOrchestrator.syncUp(validation.data);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          sync_token: result.sync_token,
          conflict_detected: result.conflict_detected,
          conflict_report: result.conflict_report,
        },
      });

    } catch (error) {
      console.error('Sync up error:', error);
      res.status(500).json({
        ok: false,
        error: 'Sync up failed',
      });
    }
  });

  // Sync down (server → device)
  router.get('/sync/down', requireAuth, async (req, res) => {
    try {
      const validation = SyncDownSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const result = await syncOrchestrator.syncDown(validation.data);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          turns: result.turns,
          latest_turn: result.latest_turn,
          sync_token: result.sync_token,
        },
      });

    } catch (error) {
      console.error('Sync down error:', error);
      res.status(500).json({
        ok: false,
        error: 'Sync down failed',
      });
    }
  });

  // Materialize save to specific turn
  router.post('/save/materialize', requireAuth, async (req, res) => {
    try {
      const validation = MaterializeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const result = await saveService.materialize(
        validation.data.save_id,
        validation.data.target_turn
      );

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          state: result.state,
          turn_id: result.turn_id,
        },
      });

    } catch (error) {
      console.error('Materialize error:', error);
      res.status(500).json({
        ok: false,
        error: 'Materialize failed',
      });
    }
  });

  // Verify save integrity
  router.post('/save/verify', requireAuth, async (req, res) => {
    try {
      const { save_id } = req.body;
      
      if (!save_id) {
        return res.status(400).json({
          ok: false,
          error: 'Save ID required',
        });
      }

      const result = await saveService.verify(save_id);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          integrity_ok: result.integrity_ok,
        },
      });

    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({
        ok: false,
        error: 'Verify failed',
      });
    }
  });

  // Export save data
  router.post('/save/export', requireAuth, async (req, res) => {
    try {
      const validation = ExportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const result = await privacyOps.exportSave(validation.data);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          export_id: result.export_id,
          download_url: result.download_url,
          file_size: result.file_size,
        },
      });

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        ok: false,
        error: 'Export failed',
      });
    }
  });

  // Delete save data
  router.delete('/save', requireAuth, async (req, res) => {
    try {
      const validation = DeleteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const result = await privacyOps.deleteSave(validation.data);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          deleted_items: result.deleted_items,
          tombstone_id: result.tombstone_id,
        },
      });

    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        ok: false,
        error: 'Delete failed',
      });
    }
  });

  // Restore save to specific turn or snapshot
  router.post('/save/restore', requireAuth, async (req, res) => {
    try {
      const validation = RestoreSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const { save_id, target_turn, snapshot_hash } = validation.data;

      // Materialize to target turn
      const result = await saveService.materialize(save_id, target_turn);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          state: result.state,
          turn_id: result.turn_id,
          restored_to: target_turn || 'latest',
        },
      });

    } catch (error) {
      console.error('Restore error:', error);
      res.status(500).json({
        ok: false,
        error: 'Restore failed',
      });
    }
  });

  // Get conflicts (admin only)
  router.get('/save/conflicts', requireAdmin, async (req, res) => {
    try {
      const { data: conflicts, error } = await supabase
        .from('awf_save_archives')
        .select('*')
        .eq('reason', 'conflict')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get conflicts',
        });
      }

      res.json({
        ok: true,
        data: conflicts,
      });

    } catch (error) {
      console.error('Get conflicts error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get conflicts',
      });
    }
  });

  // Get sync statistics (admin only)
  router.get('/save/stats', requireAdmin, async (req, res) => {
    try {
      const syncStats = await syncOrchestrator.getSyncStats();
      const conflictStats = await conflictResolver.getConflictStats();

      res.json({
        ok: true,
        data: {
          sync: syncStats,
          conflicts: conflictStats,
        },
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get statistics',
      });
    }
  });

  // Get user quota
  router.get('/quota/:user_id_hash', requireAuth, async (req, res) => {
    try {
      const { user_id_hash } = req.params;
      
      const quotaInfo = await privacyOps.getUserQuota(user_id_hash);

      res.json({
        ok: true,
        data: quotaInfo,
      });

    } catch (error) {
      console.error('Get quota error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get quota information',
      });
    }
  });

  // Enforce retention policy (admin only)
  router.post('/admin/retention', requireAdmin, async (req, res) => {
    try {
      const result = await privacyOps.enforceRetentionPolicy();

      res.json({
        ok: true,
        data: result,
      });

    } catch (error) {
      console.error('Retention enforcement error:', error);
      res.status(500).json({
        ok: false,
        error: 'Retention enforcement failed',
      });
    }
  });

  // Get save details (admin only)
  router.get('/admin/save/:save_id', requireAdmin, async (req, res) => {
    try {
      const { save_id } = req.params;
      
      const { data: save, error: saveError } = await supabase
        .from('awf_saves')
        .select('*')
        .eq('save_id', save_id)
        .single();

      if (saveError) {
        return res.status(404).json({
          ok: false,
          error: 'Save not found',
        });
      }

      const { data: diffs } = await supabase
        .from('awf_save_diffs')
        .select('*')
        .eq('save_id', save_id)
        .order('to_turn');

      const { data: archives } = await supabase
        .from('awf_save_archives')
        .select('*')
        .eq('save_id', save_id);

      res.json({
        ok: true,
        data: {
          save,
          diffs,
          archives,
        },
      });

    } catch (error) {
      console.error('Get save details error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get save details',
      });
    }
  });

  // Get device info (admin only)
  router.get('/admin/device/:device_id', requireAdmin, async (req, res) => {
    try {
      const { device_id } = req.params;
      
      const { data: device, error } = await supabase
        .from('awf_devices')
        .select('*')
        .eq('device_id', device_id)
        .single();

      if (error) {
        return res.status(404).json({
          ok: false,
          error: 'Device not found',
        });
      }

      res.json({
        ok: true,
        data: device,
      });

    } catch (error) {
      console.error('Get device info error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get device information',
      });
    }
  });

  // Get audit logs (admin only)
  router.get('/admin/audit', requireAdmin, async (req, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;
      
      const { data: auditLogs, error } = await supabase
        .from('awf_sync_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get audit logs',
        });
      }

      res.json({
        ok: true,
        data: auditLogs,
      });

    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get audit logs',
      });
    }
  });

  return router;
}
