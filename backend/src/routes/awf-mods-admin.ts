/**
 * Phase 22: Admin API Routes for Mod Management
 * Handles mod pack installation, enabling, disabling, and certification
 */

import { Router } from 'express';
import { z } from 'zod';
import { ModPacksService } from '../mods/packs-service';
import { HookBus } from '../mods/hook-bus';
import { AssemblerModIntegration } from '../mods/assembler-integration';

// Schemas
const InstallModSchema = z.object({
  namespace: z.string().regex(/^[a-z0-9._-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  manifest: z.object({
    namespace: z.string(),
    version: z.string(),
    awf_core: z.string(),
    declares: z.object({
      hooks: z.array(z.string()),
      slices: z.array(z.string()),
    }),
    permissions: z.object({
      acts: z.array(z.string()),
      perTurnActsMax: z.number().int().min(0).max(10),
      requiresCertification: z.boolean(),
    }),
  }),
  hooks: z.array(z.object({
    hook_id: z.string(),
    hook_type: z.string(),
    doc: z.any(),
    priority: z.number().int().min(0).max(100).optional(),
  })),
});

const ModActionSchema = z.object({
  namespace: z.string(),
  action: z.enum(['enable', 'disable', 'certify', 'quarantine']),
  reason: z.string().optional(),
  details: z.any().optional(),
});

const ModConfigSchema = z.object({
  mods_enabled: z.boolean(),
  max_hooks_per_turn: z.number().int().min(1).max(50),
  max_acts_per_turn: z.number().int().min(1).max(20),
  max_namespace_tokens: z.number().int().min(10).max(200),
  max_global_tokens: z.number().int().min(50).max(500),
  max_eval_ms: z.number().int().min(1).max(100),
  quarantine_threshold: z.number().int().min(1).max(20),
  cert_required: z.boolean(),
});

export function createModsAdminRouter(
  supabase: any,
  modPacksService: ModPacksService,
  hookBus: HookBus,
  assemblerIntegration: AssemblerModIntegration
): Router {
  const router = Router();

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

  // Install mod pack
  router.post('/install', requireAdmin, async (req, res) => {
    try {
      const validation = InstallModSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid request data',
          details: validation.error.message,
        });
      }

      const { namespace, version, manifest, hooks } = validation.data;
      
      // Check if mod already exists
      const { data: existing } = await supabase
        .from('mod_packs')
        .select('namespace')
        .eq('namespace', namespace)
        .single();

      if (existing) {
        return res.status(409).json({
          ok: false,
          error: 'Mod pack already exists',
        });
      }

      // Install mod pack
      const result = await modPacksService.installModPack(
        Buffer.from(JSON.stringify({ manifest, hooks })),
        req.user.id
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
          namespace: result.namespace,
          message: 'Mod pack installed successfully',
        },
      });

    } catch (error) {
      console.error('Install mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to install mod pack',
      });
    }
  });

  // Enable mod pack
  router.post('/enable', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.body;
      
      if (!namespace) {
        return res.status(400).json({
          ok: false,
          error: 'Namespace required',
        });
      }

      const result = await modPacksService.enableModPack(namespace, req.user.id);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          namespace,
          message: 'Mod pack enabled successfully',
        },
      });

    } catch (error) {
      console.error('Enable mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to enable mod pack',
      });
    }
  });

  // Disable mod pack
  router.post('/disable', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.body;
      
      if (!namespace) {
        return res.status(400).json({
          ok: false,
          error: 'Namespace required',
        });
      }

      const result = await modPacksService.disableModPack(namespace, req.user.id);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          namespace,
          message: 'Mod pack disabled successfully',
        },
      });

    } catch (error) {
      console.error('Disable mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to disable mod pack',
      });
    }
  });

  // Certify mod pack
  router.post('/certify', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.body;
      
      if (!namespace) {
        return res.status(400).json({
          ok: false,
          error: 'Namespace required',
        });
      }

      const result = await modPacksService.certifyModPack(namespace, req.user.id);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.error,
        });
      }

      res.json({
        ok: true,
        data: {
          namespace,
          message: 'Mod pack certified successfully',
        },
      });

    } catch (error) {
      console.error('Certify mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to certify mod pack',
      });
    }
  });

  // Quarantine mod pack
  router.post('/quarantine', requireAdmin, async (req, res) => {
    try {
      const { namespace, reason, details } = req.body;
      
      if (!namespace || !reason) {
        return res.status(400).json({
          ok: false,
          error: 'Namespace and reason required',
        });
      }

      const result = await modPacksService.quarantineModPack(
        namespace,
        reason,
        details || {},
        req.user.id
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
          namespace,
          message: 'Mod pack quarantined successfully',
        },
      });

    } catch (error) {
      console.error('Quarantine mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to quarantine mod pack',
      });
    }
  });

  // List mod packs
  router.get('/packs', requireAdmin, async (req, res) => {
    try {
      const { data: packs, error } = await supabase
        .from('mod_packs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get mod packs',
        });
      }

      res.json({
        ok: true,
        data: packs,
      });

    } catch (error) {
      console.error('List mod packs error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to list mod packs',
      });
    }
  });

  // Get mod pack details
  router.get('/packs/:namespace', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.params;
      
      const { data: pack, error: packError } = await supabase
        .from('mod_packs')
        .select('*')
        .eq('namespace', namespace)
        .single();

      if (packError) {
        return res.status(404).json({
          ok: false,
          error: 'Mod pack not found',
        });
      }

      const { data: hooks, error: hooksError } = await supabase
        .from('mod_hooks')
        .select('*')
        .eq('namespace', namespace);

      if (hooksError) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get mod hooks',
        });
      }

      res.json({
        ok: true,
        data: {
          pack,
          hooks,
        },
      });

    } catch (error) {
      console.error('Get mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get mod pack',
      });
    }
  });

  // Get mod metrics
  router.get('/metrics/:namespace', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.params;
      const { days = 7 } = req.query;
      
      const { data: metrics, error } = await supabase
        .from('mod_metrics')
        .select('*')
        .eq('namespace', namespace)
        .gte('timestamp', new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get mod metrics',
        });
      }

      res.json({
        ok: true,
        data: metrics,
      });

    } catch (error) {
      console.error('Get mod metrics error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get mod metrics',
      });
    }
  });

  // Update mod configuration
  router.put('/config', requireAdmin, async (req, res) => {
    try {
      const validation = ModConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid configuration data',
          details: validation.error.message,
        });
      }

      const { data, error } = await supabase
        .from('mod_config')
        .update(validation.data)
        .eq('id', 'default')
        .select()
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to update mod configuration',
        });
      }

      res.json({
        ok: true,
        data,
      });

    } catch (error) {
      console.error('Update mod config error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to update mod configuration',
      });
    }
  });

  // Get mod configuration
  router.get('/config', requireAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('mod_config')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        return res.status(500).json({
          ok: false,
          error: 'Failed to get mod configuration',
        });
      }

      res.json({
        ok: true,
        data,
      });

    } catch (error) {
      console.error('Get mod config error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get mod configuration',
      });
    }
  });

  // Validate mod pack
  router.post('/validate/:namespace', requireAdmin, async (req, res) => {
    try {
      const { namespace } = req.params;
      
      const result = await modPacksService.validateModPack(namespace);

      res.json({
        ok: true,
        data: result,
      });

    } catch (error) {
      console.error('Validate mod pack error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to validate mod pack',
      });
    }
  });

  // Get hook bus metrics
  router.get('/hooks/metrics', requireAdmin, async (req, res) => {
    try {
      const metrics = hookBus.getMetrics();

      res.json({
        ok: true,
        data: Array.from(metrics.values()),
      });

    } catch (error) {
      console.error('Get hook metrics error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to get hook metrics',
      });
    }
  });

  // Clear hook metrics
  router.post('/hooks/clear-metrics', requireAdmin, async (req, res) => {
    try {
      hookBus.clearMetrics();

      res.json({
        ok: true,
        data: {
          message: 'Hook metrics cleared successfully',
        },
      });

    } catch (error) {
      console.error('Clear hook metrics error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to clear hook metrics',
      });
    }
  });

  return router;
}
