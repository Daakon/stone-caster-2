// Phase 28: LiveOps Remote Configuration System
// Admin API for config management with audit logging

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { 
  LiveOpsConfigSchema, 
  validateLiveOpsConfig, 
  checkConfigBounds,
  createDefaultLiveOpsConfig 
} from '../liveops/levers-schema';
import { 
  LiveOpsConfigResolver, 
  createLiveOpsConfigResolver,
  evaluateConfigInShadowMode 
} from '../liveops/config-resolver';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize config resolver
const configResolver = createLiveOpsConfigResolver(supabaseUrl, supabaseKey);

// Middleware for admin authentication
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

// Validation schemas
const CreateConfigSchema = z.object({
  name: z.string().min(1).max(100),
  scope: z.enum(['global', 'world', 'adventure', 'experiment', 'session']),
  scope_ref: z.string().min(1),
  payload: z.record(z.any()),
  valid_from: z.string().datetime().optional(),
  valid_to: z.string().datetime().optional()
});

const UpdateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  payload: z.record(z.any()).optional(),
  valid_from: z.string().datetime().optional(),
  valid_to: z.string().datetime().optional()
});

const ResolvePreviewSchema = z.object({
  session_id: z.string(),
  world_id: z.string().optional(),
  adventure_id: z.string().optional(),
  experiment_id: z.string().optional(),
  variation: z.string().optional()
});

// POST /configs - Create new config
router.post('/configs', async (req: Request, res: Response) => {
  try {
    const validation = CreateConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }

    const { name, scope, scope_ref, payload, valid_from, valid_to } = validation.data;

    // Validate config payload
    const configValidation = validateLiveOpsConfig(payload);
    if (!configValidation.success) {
      return res.status(400).json({ 
        error: 'Invalid config payload', 
        details: configValidation.error 
      });
    }

    // Check bounds
    const boundsCheck = checkConfigBounds(configValidation.data!);
    if (!boundsCheck.valid) {
      return res.status(400).json({ 
        error: 'Config bounds violation', 
        violations: boundsCheck.violations 
      });
    }

    // Check for global freeze
    const isFrozen = await configResolver.isGlobalFreezeActive();
    if (isFrozen) {
      return res.status(423).json({ error: 'LiveOps is globally frozen' });
    }

    // Create config
    const { data, error } = await supabase
      .from('liveops_configs')
      .insert({
        name,
        scope,
        scope_ref,
        payload,
        valid_from: valid_from ? new Date(valid_from) : null,
        valid_to: valid_to ? new Date(valid_to) : null,
        created_by: req.user!.id
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create config', details: error.message });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /configs - List configs with filtering
router.get('/configs', async (req: Request, res: Response) => {
  try {
    const { scope, scope_ref, status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('liveops_configs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset as number, (offset as number) + (limit as number) - 1);

    if (scope) query = query.eq('scope', scope);
    if (scope_ref) query = query.eq('scope_ref', scope_ref);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch configs', details: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /configs/:id - Get specific config
router.get('/configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('liveops_configs')
      .select('*')
      .eq('config_id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PUT /configs/:id - Update config
router.put('/configs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = UpdateConfigSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body', 
        details: validation.error.errors 
      });
    }

    const { name, payload, valid_from, valid_to } = validation.data;

    // Validate payload if provided
    if (payload) {
      const configValidation = validateLiveOpsConfig(payload);
      if (!configValidation.success) {
        return res.status(400).json({ 
          error: 'Invalid config payload', 
          details: configValidation.error 
        });
      }

      const boundsCheck = checkConfigBounds(configValidation.data!);
      if (!boundsCheck.valid) {
        return res.status(400).json({ 
          error: 'Config bounds violation', 
          violations: boundsCheck.violations 
        });
      }
    }

    // Check for global freeze
    const isFrozen = await configResolver.isGlobalFreezeActive();
    if (isFrozen) {
      return res.status(423).json({ error: 'LiveOps is globally frozen' });
    }

    // Update config
    const updateData: any = { updated_at: new Date() };
    if (name) updateData.name = name;
    if (payload) updateData.payload = payload;
    if (valid_from !== undefined) updateData.valid_from = valid_from ? new Date(valid_from) : null;
    if (valid_to !== undefined) updateData.valid_to = valid_to ? new Date(valid_to) : null;

    const { data, error } = await supabase
      .from('liveops_configs')
      .update(updateData)
      .eq('config_id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update config', details: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /configs/:id/activate - Activate config
router.post('/configs/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { immediate = false } = req.body;

    // Check for global freeze
    const isFrozen = await configResolver.isGlobalFreezeActive();
    if (isFrozen) {
      return res.status(423).json({ error: 'LiveOps is globally frozen' });
    }

    const updateData: any = { 
      status: 'active',
      updated_at: new Date()
    };

    if (immediate) {
      updateData.valid_from = new Date();
    }

    const { data, error } = await supabase
      .from('liveops_configs')
      .update(updateData)
      .eq('config_id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to activate config', details: error.message });
    }

    // Clear relevant cache
    configResolver.clearAllCache();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /configs/:id/archive - Archive config
router.post('/configs/:id/archive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('liveops_configs')
      .update({ 
        status: 'archived',
        updated_at: new Date()
      })
      .eq('config_id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to archive config', details: error.message });
    }

    // Clear relevant cache
    configResolver.clearAllCache();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /configs/:id/rollback - Rollback config
router.post('/configs/:id/rollback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get current config
    const { data: currentConfig, error: fetchError } = await supabase
      .from('liveops_configs')
      .select('*')
      .eq('config_id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // Get previous version from audit
    const { data: auditData, error: auditError } = await supabase
      .from('liveops_audit')
      .select('diff')
      .eq('config_id', id)
      .eq('action', 'update')
      .order('ts', { ascending: false })
      .limit(1);

    if (auditError || !auditData.length) {
      return res.status(404).json({ error: 'No previous version found' });
    }

    const previousPayload = auditData[0].diff.old.payload;

    // Create rollback config
    const { data, error } = await supabase
      .from('liveops_configs')
      .insert({
        name: `${currentConfig.name} (Rollback)`,
        scope: currentConfig.scope,
        scope_ref: currentConfig.scope_ref,
        payload: previousPayload,
        status: 'active',
        created_by: req.user!.id
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create rollback config', details: error.message });
    }

    // Clear relevant cache
    configResolver.clearAllCache();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /resolve/preview - Preview resolved config
router.get('/resolve/preview', async (req: Request, res: Response) => {
  try {
    const validation = ResolvePreviewSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid query parameters', 
        details: validation.error.errors 
      });
    }

    const { session_id, world_id, adventure_id, experiment_id, variation } = validation.data;

    const context = {
      sessionId: session_id,
      worldId: world_id,
      adventureId: adventure_id,
      experimentId: experiment_id,
      variation
    };

    const resolved = await configResolver.previewConfig(context);

    res.json({ success: true, data: resolved });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /snapshots - Get config snapshots
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const { session_id, limit = 10 } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const snapshots = await configResolver.getLatestSnapshots(session_id as string, limit as number);

    res.json({ success: true, data: snapshots });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /dry-run - Dry run impact estimation
router.post('/dry-run', async (req: Request, res: Response) => {
  try {
    const { context, proposed_config } = req.body;

    if (!context || !proposed_config) {
      return res.status(400).json({ error: 'context and proposed_config are required' });
    }

    const shadowResult = await evaluateConfigInShadowMode(
      configResolver,
      context,
      proposed_config
    );

    res.json({ success: true, data: shadowResult });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /configs/:id/history - Get config history
router.get('/configs/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await configResolver.getConfigHistory(id);

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /cache/stats - Get cache statistics
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = configResolver.getCacheStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /cache/clear - Clear cache
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    const { context } = req.body;

    if (context) {
      configResolver.clearCache(context);
    } else {
      configResolver.clearAllCache();
    }

    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /status - Get LiveOps status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isFrozen = await configResolver.isGlobalFreezeActive();
    const cacheStats = configResolver.getCacheStats();

    res.json({ 
      success: true, 
      data: { 
        frozen: isFrozen,
        cache: cacheStats
      } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
