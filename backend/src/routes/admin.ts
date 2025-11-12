/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrative API endpoints for content management
 */

import { Router } from 'express';
import budgetRouter from './admin-budget.js';
import telemetryRouter from './admin-telemetry.js';
import healthRouter from './admin-health.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { requireRole } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { IdParamSchema } from '@shared';
import { 
  WorldDocSchema, 
  AdventureDocSchema, 
  AdventureStartDocSchema 
} from '../validators/awf-validators.js';
import { CoreContractV2Schema } from '../validators/awf-core-contract.schema.js';
import { CoreRulesetV1Schema } from '../validators/awf-ruleset.schema.js';
import { NPCDocV1Schema } from '../validators/awf-npc.schema.js';
import { ScenarioDocV1Schema } from '../validators/awf-scenario.schema.js';
import { 
  InjectionMapDocV1Schema, 
  DryRunRequestSchema, 
  BundleDiffRequestSchema 
} from '../validators/awf-injection-map.schema.js';
import { computeDocumentHash } from '../utils/awf-hashing.js';

const router = Router();

// Mount budget report routes
router.use(budgetRouter);

// Mount telemetry routes
router.use('/telemetry', telemetryRouter);

// Mount health routes
router.use(healthRouter);

type PromptRecord = {
  content?: string | null;
  metadata?: unknown;
  [key: string]: unknown;
};

const estimateTokenCount = (content: string): number => {
  if (!content) {
    return 0;
  }
  const normalizedContent = content.trim();
  if (normalizedContent.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalizedContent.length / 4));
};

const normalizePromptRecord = <T extends PromptRecord>(record: T): T & { tokenCount: number; metadata: Record<string, unknown> } => {
  const content = typeof record.content === 'string' ? record.content : record.content ?? '';
  const tokenCount = estimateTokenCount(content);

  let parsedMetadata: Record<string, unknown> = {};
  if (typeof record.metadata === 'string') {
    try {
      parsedMetadata = record.metadata.length > 0 ? JSON.parse(record.metadata) : {};
    } catch (error) {
      console.warn('[ADMIN] Failed to parse prompt metadata string, returning empty object', { error });
      parsedMetadata = {};
    }
  } else if (record.metadata && typeof record.metadata === 'object') {
    parsedMetadata = record.metadata as Record<string, unknown>;
  }

  return {
    ...record,
    metadata: parsedMetadata,
    tokenCount,
  };
};

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin role check middleware
const requireAdminRole = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has admin role
    const { data: userData, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const role = userData.user?.user_metadata?.role;
    if (role !== 'prompt_admin') {
      return res.status(403).json({ error: 'Admin role required' });
    }

    next();
  } catch (error) {
    console.error('Admin role check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const LayerSchema = z.string()
  .trim()
  .min(1, 'Layer is required')
  .regex(/^[a-z0-9_-]+$/i, 'Layer must use letters, numbers, underscores, or hyphens')
  .transform((value) => value.toLowerCase());

// Schema for prompt creation/update
// Note: This is for the legacy prompting.prompts table (see docs/prompt-system/LEGACY_SYSTEMS.md)
const PromptSchemaBase = z.object({
  layer: LayerSchema,
  world_slug: z.string().nullable().optional(),
  adventure_slug: z.string().nullable().optional(),
  scene_id: z.string().nullable().optional(),
  turn_stage: z.enum(['any', 'start', 'ongoing', 'end']).default('any'),
  sort_order: z.number().int().min(0).default(0),
  version: z.union([z.string(), z.number(), z.null()]).transform(val => val === null ? '1.0.0' : String(val)).default('1.0.0'),
  content: z.string().min(1),
  metadata: z.record(z.any()).default({}),
  active: z.boolean().default(true),
  locked: z.boolean().default(false)
});

const PromptSchema = PromptSchemaBase;
const UpdatePromptSchema = PromptSchemaBase.partial();

// Get all prompts with filtering
/**
 * @swagger
 * /api/admin/prompts:
 *   get:
 *     summary: Get all prompts with filtering
 *     description: Retrieves all prompts with optional filtering by layer, world, adventure, status, and search
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: layer
 *         schema:
 *           type: string
 *           enum: [core, world, adventure, entry, npc]
 *         description: Filter by prompt layer
 *         example: world
 *       - in: query
 *         name: world_slug
 *         schema:
 *           type: string
 *         description: Filter by world slug
 *         example: mystika
 *       - in: query
 *         name: adventure_slug
 *         schema:
 *           type: string
 *         description: Filter by adventure slug
 *         example: the-crystal-quest
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *       - in: query
 *         name: locked
 *         schema:
 *           type: boolean
 *         description: Filter by locked status
 *         example: false
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in content, layer, and world_slug fields
 *         example: crystal
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of prompts
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           layer:
 *                             type: string
 *                             enum: [core, world, adventure, entry, npc]
 *                           content:
 *                             type: string
 *                           world_slug:
 *                             type: string
 *                             nullable: true
 *                           adventure_slug:
 *                             type: string
 *                             nullable: true
 *                           active:
 *                             type: boolean
 *                           locked:
 *                             type: boolean
 *                           sort_order:
 *                             type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/prompts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { 
      layer, 
      world_slug, 
      adventure_slug, 
      active, 
      locked,
      search,
      page = 1,
      limit = 50
    } = req.query;

    let query = supabase
      .from('prompting.prompts')
      .select('*')
      .order('layer', { ascending: true })
      .order('sort_order', { ascending: true });

    // Apply filters
    if (layer) {
      const layerValue = Array.isArray(layer) ? layer[0] : layer;
      const parsedLayer = LayerSchema.safeParse(layerValue);
      if (!parsedLayer.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid layer filter',
          details: parsedLayer.error.format()
        });
      }
      query = query.eq('layer', parsedLayer.data);
    }
    if (world_slug) query = query.eq('world_slug', world_slug);
    if (adventure_slug) query = query.eq('adventure_slug', adventure_slug);
    if (active !== undefined) query = query.eq('active', active === 'true');
    if (locked !== undefined) query = query.eq('locked', locked === 'true');

    // Apply search
    if (search) {
      query = query.or(`content.ilike.%${search}%,layer.ilike.%${search}%,world_slug.ilike.%${search}%`);
    }

    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    query = query.range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: (data || []).map(normalizePromptRecord),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get prompt by ID
/**
 * @swagger
 * /api/admin/prompts/{id}:
 *   get:
 *     summary: Get prompt by ID
 *     description: Retrieves a specific prompt by its UUID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The prompt UUID
 *         example: 123e4567-e89b-12d3-a456-426614174000
 *     responses:
 *       200:
 *         description: Prompt retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Prompt'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Prompt not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/prompts/:id([0-9a-fA-F-]{36})',
  authenticateToken,
  requireAdminRole,
  validateRequest(IdParamSchema, 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('prompting.prompts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            ok: false,
            error: 'Prompt not found'
          });
        }
        throw error;
      }

      res.json({
        ok: true,
        data: normalizePromptRecord(data)
      });
    } catch (error) {
      console.error('Error fetching prompt:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Create new prompt
/**
 * @swagger
 * /api/admin/prompts:
 *   post:
 *     summary: Create a new prompt
 *     description: Creates a new prompt with the specified content and metadata
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [layer, content]
 *             properties:
 *               layer:
 *                 type: string
 *                 enum: [core, world, adventure, entry, npc]
 *                 description: The layer this prompt belongs to
 *                 example: world
 *               content:
 *                 type: string
 *                 description: The prompt content
 *                 example: "You are a fantasy world with magical crystals..."
 *               world_slug:
 *                 type: string
 *                 nullable: true
 *                 description: World slug if this is a world-specific prompt
 *                 example: mystika
 *               adventure_slug:
 *                 type: string
 *                 nullable: true
 *                 description: Adventure slug if this is an adventure-specific prompt
 *                 example: the-crystal-quest
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the prompt
 *                 example: {"version": "1.0", "tags": ["magic", "crystals"]}
 *               sort_order:
 *                 type: integer
 *                 description: Sort order for display
 *                 example: 1
 *               active:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the prompt is active
 *               locked:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the prompt is locked from editing
 *     responses:
 *       201:
 *         description: Prompt created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         layer:
 *                           type: string
 *                         content:
 *                           type: string
 *                         world_slug:
 *                           type: string
 *                           nullable: true
 *                         adventure_slug:
 *                           type: string
 *                           nullable: true
 *                         metadata:
 *                           type: object
 *                         sort_order:
 *                           type: integer
 *                         active:
 *                           type: boolean
 *                         locked:
 *                           type: boolean
 *                         tokenCount:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/prompts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const validatedData = PromptSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Minify JSON in metadata for storage
    const minifiedMetadata = JSON.stringify(validatedData.metadata);

    const { data, error } = await supabase
      .from('prompting.prompts')
      .insert({
        ...validatedData,
        metadata: minifiedMetadata,
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      ok: true,
      data: normalizePromptRecord(data)
    });
  } catch (error) {
    console.error('Error creating prompt:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Failed to create prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update prompt
router.put(
  '/prompts/:id([0-9a-fA-F-]{36})',
  authenticateToken,
  requireAdminRole,
  validateRequest(IdParamSchema, 'params'),
  async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Update prompt request body:', JSON.stringify(req.body, null, 2));

      const validatedData = UpdatePromptSchema.parse(req.body);
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if prompt exists and is not locked
      const { data: existingPrompt, error: fetchError } = await supabase
        .from('prompting.prompts')
        .select('locked')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return res.status(404).json({
            ok: false,
            error: 'Prompt not found'
          });
        }
        throw fetchError;
      }

      if (existingPrompt.locked) {
        return res.status(403).json({
          ok: false,
          error: 'Cannot update locked prompt'
        });
      }

      // Minify JSON in metadata for storage if provided
      const updateData: Record<string, unknown> = { ...validatedData };
      if (validatedData.metadata) {
        updateData.metadata = JSON.stringify(validatedData.metadata);
      }

      const { data, error } = await supabase
        .from('prompting.prompts')
        .update({
          ...updateData,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data
      });
    } catch (error) {
      console.error('Error updating prompt:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          ok: false,
          error: 'Validation error',
          details: error.errors
        });
      }

      res.status(500).json({
        ok: false,
        error: 'Failed to update prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Delete prompt
router.delete('/prompts/:id([0-9a-fA-F-]{36})', authenticateToken, requireAdminRole, validateRequest(IdParamSchema, 'params'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if prompt exists and is not locked
    const { data: existingPrompt, error: fetchError } = await supabase
      .from('prompting.prompts')
      .select('locked')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Prompt not found'
        });
      }
      throw fetchError;
    }

    if (existingPrompt.locked) {
      return res.status(403).json({
        ok: false,
        error: 'Cannot delete locked prompt'
      });
    }

    const { error } = await supabase
      .from('prompting.prompts')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Prompt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Toggle prompt active status
router.patch('/prompts/:id([0-9a-fA-F-]{36})/toggle-active', authenticateToken, requireAdminRole, validateRequest(IdParamSchema, 'params'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get current status
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('prompting.prompts')
      .select('active, locked')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Prompt not found'
        });
      }
      throw fetchError;
    }

    if (currentPrompt.locked) {
      return res.status(403).json({
        ok: false,
        error: 'Cannot modify locked prompt'
      });
    }

    const { data, error } = await supabase
      .from('prompting.prompts')
      .update({
        active: !currentPrompt.active,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: normalizePromptRecord(data)
    });
  } catch (error) {
    console.error('Error toggling prompt active status:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to toggle prompt status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Toggle prompt locked status
router.patch('/prompts/:id([0-9a-fA-F-]{36})/toggle-locked', authenticateToken, requireAdminRole, validateRequest(IdParamSchema, 'params'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get current status
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('prompting.prompts')
      .select('locked')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Prompt not found'
        });
      }
      throw fetchError;
    }

    const { data, error } = await supabase
      .from('prompting.prompts')
      .update({
        locked: !currentPrompt.locked,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: normalizePromptRecord(data)
    });
  } catch (error) {
    console.error('Error toggling prompt locked status:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to toggle prompt lock status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get prompt statistics
router.get('/prompts/stats', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_prompt_stats');

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data?.[0] || null
    });
  } catch (error) {
    console.error('Error fetching prompt stats:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch prompt statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validate prompt dependencies
router.get('/prompts/validate-dependencies', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('validate_prompt_dependencies');

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error validating dependencies:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to validate dependencies',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk operations
router.post('/prompts/bulk', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { action, promptIds } = req.body;

    if (!action || !Array.isArray(promptIds) || promptIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid bulk operation parameters'
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }
    let updateData: any = { updated_by: userId, updated_at: new Date().toISOString() };

    switch (action) {
      case 'activate':
        updateData.active = true;
        break;
      case 'deactivate':
        updateData.active = false;
        break;
      case 'lock':
        updateData.locked = true;
        break;
      case 'unlock':
        updateData.locked = false;
        break;
      default:
        return res.status(400).json({
          ok: false,
          error: 'Invalid bulk action'
        });
    }

    const { data, error } = await supabase
      .from('prompting.prompts')
      .update(updateData)
      .in('id', promptIds)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: (data || []).map(normalizePromptRecord),
      message: `Bulk ${action} completed successfully`
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to perform bulk operation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AWF Document Routes
// Core Contracts
router.get('/awf/core-contracts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('core_contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching core contracts:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch core contracts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/core-contracts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, doc, active } = req.body;

    // Validate required fields
    if (!id || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    }

    // Validate document using CoreContractV2Schema
    try {
      CoreContractV2Schema.parse(doc);
    } catch (validationError) {
      let details: string | any[] = 'Invalid document structure';
      if (validationError instanceof Error) {
        try {
          // Try to parse Zod error details
          const zodError = JSON.parse(validationError.message);
          if (Array.isArray(zodError)) {
            details = zodError;
          } else {
            details = validationError.message;
          }
        } catch {
          details = validationError.message;
        }
      }
      
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: Array.isArray(details) ? details : [details]
      });
    }

    // Compute hash using Phase 1 hashing utility
    const hash = computeDocumentHash(doc);

    const { data, error } = await supabase
      .from('core_contracts')
      .upsert({
        id,
        version,
        doc: doc,
        hash,
        active: active || false
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating core contract:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save core contract',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.patch('/awf/core-contracts/:id/:version/activate', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    // First, deactivate all versions of this contract
    await supabase
      .from('core_contracts')
      .update({ active: false })
      .eq('id', id);

    // Then activate the specified version
    const { data, error } = await supabase
      .from('core_contracts')
      .update({ active: true })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error activating core contract:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to activate core contract',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Core Rulesets
router.get('/awf/core-rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('core_rulesets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching core rulesets:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch core rulesets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/core-rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, doc, active } = req.body;

    // Validate required fields
    if (!id || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    }

    // Validate document using CoreRulesetV1Schema
    try {
      CoreRulesetV1Schema.parse(doc);
    } catch (validationError) {
      let details: string | any[] = 'Invalid document structure';
      if (validationError instanceof Error) {
        try {
          // Try to parse Zod error details
          const zodError = JSON.parse(validationError.message);
          if (Array.isArray(zodError)) {
            details = zodError;
          } else {
            details = validationError.message;
          }
        } catch {
          details = validationError.message;
        }
      }
      
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: Array.isArray(details) ? details : [details]
      });
    }

    // Compute hash using Phase 1 hashing utility
    const hash = computeDocumentHash(doc);

    const { data, error } = await supabase
      .from('core_rulesets')
      .upsert({
        id,
        version,
        doc: doc,
        hash,
        active: active || false
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating core ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save core ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.patch('/awf/core-rulesets/:id/:version/activate', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    // First, deactivate all versions of this ruleset
    await supabase
      .from('core_rulesets')
      .update({ active: false })
      .eq('id', id);

    // Then activate the specified version
    const { data, error } = await supabase
      .from('core_rulesets')
      .update({ active: true })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error activating core ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to activate core ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Worlds
router.get('/awf/worlds', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching worlds:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch worlds',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/worlds', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, doc } = req.body;

    // Validate required fields
    if (!id || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    }

    // Validate document using Phase 1 validator
    let validatedDoc;
    try {
      validatedDoc = WorldDocSchema.parse(doc);
    } catch (validationError) {
      let details: string | any[] = 'Invalid document structure';
      if (validationError instanceof Error) {
        try {
          // Try to parse Zod error details
          const zodError = JSON.parse(validationError.message);
          if (Array.isArray(zodError)) {
            details = zodError;
          } else {
            details = validationError.message;
          }
        } catch {
          details = validationError.message;
        }
      }
      
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: Array.isArray(details) ? details : [details]
      });
    }

    // Compute hash using Phase 1 hashing utility
    const hash = computeDocumentHash(validatedDoc);

    const { data, error } = await supabase
      .from('worlds')
      .upsert({
        id,
        version,
        doc: validatedDoc,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating world:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save world',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Adventures
router.get('/awf/adventures', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('adventures')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching adventures:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch adventures',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/adventures', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, world_ref, version, doc } = req.body;

    // Validate required fields
    if (!id || !world_ref || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, world_ref, version, doc'
      });
    }

    // Validate document using Phase 1 validator
    let validatedDoc;
    try {
      validatedDoc = AdventureDocSchema.parse(doc);
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid document structure'
      });
    }

    // Compute hash using Phase 1 hashing utility
    const hash = computeDocumentHash(validatedDoc);

    const { data, error } = await supabase
      .from('adventures')
      .upsert({
        id,
        world_ref,
        version,
        doc: validatedDoc,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating adventure:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save adventure',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Adventure Starts
router.get('/awf/adventure-starts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('adventure_starts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching adventure starts:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch adventure starts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/adventure-starts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { adventure_ref, doc, use_once } = req.body;

    // Validate required fields
    if (!adventure_ref || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: adventure_ref, doc'
      });
    }

    // Validate document using Phase 1 validator
    let validatedDoc;
    try {
      validatedDoc = AdventureStartDocSchema.parse(doc);
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid document structure'
      });
    }

    const { data, error } = await supabase
      .from('adventure_starts')
      .upsert({
        adventure_ref,
        doc: validatedDoc,
        use_once: use_once || true
      }, { onConflict: 'adventure_ref' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating adventure start:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save adventure start',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Core Rulesets
router.get('/awf/rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('core_rulesets')
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching rulesets:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch rulesets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, doc } = req.body;

    // Validate required fields
    if (!id || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    }

    // Validate document using CoreRulesetV1Schema
    let validatedDoc;
    try {
      validatedDoc = CoreRulesetV1Schema.parse(doc);
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid document structure'
      });
    }

    // Compute hash
    const hash = computeDocumentHash(validatedDoc);

    const { data, error } = await supabase
      .from('core_rulesets')
      .upsert({
        id,
        version,
        doc: validatedDoc,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/awf/rulesets/:id/:version', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    if (!id || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    }

    const { error } = await supabase
      .from('core_rulesets')
      .delete()
      .eq('id', id)
      .eq('version', version);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Ruleset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NPC Management Routes
router.get('/awf/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, tag } = req.query;
    
    let query = supabase
      .from('npcs')
      .select('*')
      .order('id', { ascending: true })
      .order('created_at', { ascending: false });

    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }
    
    // Note: tag filtering removed since the current schema doesn't have doc->npc->tags
    // If tag filtering is needed, it should be implemented based on the actual schema

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch NPCs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, name, description, status, visibility, author_name, author_type, user_id } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, name'
      });
    }

    const { data, error } = await supabase
      .from('npcs')
      .upsert({
        id,
        name,
        description: description || null,
        status: status || 'draft',
        visibility: visibility || 'private',
        author_name: author_name || null,
        author_type: author_type || 'user',
        user_id: user_id || null
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/awf/npcs/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameter: id'
      });
    }

    const { error } = await supabase
      .from('npcs')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'NPC deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Scenario Management Routes
router.get('/awf/scenarios', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { world_ref, adventure_ref, tag, q, limit } = req.query;
    
    let query = supabase
      .from('scenarios')
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (world_ref) {
      query = query.eq('doc->>world_ref', world_ref);
    }
    
    if (adventure_ref) {
      query = query.eq('doc->>adventure_ref', adventure_ref);
    }
    
    if (tag) {
      query = query.contains('doc->scenario->tags', [tag]);
    }
    
    if (q) {
      // Search in display_name and synopsis
      query = query.or(`doc->scenario->display_name.ilike.%${q}%,doc->scenario->synopsis.ilike.%${q}%`);
    }

    if (limit) {
      query = query.limit(parseInt(limit as string, 10));
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch scenarios',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/scenarios', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, doc } = req.body;

    if (!id || !version || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, doc'
      });
    }

    let validatedDoc;
    try {
      validatedDoc = ScenarioDocV1Schema.parse(doc);
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid document structure'
      });
    }

    const hash = computeDocumentHash(validatedDoc);

    const { data, error } = await supabase
      .from('scenarios')
      .upsert({
        id,
        version,
        doc: validatedDoc,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating scenario:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save scenario',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/awf/scenarios/:id/:version', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    if (!id || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    }

    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id)
      .eq('version', version);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Scenario deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete scenario',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Injection Map Management Routes
router.get('/awf/injection-maps', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, is_active } = req.query;
    
    let query = supabase
      .from('injection_maps')
      .select('*')
      .order('id', { ascending: true })
      .order('version', { ascending: false });

    if (id) {
      query = query.eq('id', id);
    }
    
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching injection maps:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch injection maps',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/injection-maps', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version, label, doc, is_active } = req.body;

    if (!id || !version || !label || !doc) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, version, label, doc'
      });
    }

    let validatedDoc;
    try {
      validatedDoc = InjectionMapDocV1Schema.parse(doc);
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Document validation failed',
        details: validationError instanceof Error ? validationError.message : 'Invalid document structure'
      });
    }

    const hash = computeDocumentHash(validatedDoc);

    const { data, error } = await supabase
      .from('injection_maps')
      .upsert({
        id,
        version,
        label,
        doc: validatedDoc,
        is_active: is_active || false,
        hash
      }, { onConflict: 'id,version' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating/updating injection map:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save injection map',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/awf/injection-maps/:id/:version/activate', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    if (!id || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    }

    // Clear all active flags first
    const { error: clearError } = await supabase
      .from('injection_maps')
      .update({ is_active: false })
      .eq('is_active', true);

    if (clearError) {
      throw clearError;
    }

    // Set this one as active
    const { data, error } = await supabase
      .from('injection_maps')
      .update({ is_active: true })
      .eq('id', id)
      .eq('version', version)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: 'Injection map not found'
      });
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error activating injection map:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to activate injection map',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/awf/injection-maps/:id/:version', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;

    if (!id || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    }

    const { error } = await supabase
      .from('injection_maps')
      .delete()
      .eq('id', id)
      .eq('version', version);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Injection map deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting injection map:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete injection map',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Dry-run endpoint
router.post('/awf/injection-maps/:id/:version/dry-run', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, version } = req.params;
    const { game_id, game_snapshot } = req.body;

    if (!id || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameters: id, version'
      });
    }

    // Validate request body
    try {
      DryRunRequestSchema.parse({ game_id, game_snapshot });
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: validationError instanceof Error ? validationError.message : 'Invalid request structure'
      });
    }

    // Get the injection map
    const { data: mapData, error: mapError } = await supabase
      .from('injection_maps')
      .select('*')
      .eq('id', id)
      .eq('version', version)
      .single();

    if (mapError || !mapData) {
      return res.status(404).json({
        ok: false,
        error: 'Injection map not found'
      });
    }

    // TODO: Implement dry-run logic with assembler
    // For now, return a mock response
    const bundlePreview = {
      contract: { id: 'mock-contract' },
      world: { id: 'mock-world' },
      adventure: { id: 'mock-adventure' }
    };

    const bytes = JSON.stringify(bundlePreview).length;
    const tokensEst = Math.ceil(bytes / 4); // Rough estimate

    res.json({
      ok: true,
      data: {
        bundlePreview,
        bytes,
        tokensEst
      }
    });
  } catch (error) {
    console.error('Error running dry-run:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to run dry-run',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bundle diff endpoint
router.post('/awf/bundle-diff', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { left, right } = req.body;

    // Validate request body
    try {
      BundleDiffRequestSchema.parse({ left, right });
    } catch (validationError) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: validationError instanceof Error ? validationError.message : 'Invalid request structure'
      });
    }

    // TODO: Implement bundle diff logic
    // For now, return a mock response
    const diff = {
      op: 'replace',
      path: '/world/id',
      value: 'new-world-id'
    };

    const leftBytes = 1024;
    const rightBytes = 2048;
    const leftTokens = 256;
    const rightTokens = 512;
    const deltaBytes = rightBytes - leftBytes;
    const deltaTokens = rightTokens - leftTokens;

    res.json({
      ok: true,
      data: {
        diff,
        leftBytes,
        rightBytes,
        leftTokens,
        rightTokens,
        deltaBytes,
        deltaTokens
      }
    });
  } catch (error) {
    console.error('Error running bundle diff:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to run bundle diff',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple CRUD endpoints for admin panel
/**
 * @swagger
 * /api/admin/rulesets:
 *   get:
 *     summary: Get all rulesets
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, archived]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, slug, description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of rulesets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 */
router.get('/rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = supabase
      .from('rulesets')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > Number(page) * Number(limit)
    });
  } catch (error) {
    console.error('Error fetching rulesets:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch rulesets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/rulesets:
 *   post:
 *     summary: Create a new ruleset
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       201:
 *         description: Ruleset created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/rulesets', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { name, slug, description, status = 'draft', prompt } = req.body;
    
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'Name is required'
      });
    }

    // Generate slug if not provided
    const finalSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await supabase
      .from('rulesets')
      .insert({
        id: finalSlug, // Use slug as ID for consistency
        name,
        slug: finalSlug,
        description,
        status,
        prompt: prompt || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/rulesets/{id}:
 *   get:
 *     summary: Get ruleset by ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruleset ID
 *     responses:
 *       200:
 *         description: Ruleset retrieved successfully
 *       404:
 *         description: Ruleset not found
 *       500:
 *         description: Internal server error
 */
router.get('/rulesets/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('rulesets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Ruleset not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error fetching ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/rulesets/{id}:
 *   put:
 *     summary: Update ruleset
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruleset ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       200:
 *         description: Ruleset updated successfully
 *       404:
 *         description: Ruleset not found
 *       500:
 *         description: Internal server error
 */
router.put('/rulesets/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Generate slug if name is updated
    if (updateData.name && !updateData.slug) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const { data, error } = await supabase
      .from('rulesets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Ruleset not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error updating ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/rulesets/{id}:
 *   delete:
 *     summary: Delete ruleset
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruleset ID
 *     responses:
 *       200:
 *         description: Ruleset deleted successfully
 *       404:
 *         description: Ruleset not found
 *       500:
 *         description: Internal server error
 */
router.delete('/rulesets/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('rulesets')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Ruleset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ruleset:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete ruleset',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Worlds CRUD endpoints for admin panel
/**
 * @swagger
 * /api/admin/worlds:
 *   get:
 *     summary: Get all worlds
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, archived]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, slug, description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of worlds
 */
router.get('/worlds', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = supabase
      .from('worlds_admin')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > Number(page) * Number(limit)
    });
  } catch (error) {
    console.error('Error fetching worlds:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch worlds',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/worlds:
 *   post:
 *     summary: Create a new world
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       201:
 *         description: World created successfully
 */
router.post('/worlds', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { name, description, status = 'draft', visibility = 'private', doc } = req.body;
    const userId = req.user?.id;
    
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'Name is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    // Generate UUIDs
    const worldId = crypto.randomUUID();
    const uuidId = crypto.randomUUID();

    // Generate a slug from the name (or use from doc if provided)
    const slug = doc?.slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Build insert data
    const insertData: any = {
      id: worldId,
      name: name,
      slug: slug,
      description: description || null,
      status: status,
      version: 1,
      doc: doc || {}, // Use provided doc object or empty object
      visibility: visibility,
      review_state: 'draft',
      owner_user_id: userId,
    };

    const { data: result, error } = await supabase
      .from('worlds')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create the mapping entry
    const { error: mappingError } = await supabase
      .from('world_id_mapping')
      .insert({
        text_id: worldId,
        uuid_id: uuidId
      });

    if (mappingError) {
      console.warn('Failed to create world mapping:', mappingError);
    }

    res.status(201).json({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating world:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create world',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/worlds/{id}:
 *   get:
 *     summary: Get world by ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: World ID
 *     responses:
 *       200:
 *         description: World retrieved successfully
 *       404:
 *         description: World not found
 */
router.get('/worlds/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is a UUID (looks like a UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let data, error;
    
    if (isUUID) {
      // First, try querying worlds_admin by id (uuid_id from mapping)
      let query = supabase
        .from('worlds_admin')
        .select('*')
        .eq('id', id)
        .single();

      const result = await query;
      data = result.data;
      error = result.error;

      // If not found, try querying by text_id (the actual world.id from worlds table)
      if (error && error.code === 'PGRST116') {
        query = supabase
          .from('worlds_admin')
          .select('*')
          .eq('text_id', id)
          .single();
        
        const textIdResult = await query;
        data = textIdResult.data;
        error = textIdResult.error;
      }

      // If still not found, try looking up via mapping table (reverse lookup)
      if (error && error.code === 'PGRST116') {
        const { data: mapping, error: mappingError } = await supabase
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', id)
          .single();

        if (!mappingError && mapping) {
          // Found mapping, query with text_id
          query = supabase
            .from('worlds_admin')
            .select('*')
            .eq('text_id', mapping.text_id)
            .single();
          
          const mappedResult = await query;
          data = mappedResult.data;
          error = mappedResult.error;
        }
      }
    } else {
      // If it's not a UUID, assume it's a text_id and query directly
      const result = await supabase
        .from('worlds_admin')
        .select('*')
        .eq('id', id)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'World not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error fetching world:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch world',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/worlds/{id}:
 *   put:
 *     summary: Update world
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: World ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       200:
 *         description: World updated successfully
 *       404:
 *         description: World not found
 */
router.put('/worlds/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if id is a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let textId: string;
    
    if (isUUID) {
      // First, check if this UUID is the text_id (world.id) directly
      const { data: directCheck, error: directError } = await supabase
        .from('worlds')
        .select('id')
        .eq('id', id)
        .single();
      
      if (!directError && directCheck) {
        // It's the text_id, use it directly
        textId = id;
      } else {
        // Try to get the text_id from mapping
        const { data: mapping, error: mappingError } = await supabase
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', id)
          .single();

        if (mappingError || !mapping) {
          return res.status(404).json({
            ok: false,
            error: 'World not found'
          });
        }
        
        textId = mapping.text_id;
      }
    } else {
      // Not a UUID, assume it's a text_id
      textId = id;
    }

    // Generate slug if name is updated
    if (updateData.name && !updateData.slug) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Store prompt in doc field
    if (updateData.prompt) {
      updateData.doc = updateData.prompt;
      delete updateData.prompt;
    }

    const { data, error } = await supabase
      .from('worlds')
      .update(updateData)
      .eq('id', textId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'World not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error updating world:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update world',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/worlds/{id}:
 *   delete:
 *     summary: Delete world
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: World ID
 *     responses:
 *       200:
 *         description: World deleted successfully
 *       404:
 *         description: World not found
 */
router.delete('/worlds/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the text_id from mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('world_id_mapping')
      .select('text_id')
      .eq('uuid_id', id)
      .single();

    if (mappingError) {
      return res.status(404).json({
        ok: false,
        error: 'World not found'
      });
    }

    const { error } = await supabase
      .from('worlds')
      .delete()
      .eq('id', mapping.text_id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'World deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting world:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete world',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// User roles endpoint for admin panel
/**
 * @swagger
 * /api/admin/user/roles:
 *   get:
 *     summary: Get current user's roles
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User roles retrieved successfully
 */
router.get('/user/roles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized'
      });
    }

    const { data, error } = await supabase
      .from('app_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const roles = (data || []).map(row => row.role);
    
    res.json({
      ok: true,
      data: roles
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch user roles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NPCs CRUD endpoints for admin panel
/**
 * @swagger
 * /api/admin/npcs:
 *   get:
 *     summary: Get all NPCs
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, archived]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, slug, description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of NPCs
 */
router.get('/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    let query = supabase
      .from('npcs')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > Number(page) * Number(limit)
    });
  } catch (error) {
    console.error('Error fetching NPCs:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch NPCs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/npcs:
 *   post:
 *     summary: Create a new NPC
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       201:
 *         description: NPC created successfully
 */
router.post('/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { name, slug, description, status = 'draft', visibility = 'private', world_id, portrait_url, role_tags, doc } = req.body;
    const userId = req.user?.id;
    
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'Name is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'User ID is required'
      });
    }

    // Validate NPC doc structure if provided
    if (doc && doc.npc) {
      const validationResult = NPCDocV1Schema.safeParse(doc);
      if (!validationResult.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid NPC doc structure',
          details: validationResult.error.errors
        });
      }
    }

    // Generate slug if not provided
    const finalSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Build insert data
    const insertData: any = {
      name,
      description: description || null,
      status,
      visibility,
      review_state: 'draft',
      owner_user_id: userId,
      doc: doc || { npc: {} }, // Use provided doc or default NPCDocV1 structure
    };

    if (finalSlug) {
      insertData.slug = finalSlug;
    }

    if (world_id) {
      insertData.world_id = world_id;
    }

    if (portrait_url) {
      insertData.portrait_url = portrait_url;
    }

    if (role_tags && Array.isArray(role_tags) && role_tags.length > 0) {
      insertData.role_tags = role_tags;
    }

    const { data, error } = await supabase
      .from('npcs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/npcs/{id}:
 *   get:
 *     summary: Get NPC by ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: NPC ID
 *     responses:
 *       200:
 *         description: NPC retrieved successfully
 *       404:
 *         description: NPC not found
 */
router.get('/npcs/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('npcs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'NPC not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error fetching NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/npcs/{id}:
 *   put:
 *     summary: Update NPC
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: NPC ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, active, archived]
 *               prompt:
 *                 type: object
 *     responses:
 *       200:
 *         description: NPC updated successfully
 *       404:
 *         description: NPC not found
 */
router.put('/npcs/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Generate slug if name is updated
    if (updateData.name && !updateData.slug) {
      updateData.slug = updateData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const { data, error } = await supabase
      .from('npcs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'NPC not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error updating NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/npcs/{id}:
 *   delete:
 *     summary: Delete NPC
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: NPC ID
 *     responses:
 *       200:
 *         description: NPC deleted successfully
 *       404:
 *         description: NPC not found
 */
router.delete('/npcs/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('npcs')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'NPC deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting NPC:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete NPC',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NPC Bindings endpoints for admin panel
/**
 * @swagger
 * /api/admin/entry-points/{entryPointId}/npcs:
 *   get:
 *     summary: Get NPC bindings for an entry point
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry Point ID
 *     responses:
 *       200:
 *         description: List of NPC bindings
 */
router.get('/entry-points/:entryPointId/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { entryPointId } = req.params;
    
    const { data, error } = await supabase
      .from('entry_point_npcs')
      .select(`
        *,
        npc:npc_id (
          id,
          name,
          description,
          status
        )
      `)
      .eq('entry_point_id', entryPointId)
      .order('weight', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform data to include npc_name for display
    const bindings = (data || []).map(binding => ({
      ...binding,
      npc_name: binding.npc?.name || 'Unknown'
    }));

    res.json({
      ok: true,
      data: bindings
    });
  } catch (error) {
    console.error('Error fetching NPC bindings:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch NPC bindings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{entryPointId}/npcs/available:
 *   get:
 *     summary: Get available NPCs for binding to an entry point
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry Point ID
 *     responses:
 *       200:
 *         description: List of available NPCs
 */
router.get('/entry-points/:entryPointId/npcs/available', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { entryPointId } = req.params;
    
    // Get all NPCs (without world filtering for now, since schema is inconsistent)
    const { data: npcs, error: npcsError } = await supabase
      .from('npcs')
      .select('id, name, description, status')
      .eq('status', 'active')
      .order('name');

    if (npcsError) {
      throw npcsError;
    }

    // Get already bound NPCs for this entry point
    const { data: bindings, error: bindingsError } = await supabase
      .from('entry_point_npcs')
      .select('npc_id')
      .eq('entry_point_id', entryPointId);

    if (bindingsError) {
      throw bindingsError;
    }

    const boundNpcIds = new Set((bindings || []).map(b => b.npc_id));
    
    // Filter out already bound NPCs
    const availableNpcs = (npcs || []).filter(npc => !boundNpcIds.has(npc.id));

    res.json({
      ok: true,
      data: availableNpcs
    });
  } catch (error) {
    console.error('Error fetching available NPCs:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch available NPCs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{entryPointId}/npcs:
 *   post:
 *     summary: Create NPC binding
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry Point ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [npc_id, role_hint]
 *             properties:
 *               npc_id:
 *                 type: string
 *               role_hint:
 *                 type: string
 *               weight:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       201:
 *         description: NPC binding created successfully
 */
router.post('/entry-points/:entryPointId/npcs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { entryPointId } = req.params;
    const { npc_id, role_hint, weight = 1 } = req.body;
    
    if (!npc_id || !role_hint) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: npc_id, role_hint'
      });
    }

    // Check for duplicate binding
    const { data: existing, error: checkError } = await supabase
      .from('entry_point_npcs')
      .select('id')
      .eq('entry_point_id', entryPointId)
      .eq('npc_id', npc_id)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'NPC is already bound to this entry point'
      });
    }

    const { data, error } = await supabase
      .from('entry_point_npcs')
      .insert({
        entry_point_id: entryPointId,
        npc_id,
        role_hint,
        weight
      })
      .select(`
        *,
        npc:npc_id (
          id,
          name,
          description,
          status
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      ok: true,
      data: {
        ...data,
        npc_name: data.npc?.name || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Error creating NPC binding:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create NPC binding',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{entryPointId}/npcs/{bindingId}:
 *   put:
 *     summary: Update NPC binding
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry Point ID
 *       - in: path
 *         name: bindingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Binding ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_hint:
 *                 type: string
 *               weight:
 *                 type: integer
 *     responses:
 *       200:
 *         description: NPC binding updated successfully
 */
router.put('/entry-points/:entryPointId/npcs/:bindingId', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { entryPointId, bindingId } = req.params;
    const updateData = req.body;
    
    const { data, error } = await supabase
      .from('entry_point_npcs')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', bindingId)
      .eq('entry_point_id', entryPointId)
      .select(`
        *,
        npc:npc_id (
          id,
          name,
          description,
          status
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'NPC binding not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data: {
        ...data,
        npc_name: data.npc?.name || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Error updating NPC binding:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update NPC binding',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{entryPointId}/npcs/{bindingId}:
 *   delete:
 *     summary: Delete NPC binding
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entryPointId
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry Point ID
 *       - in: path
 *         name: bindingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Binding ID
 *     responses:
 *       200:
 *         description: NPC binding deleted successfully
 */
router.delete('/entry-points/:entryPointId/npcs/:bindingId', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { entryPointId, bindingId } = req.params;
    
    const { error } = await supabase
      .from('entry_point_npcs')
      .delete()
      .eq('id', bindingId)
      .eq('entry_point_id', entryPointId);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'NPC binding deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting NPC binding:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete NPC binding',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Entry Points endpoints for admin panel
/**
 * @swagger
 * /api/admin/entry-points:
 *   get:
 *     summary: Get all entry points
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lifecycle
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by lifecycle status
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by visibility
 *       - in: query
 *         name: world_id
 *         schema:
 *           type: string
 *         description: Filter by world ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, slug, title, description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of entry points
 */
router.get('/entry-points', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { lifecycle, visibility, world_id, type, search, page = 1, limit = 20 } = req.query;
    
    let query = supabase
      .from('entry_points')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (lifecycle) {
      const lifecycleArray = Array.isArray(lifecycle) ? lifecycle : [lifecycle];
      query = query.in('lifecycle', lifecycleArray);
    }

    if (visibility) {
      const visibilityArray = Array.isArray(visibility) ? visibility : [visibility];
      query = query.in('visibility', visibilityArray);
    }

    // Resolve world_id filter: if UUID, convert to TEXT for query
    if (world_id) {
      let resolvedWorldId = world_id as string;
      if (typeof world_id === 'string' && world_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: mapping, error: mappingError } = await supabase
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', world_id)
          .single();

        if (!mappingError && mapping) {
          resolvedWorldId = mapping.text_id;
        } else {
          // If mapping not found, filter will return empty results (world doesn't exist)
          resolvedWorldId = '___NO_MATCH___';
        }
      }
      query = query.eq('world_id', resolvedWorldId);
    }

    if (type) {
      const typeArray = Array.isArray(type) ? type : [type];
      query = query.in('type', typeArray);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Resolve world_id from TEXT to UUID for each entry point
    const resolvedData = await Promise.all((data || []).map(async (ep: any) => {
      if (ep.world_id) {
        const { data: mapping, error: mappingError } = await supabase
          .from('world_id_mapping')
          .select('uuid_id')
          .eq('text_id', ep.world_id)
          .single();

        if (!mappingError && mapping) {
          return { ...ep, world_id: mapping.uuid_id };
        }
      }
      return ep;
    }));

    res.json({
      ok: true,
      data: resolvedData,
      count: count || 0,
      hasMore: (count || 0) > Number(page) * Number(limit)
    });
  } catch (error) {
    console.error('Error fetching entry points:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch entry points',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{id}:
 *   get:
 *     summary: Get entry point by ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry point ID
 *     responses:
 *       200:
 *         description: Entry point retrieved successfully
 *       404:
 *         description: Entry point not found
 */
router.get('/entry-points/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch entry point with joined rulesets
    const { data, error } = await supabase
      .from('entry_points')
      .select(`
        *,
        entry_point_rulesets:entry_point_rulesets(
          sort_order,
          ruleset_id,
          rulesets:ruleset_id(
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Entry point not found'
        });
      }
      throw error;
    }

    // Resolve world_id from TEXT to UUID if it exists
    let resolvedWorldId = data.world_id;
    if (data.world_id) {
      const { data: mapping, error: mappingError } = await supabase
        .from('world_id_mapping')
        .select('uuid_id')
        .eq('text_id', data.world_id)
        .single();

      if (!mappingError && mapping) {
        resolvedWorldId = mapping.uuid_id;
      }
      // If mapping doesn't exist, keep the original text_id
      // This handles edge cases where a world exists but mapping is missing
    }

    // Transform rulesets to match frontend format
    const rulesets = (data.entry_point_rulesets || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((epr: any) => ({
        id: epr.rulesets?.id || epr.ruleset_id,
        name: epr.rulesets?.name || epr.ruleset_id,
        sort_order: epr.sort_order
      }));

    // Remove the nested entry_point_rulesets from response
    const { entry_point_rulesets, ...entryPointData } = data;

    res.json({
      ok: true,
      data: {
        ...entryPointData,
        world_id: resolvedWorldId, // Return UUID instead of TEXT
        rulesets
      }
    });
  } catch (error) {
    console.error('Error fetching entry point:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch entry point',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points:
 *   post:
 *     summary: Create a new entry point
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, world_id, rulesetIds, title, description, tags, visibility, content_rating]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [adventure, scenario, sandbox, quest]
 *               world_id:
 *                 type: string
 *               rulesetIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               title:
 *                 type: string
 *               subtitle:
 *                 type: string
 *               description:
 *                 type: string
 *               synopsis:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               visibility:
 *                 type: string
 *                 enum: [public, unlisted, private]
 *               content_rating:
 *                 type: string
 *               prompt:
 *                 type: object
 *     responses:
 *       201:
 *         description: Entry point created successfully
 */
router.post('/entry-points', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { name, slug, type, world_id, rulesetIds, title, subtitle, description, synopsis, tags, visibility, content_rating, prompt } = req.body;
    
    if (!name || !type || !world_id || !rulesetIds || !title || !description || !tags || !visibility || !content_rating) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields'
      });
    }

    // Resolve world_id: if it's a UUID, get the text_id from mapping
    let resolvedWorldId = world_id;
    if (world_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: mapping, error: mappingError } = await supabase
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', world_id)
        .single();

      if (mappingError || !mapping) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid world_id: World not found in mapping'
        });
      }
      
      resolvedWorldId = mapping.text_id;
    }

    // Generate slug if not provided
    const finalSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Insert the entry point
    const { data, error } = await supabase
      .from('entry_points')
      .insert({
        id: name, // Use name as ID
        name,
        slug: finalSlug,
        type,
        world_id: resolvedWorldId, // Use resolved TEXT ID
        title,
        subtitle,
        description,
        synopsis,
        tags,
        visibility,
        content_rating,
        lifecycle: 'draft',
        prompt
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create ruleset associations
    if (rulesetIds && rulesetIds.length > 0) {
      const rulesetAssociations = rulesetIds.map((rulesetId: string, index: number) => ({
        entry_point_id: data.id,
        ruleset_id: rulesetId,
        sort_order: index
      }));

      const { error: rulesetError } = await supabase
        .from('entry_point_rulesets')
        .insert(rulesetAssociations);

      if (rulesetError) {
        // Clean up the entry point if ruleset association fails
        await supabase.from('entry_points').delete().eq('id', data.id);
        throw new Error(`Failed to create ruleset associations: ${rulesetError.message}`);
      }
    }

    res.status(201).json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error creating entry point:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create entry point',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{id}:
 *   put:
 *     summary: Update entry point
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               type:
 *                 type: string
 *               world_id:
 *                 type: string
 *               rulesetIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               title:
 *                 type: string
 *               subtitle:
 *                 type: string
 *               description:
 *                 type: string
 *               synopsis:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               visibility:
 *                 type: string
 *               content_rating:
 *                 type: string
 *               lifecycle:
 *                 type: string
 *               prompt:
 *                 type: object
 *     responses:
 *       200:
 *         description: Entry point updated successfully
 */
router.put('/entry-points/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rulesetIds, world_id, ...updateData } = req.body;
    
    // Resolve world_id if provided and is a UUID
    if (world_id) {
      if (world_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: mapping, error: mappingError } = await supabase
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', world_id)
          .single();

        if (mappingError || !mapping) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid world_id: World not found in mapping'
          });
        }
        
        updateData.world_id = mapping.text_id;
      } else {
        updateData.world_id = world_id;
      }
    }
    
    // Update the entry point
    const { data, error } = await supabase
      .from('entry_points')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Entry point not found'
        });
      }
      throw error;
    }

    // Update ruleset associations if provided
    if (rulesetIds !== undefined) {
      // Delete existing associations
      const { error: deleteError } = await supabase
        .from('entry_point_rulesets')
        .delete()
        .eq('entry_point_id', id);

      if (deleteError) {
        throw new Error(`Failed to remove existing ruleset associations: ${deleteError.message}`);
      }

      // Create new associations
      if (rulesetIds.length > 0) {
        const rulesetAssociations = rulesetIds.map((rulesetId: string, index: number) => ({
          entry_point_id: id,
          ruleset_id: rulesetId,
          sort_order: index
        }));

        const { error: rulesetError } = await supabase
          .from('entry_point_rulesets')
          .insert(rulesetAssociations);

        if (rulesetError) {
          throw new Error(`Failed to create ruleset associations: ${rulesetError.message}`);
        }
      }
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error updating entry point:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update entry point',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/entry-points/{id}:
 *   delete:
 *     summary: Delete entry point
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry point deleted successfully
 */
router.delete('/entry-points/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete ruleset associations first (if they exist)
    await supabase
      .from('entry_point_rulesets')
      .delete()
      .eq('entry_point_id', id);
    
    // Delete the entry point
    const { error } = await supabase
      .from('entry_points')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      message: 'Entry point deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting entry point:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete entry point',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-snapshots/{id}:
 *   get:
 *     summary: Get prompt snapshot by ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Prompt snapshot retrieved successfully
 *       404:
 *         description: Snapshot not found
 */
router.get('/prompt-snapshots/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { getPromptSnapshot } = await import('../services/prompt-snapshots.service.js');
    
    const snapshot = await getPromptSnapshot(id);
    
    if (!snapshot) {
      return res.status(404).json({
        ok: false,
        error: 'Snapshot not found'
      });
    }
    
    res.json({
      ok: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error getting prompt snapshot:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get prompt snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/templates/publish:
 *   post:
 *     summary: Publish a new version of a template
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - slot
 *               - body
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [world, ruleset, npc, scenario, module, ux]
 *               slot:
 *                 type: string
 *               body:
 *                 type: string
 *               baseVersion:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Template published successfully
 */
router.post('/templates/publish', 
  authenticateToken, 
  requireAdminRole,
  requireRole('publisher'),
  rateLimit({ maxRequests: 10, windowMs: 3600000 }), // 10 per hour
  async (req, res) => {
  try {
    const { type, slot, body, baseVersion } = req.body;
    
    if (!type || !slot || !body) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: type, slot, body'
      });
    }

    const { publishNewVersion } = await import('../services/templates.service.js');
    const userId = req.user?.id;
    
    const template = await publishNewVersion({
      type,
      slot,
      body,
      baseVersion,
      created_by: userId,
    });
    
    res.json({
      ok: true,
      data: { version: template.version }
    });
  } catch (error) {
    console.error('Error publishing template:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to publish template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/templates/:type/:slot/history:
 *   get:
 *     summary: Get template history for a specific slot
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: slot
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template history retrieved successfully
 */
router.get('/templates/:type/:slot/history', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { type, slot } = req.params;
    
    const { getTemplateHistory } = await import('../services/templates.service.js');
    const history = await getTemplateHistory(type as any, slot);
    
    res.json({
      ok: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting template history:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get template history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/templates/active:
 *   get:
 *     summary: Get active templates
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: templatesVersion
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Active templates retrieved successfully
 */
router.get('/templates/active', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const templatesVersion = req.query.templatesVersion 
      ? parseInt(req.query.templatesVersion as string, 10)
      : undefined;
    
    const { getActiveTemplates } = await import('../services/templates.service.js');
    const templates = await getActiveTemplates(
      type as any,
      templatesVersion
    );
    
    res.json({
      ok: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting active templates:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get active templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-preview:
 *   post:
 *     summary: Preview TurnPacketV3 and linearized prompt
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gameId:
 *                 type: string
 *               worldId:
 *                 type: string
 *               rulesetId:
 *                 type: string
 *               scenarioId:
 *                 type: string
 *               npcIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               templatesVersion:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Preview generated successfully
 */
router.post('/prompt-preview', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { 
      gameId, 
      worldId, 
      rulesetId, 
      scenarioId, 
      npcIds, 
      templatesVersion, 
      moduleParamsOverrides,
      extrasOverrides,
      verbose
    } = req.body;

    const hasOverrides = !!(moduleParamsOverrides || extrasOverrides);
    const warnings: string[] = [];

    // Validate module params overrides
    if (moduleParamsOverrides) {
      const { validateModuleParams } = await import('../services/module-params.service.js');
      for (const [moduleId, params] of Object.entries(moduleParamsOverrides)) {
        const validation = await validateModuleParams(moduleId, params as Record<string, unknown>);
        if (!validation.valid) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid module params overrides',
            details: {
              moduleId,
              errors: validation.errors,
            },
          });
        }
      }
    }

    // Validate extras overrides
    if (extrasOverrides) {
      const { validateExtras } = await import('../services/extras.service.js');
      
      if (extrasOverrides.world) {
        const validation = await validateExtras('world', extrasOverrides.world);
        if (!validation.ok) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid world extras overrides',
            details: validation.errors,
          });
        }
      }
      
      if (extrasOverrides.ruleset) {
        const validation = await validateExtras('ruleset', extrasOverrides.ruleset);
        if (!validation.ok) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid ruleset extras overrides',
            details: validation.errors,
          });
        }
      }
      
      if (extrasOverrides.scenario) {
        const validation = await validateExtras('scenario', extrasOverrides.scenario);
        if (!validation.ok) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid scenario extras overrides',
            details: validation.errors,
          });
        }
      }
      
      if (extrasOverrides.npcs) {
        for (const [npcId, npcExtras] of Object.entries(extrasOverrides.npcs)) {
          const validation = await validateExtras('npc', npcExtras as Record<string, unknown>);
          if (!validation.ok) {
            return res.status(400).json({
              ok: false,
              error: `Invalid NPC extras overrides for ${npcId}`,
              details: validation.errors,
            });
          }
        }
      }
    }
    
    // Load extras from database if IDs provided
    const extrasMap: Record<string, Record<string, unknown>> = {};
    
    if (worldId) {
      const { data: world } = await supabase
        .from('worlds')
        .select('extras')
        .eq('id', worldId)
        .single();
      if (world?.extras) {
        extrasMap.world = world.extras as Record<string, unknown>;
      }
    }
    
    if (rulesetId) {
      const { data: ruleset } = await supabase
        .from('rulesets')
        .select('extras')
        .eq('id', rulesetId)
        .single();
      if (ruleset?.extras) {
        extrasMap.ruleset = ruleset.extras as Record<string, unknown>;
      }
    }
    
    if (scenarioId) {
      const { data: scenario } = await supabase
        .from('scenarios')
        .select('extras')
        .eq('id', scenarioId)
        .single();
      if (scenario?.extras) {
        extrasMap.scenario = scenario.extras as Record<string, unknown>;
      }
    }
    
    if (npcIds && Array.isArray(npcIds)) {
      const { data: npcs } = await supabase
        .from('npcs')
        .select('id, extras')
        .in('id', npcIds);
      if (npcs) {
        for (const npc of npcs) {
          if (npc.extras) {
            extrasMap[`npc_${npc.id}`] = npc.extras as Record<string, unknown>;
          }
        }
      }
    }
    
    // Build TurnPacketV3 from provided context
    const { buildTurnPacketV3FromV3 } = await import('../adapters/turn-packet-v3-adapter.js');
    const { buildLinearizedPrompt } = await import('../utils/linearized-prompt.js');
    const { lintTemplates } = await import('../utils/template-lint.js');
    const { CORE_PROMPT } = await import('../prompts/entry-point-assembler-v3.js');
    
    // For preview, we need to construct a minimal V3 output
    // This is a simplified version - in production you'd load actual data
    const mockV3Output = {
      prompt: '',
      pieces: [],
      meta: {
        worldId: worldId || 'preview-world',
        worldSlug: worldId || 'preview-world',
        rulesetSlug: rulesetId || 'preview-ruleset',
        entryPointId: 'preview-entry',
        entryPointSlug: 'preview-entry',
        entryStartSlug: 'preview-start',
        tokenEst: { input: 0, budget: 8000, pct: 0 },
        model: 'gpt-4o-mini',
        source: 'preview',
        version: 'v3',
        npcTrimmedCount: 0,
        selectionContext: {} as any,
      },
      extras: extrasMap, // Include extras for template rendering
    };
    
    // Build overrides object
    const overrides = hasOverrides ? {
      moduleParamsOverrides,
      extrasOverrides,
    } : undefined;

    const tp = await buildTurnPacketV3FromV3(
      mockV3Output as any,
      CORE_PROMPT,
      {},
      'Preview input',
      'preview-build',
      templatesVersion,
      overrides
    );
    
    // Build linearized sections
    const { buildLinearizedSections } = await import('../utils/linearized-prompt.js');
    const sections = await buildLinearizedSections(tp);
    
    // Apply budget if maxTokens provided
    const maxTokens = req.body.maxTokens || undefined;
    let linearized: string;
    let tokenInfo: { before: number; after?: number; trimPlan?: Array<{ key: string; removedTokens: number }> } | undefined;
    
    if (maxTokens) {
      const { applyBudget } = await import('../budget/budget-engine.js');
      const budgetResult = await applyBudget({
        linearSections: sections,
        maxTokens,
      });
      linearized = budgetResult.sections.map(s => s.text).join('\n\n');
      tokenInfo = {
        before: budgetResult.totalTokensBefore,
        after: budgetResult.totalTokensAfter,
        trimPlan: budgetResult.trims.map(t => ({ key: t.key, removedTokens: t.removedTokens })),
      };
    } else {
      linearized = sections.map(s => s.text).join('\n\n');
      if (verbose) {
        const { estimateTokens } = await import('../budget/tokenizer.js');
        const before = await estimateTokens(linearized);
        tokenInfo = {
          before,
        };
      }
    }
    
    // Run lint checks
    const lintWarnings = await lintTemplates(templatesVersion);
    
    // Check for scenario graph warnings
    const scenarioWarnings: string[] = [];
    if (scenarioId && tp.scenario) {
      try {
        const { getGraph } = await import('../services/scenario-graph.service.js');
        const graph = await getGraph(scenarioId);
        if (graph) {
          const entryNode = graph.entry_node || graph.nodes[0]?.id;
          if (entryNode && !graph.nodes.find(n => n.id === entryNode)) {
            scenarioWarnings.push('entry_node not found; using first node');
          }
          if (!tp.scenario.reachability) {
            scenarioWarnings.push('scenario graph present but reachability not computed');
          }
        }
      } catch (err) {
        // Silently fail
      }
    }

    res.json({
      ok: true,
      data: {
        source: hasOverrides ? 'preview-overrides' : 'preview',
        tp,
        linearized,
        warnings: [
          ...lintWarnings.filter(w => w.severity === 'warning').map(w => w.message),
          ...scenarioWarnings,
        ],
        errors: lintWarnings.filter(w => w.severity === 'error').map(w => w.message),
        ...(tokenInfo ? { tokens: tokenInfo } : {}),
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-snapshots:
 *   get:
 *     summary: List prompt snapshots
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gameId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Snapshots retrieved successfully
 */
router.get('/prompt-snapshots', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const gameId = req.query.gameId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    
    const { supabaseAdmin } = await import('../services/supabase.js');
    
    let query = supabaseAdmin
      .from('prompt_snapshots')
      .select('id, snapshot_id, created_at, source, templates_version, game_id, turn_id')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (gameId) {
      query = query.eq('game_id', gameId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      ok: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error listing snapshots:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list snapshots',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-snapshots/:id/diff/:otherId:
 *   get:
 *     summary: Get diff between two snapshots
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: otherId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Diff generated successfully
 */
router.get('/prompt-snapshots/:id/diff/:otherId', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id, otherId } = req.params;
    
    const { diffSnapshots } = await import('../utils/snapshot-diff.js');
    const diff = await diffSnapshots(id, otherId);
    
    res.json({
      ok: true,
      data: diff
    });
  } catch (error) {
    console.error('Error generating diff:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to generate diff',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-snapshots/{id}/override:
 *   post:
 *     summary: Create manual override snapshot with safeguards
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tp
 *               - linearized_prompt_text
 *               - reason
 *             properties:
 *               tp:
 *                 type: object
 *               linearized_prompt_text:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Override snapshot created successfully
 *       400:
 *         description: Invalid request body or validation failed
 *       404:
 *         description: Original snapshot not found
 */
router.post('/prompt-snapshots/:id/override', 
  authenticateToken, 
  requireAdminRole,
  requireRole('publisher'),
  rateLimit({ maxRequests: 5, windowMs: 3600000 }), // 5 per hour
  async (req, res) => {
  try {
    const { id } = req.params;
    const { tp, linearized_prompt_text, reason } = req.body;
    
    if (!tp || !linearized_prompt_text || !reason) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: tp, linearized_prompt_text, reason'
      });
    }

    // Validate TurnPacketV3
    const { TurnPacketV3Schema } = await import('../validators/turn-packet-v3.schema.js');
    const validationResult = TurnPacketV3Schema.safeParse(tp);
    
    if (!validationResult.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid TurnPacketV3',
        details: validationResult.error.errors
      });
    }

    // Additional validation: contract and version
    if (validationResult.data.contract !== 'awf.v1') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid contract: must be "awf.v1"'
      });
    }

    if (validationResult.data.tp_version !== '3') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid tp_version: must be "3"'
      });
    }

    const { getPromptSnapshot, createPromptSnapshot } = await import('../services/prompt-snapshots.service.js');
    const userId = req.user?.id;
    
    // Get original snapshot
    const original = await getPromptSnapshot(id);
    if (!original) {
      return res.status(404).json({
        ok: false,
        error: 'Original snapshot not found'
      });
    }

    // Create new snapshot with parent_id
    const snapshot = await createPromptSnapshot({
      templates_version: original.templates_version,
      pack_versions: original.pack_versions,
      tp: validationResult.data,
      linearized_prompt_text,
      awf_contract: 'awf.v1',
      source: 'manual',
      created_by: userId,
      game_id: original.game_id,
      turn_id: original.turn_id,
      parent_id: original.id,
    });
    
    res.json({
      ok: true,
      data: {
        originalSnapshotId: original.snapshot_id,
        overrideSnapshotId: snapshot.snapshot_id,
        reason,
      }
    });
  } catch (error) {
    console.error('Error creating override snapshot:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create override snapshot',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/templates/lint:
 *   get:
 *     summary: Lint templates for health checks
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: templatesVersion
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lint results
 */
router.get('/templates/lint', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const templatesVersion = req.query.templatesVersion
      ? parseInt(req.query.templatesVersion as string, 10)
      : undefined;
    
    const { lintTemplates } = await import('../utils/template-lint.js');
    const warnings = await lintTemplates(templatesVersion);
    
    res.json({
      ok: true,
      data: {
        warnings: warnings.filter(w => w.severity === 'warning'),
        errors: warnings.filter(w => w.severity === 'error'),
        summary: {
          total: warnings.length,
          errors: warnings.filter(w => w.severity === 'error').length,
          warnings: warnings.filter(w => w.severity === 'warning').length,
        },
      }
    });
  } catch (error) {
    console.error('Error linting templates:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to lint templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/games/{id}:
 *   patch:
 *     summary: Update game settings (templates_version pinning)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templates_version:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Game updated successfully
 */
router.patch('/games/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { templates_version } = req.body;
    
    const { supabaseAdmin } = await import('../services/supabase.js');
    
    const { data, error } = await supabaseAdmin
      .from('games')
      .update({ templates_version: templates_version || null })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Game not found'
        });
      }
      throw error;
    }
    
    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/prompt-snapshots/create:
 *   post:
 *     summary: Create manual snapshot from preview
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tp
 *               - linearized_prompt_text
 *             properties:
 *               tp:
 *                 type: object
 *               linearized_prompt_text:
 *                 type: string
 *               templates_version:
 *                 type: string
 *               pack_versions:
 *                 type: object
 *               game_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Snapshot created successfully
 */
router.post('/prompt-snapshots/create', 
  authenticateToken, 
  requireAdminRole,
  requireRole('publisher'),
  async (req, res) => {
    try {
      const { tp, linearized_prompt_text, templates_version, pack_versions, game_id } = req.body;
      
      if (!tp || !linearized_prompt_text) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: tp and linearized_prompt_text'
        });
      }

      // Validate TurnPacketV3
      const { TurnPacketV3Schema } = await import('../validators/turn-packet-v3.schema.js');
      const validationResult = TurnPacketV3Schema.safeParse(tp);
      
      if (!validationResult.success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid TurnPacketV3',
          details: validationResult.error.errors
        });
      }

      const { createPromptSnapshot } = await import('../services/prompt-snapshots.service.js');
      const userId = req.user?.id;
      
      const snapshot = await createPromptSnapshot({
        templates_version,
        pack_versions,
        tp: validationResult.data,
        linearized_prompt_text,
        awf_contract: 'awf.v1',
        source: 'manual',
        created_by: userId,
        game_id: game_id || null,
      });
      
      res.json({
        ok: true,
        data: snapshot
      });
    } catch (error) {
      console.error('Error creating snapshot:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to create snapshot',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/templates/versions:
 *   get:
 *     summary: Get distinct template versions
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of distinct versions
 */
router.get('/templates/versions', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { supabaseAdmin } = await import('../services/supabase.js');
    
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('version')
      .eq('status', 'published')
      .order('version', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // Get distinct versions
    const versions = [...new Set((data || []).map(t => t.version))].sort((a, b) => b - a);
    
    res.json({
      ok: true,
      data: versions
    });
  } catch (error) {
    console.error('Error getting template versions:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get template versions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/field-defs:
 *   get:
 *     summary: List field definitions
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: packType
 *         schema:
 *           type: string
 *           enum: [world, ruleset, npc, scenario]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, deprecated]
 *     responses:
 *       200:
 *         description: Field definitions list
 */
router.get('/field-defs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { packType, status } = req.query;
    const { listFieldDefs } = await import('../services/field-defs.service.js');
    
    const defs = await listFieldDefs(
      packType as any,
      status as 'active' | 'deprecated' | undefined
    );
    
    res.json({
      ok: true,
      data: defs
    });
  } catch (error) {
    console.error('Error listing field definitions:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to list field definitions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/field-defs:
 *   post:
 *     summary: Create or update field definition
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pack_type
 *               - key
 *               - label
 *               - schema_json
 *             properties:
 *               pack_type:
 *                 type: string
 *                 enum: [world, ruleset, npc, scenario]
 *               key:
 *                 type: string
 *               label:
 *                 type: string
 *               group_label:
 *                 type: string
 *               schema_json:
 *                 type: object
 *               default_json:
 *                 type: any
 *               help:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, deprecated]
 *     responses:
 *       200:
 *         description: Field definition created/updated
 */
router.post('/field-defs', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { upsertFieldDef } = await import('../services/field-defs.service.js');
    const userId = req.user?.id;
    
    // Validate schema_json is valid JSON Schema
    const { schema_json } = req.body;
    if (!schema_json || typeof schema_json !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'schema_json must be a valid JSON object'
      });
    }

    // Quick validation: check for required JSON Schema fields
    if (!schema_json.type && !schema_json.$ref) {
      return res.status(400).json({
        ok: false,
        error: 'schema_json must have a type or $ref property'
      });
    }

    const def = await upsertFieldDef({
      ...req.body,
      created_by: userId,
    });
    
    res.json({
      ok: true,
      data: def
    });
  } catch (error) {
    console.error('Error upserting field definition:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to upsert field definition',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/field-defs/{packType}/{key}/deprecate:
 *   post:
 *     summary: Deprecate a field definition
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Field definition deprecated
 */
router.post('/field-defs/:packType/:key/deprecate', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { packType, key } = req.params;
    const { deprecateFieldDef } = await import('../services/field-defs.service.js');
    
    const def = await deprecateFieldDef(packType as any, key);
    
    res.json({
      ok: true,
      data: def
    });
  } catch (error) {
    console.error('Error deprecating field definition:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to deprecate field definition',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/{packType}/{id}/extras:
 *   post:
 *     summary: Save extras for a pack
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               extras:
 *                 type: object
 *     responses:
 *       200:
 *         description: Extras saved successfully
 */
router.post('/:packType/:id/extras', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { packType, id } = req.params;
    const { extras } = req.body;
    
    if (!['world', 'ruleset', 'npc', 'scenario'].includes(packType)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid pack type'
      });
    }

    const { validateExtras, mergeDefaults } = await import('../services/extras.service.js');
    
    // Merge defaults
    const extrasWithDefaults = await mergeDefaults(packType as any, extras);
    
    // Validate
    const validation = await validateExtras(packType as any, extrasWithDefaults);
    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Update pack table
    const tableName = packType === 'world' ? 'worlds' : packType === 'ruleset' ? 'rulesets' : packType === 'npc' ? 'npcs' : 'scenarios';
    
    // Handle world ID mapping if needed
    let updateId = id;
    if (packType === 'world') {
      // Check if id is UUID
      if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const { data: mapping } = await supabase
          .from('world_id_mapping')
          .select('text_id')
          .eq('uuid_id', id)
          .single();
        if (mapping) {
          updateId = mapping.text_id;
        }
      }
    }

    const { data, error } = await supabase
      .from(tableName)
      .update({ extras: extrasWithDefaults })
      .eq('id', updateId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: `${packType} not found`
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    console.error('Error saving extras:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to save extras',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/scenarios/{id}/graph:
 *   get:
 *     summary: Get scenario graph
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scenario graph retrieved
 */
router.get('/scenarios/:id/graph', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { getGraph } = await import('../services/scenario-graph.service.js');
    
    const graph = await getGraph(id);
    
    if (!graph) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found'
      });
    }
    
    res.json({
      ok: true,
      data: graph
    });
  } catch (error) {
    console.error('Error getting scenario graph:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get scenario graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/scenarios/{id}/graph:
 *   put:
 *     summary: Update scenario graph
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scene_graph:
 *                 type: object
 *     responses:
 *       200:
 *         description: Graph updated successfully
 */
router.put('/scenarios/:id/graph', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { scene_graph } = req.body;
    
    if (!scene_graph) {
      return res.status(400).json({
        ok: false,
        error: 'scene_graph is required'
      });
    }

    const { setGraph } = await import('../services/scenario-graph.service.js');
    
    const graph = await setGraph(id, scene_graph);
    
    res.json({
      ok: true,
      data: graph
    });
  } catch (error) {
    console.error('Error updating scenario graph:', error);
    res.status(400).json({
      ok: false,
      error: 'Failed to update scenario graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/scenarios/{id}/graph/reachable:
 *   post:
 *     summary: Compute reachable nodes
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stateSlice:
 *                 type: object
 *     responses:
 *       200:
 *         description: Reachable nodes computed
 */
router.post('/scenarios/:id/graph/reachable', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { stateSlice } = req.body;
    
    const { getGraph, reachableNodes } = await import('../services/scenario-graph.service.js');
    const guardEval = await import('../services/guard-eval.js');
    
    const graph = await getGraph(id);
    
    if (!graph) {
      return res.status(404).json({
        ok: false,
        error: 'Scenario not found'
      });
    }
    
    // Build guard context from stateSlice
    const ctx: guardEval.GuardContext = {
      rel: stateSlice?.rel || {},
      inv: stateSlice?.inv || {},
      currency: stateSlice?.currency || {},
      flag: stateSlice?.flag || {},
      state: stateSlice?.state || {},
    };
    
    const reachable = reachableNodes(graph, ctx);
    
    res.json({
      ok: true,
      data: {
        nodes: reachable
      }
    });
  } catch (error) {
    console.error('Error computing reachable nodes:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to compute reachable nodes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// Modules endpoints
// ============================================================================

/**
 * @swagger
 * /api/admin/modules:
 *   get:
 *     summary: List all modules
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state_slice
 *         schema:
 *           type: string
 *         description: Filter by state slice
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, description
 *     responses:
 *       200:
 *         description: List of modules
 */
router.get('/modules', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { state_slice, search } = req.query;
    
    let query = supabase
      .from('modules')
      .select('id, base_id, version, title, description, state_slice, exports, created_at')
      .order('created_at', { ascending: false });

    if (state_slice) {
      query = query.eq('state_slice', state_slice);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform to include action count
    const transformed = (data || []).map(module => ({
      ...module,
      actionCount: (module.exports as any)?.actions?.length || 0,
    }));

    res.json({
      ok: true,
      data: transformed,
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch modules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/modules/{id}:
 *   get:
 *     summary: Get module detail
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module manifest
 */
router.get('/modules/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Module not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching module:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch module',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/stories/{id}/modules:
 *   get:
 *     summary: Get attached modules for a story
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of attached modules
 */
router.get('/stories/:id/modules', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('story_modules')
      .select(`
        module_id,
        modules (*)
      `)
      .eq('story_id', id);

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: (data || []).map((row: any) => ({
        ...row.modules,
        params: row.params, // Include params in response
      })),
    });
  } catch (error) {
    console.error('Error fetching story modules:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch story modules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/stories/{id}/modules:
 *   post:
 *     summary: Attach a module to a story
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moduleId]
 *             properties:
 *               moduleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Module attached successfully
 */
router.post('/stories/:id/modules', 
  authenticateToken, 
  requireRole('editor'),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), // 30 per hour
  async (req, res) => {
    try {
      const { id } = req.params;
      const { moduleId } = req.body;
      
      if (!moduleId) {
        return res.status(400).json({
          ok: false,
          error: 'moduleId is required'
        });
      }

      // Verify module exists
      const { data: module, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .eq('id', moduleId)
        .single();

      if (moduleError || !module) {
        return res.status(404).json({
          ok: false,
          error: 'Module not found'
        });
      }

      // Validate params if provided
      const { params, params_meta } = req.body;
      if (params) {
        const { validateModuleParams } = await import('../services/module-params.service.js');
        const validation = await validateModuleParams(moduleId, params);
        if (!validation.valid) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid params',
            details: validation.errors,
          });
        }

        // Size guard: reject params > 8KB
        const paramsSize = JSON.stringify(params).length;
        if (paramsSize > 8192) {
          return res.status(400).json({
            ok: false,
            error: 'Params too large (max 8KB)',
          });
        }
      }

      // Insert relationship
      const { error: insertError } = await supabase
        .from('story_modules')
        .insert({
          story_id: id,
          module_id: moduleId,
          params: params || null,
          params_meta: params_meta || null,
        });

      if (insertError) {
        if (insertError.code === '23505') { // Unique violation
          return res.status(409).json({
            ok: false,
            error: 'Module already attached to this story'
          });
        }
        throw insertError;
      }

      res.json({
        ok: true,
        data: { moduleId },
      });
    } catch (error) {
      console.error('Error attaching module:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to attach module',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/stories/{id}/modules/{moduleId}:
 *   delete:
 *     summary: Detach a module from a story
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module detached successfully
 */
router.delete('/stories/:id/modules/:moduleId',
  authenticateToken,
  requireRole('editor'),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), // 30 per hour
  async (req, res) => {
    try {
      const { id, moduleId } = req.params;
      
      const { error } = await supabase
        .from('story_modules')
        .delete()
        .eq('story_id', id)
        .eq('module_id', moduleId);

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data: { moduleId },
      });
    } catch (error) {
      console.error('Error detaching module:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to detach module',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/stories/{id}/modules/{moduleId}:
 *   patch:
 *     summary: Update module params for a story
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               params:
 *                 type: object
 *               params_meta:
 *                 type: object
 *     responses:
 *       200:
 *         description: Params updated successfully
 */
router.patch('/stories/:id/modules/:moduleId',
  authenticateToken,
  requireRole('editor'),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 60 }), // 60 per hour
  async (req, res) => {
    try {
      const { id, moduleId } = req.params;
      const { params, params_meta } = req.body;

      // Validate params if provided
      if (params !== undefined) {
        const { validateModuleParams } = await import('../services/module-params.service.js');
        const validation = await validateModuleParams(moduleId, params);
        if (!validation.valid) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid params',
            details: validation.errors,
          });
        }

        // Size guard
        const paramsSize = JSON.stringify(params).length;
        if (paramsSize > 8192) {
          return res.status(400).json({
            ok: false,
            error: 'Params too large (max 8KB)',
          });
        }
      }

      // Update params
      const updateData: any = {};
      if (params !== undefined) {
        updateData.params = params;
      }
      if (params_meta !== undefined) {
        updateData.params_meta = params_meta;
      }

      const { error } = await supabase
        .from('story_modules')
        .update(updateData)
        .eq('story_id', id)
        .eq('module_id', moduleId);

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data: { moduleId },
      });
    } catch (error) {
      console.error('Error updating module params:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to update module params',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/loadouts:
 *   get:
 *     summary: List all loadouts
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of loadouts
 */
router.get('/loadouts', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('loadouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching loadouts:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch loadouts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/loadouts/{id}:
 *   get:
 *     summary: Get loadout detail
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loadout detail
 */
router.get('/loadouts/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('loadouts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          ok: false,
          error: 'Loadout not found'
        });
      }
      throw error;
    }

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching loadout:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch loadout',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/admin/stories/{id}/apply-loadout:
 *   post:
 *     summary: Apply a loadout to a story
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [loadoutId]
 *             properties:
 *               loadoutId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Loadout applied successfully
 */
router.post('/stories/:id/apply-loadout',
  authenticateToken,
  requireRole('editor'),
  rateLimit({ windowMs: 60 * 60 * 1000, max: 30 }), // 30 per hour
  async (req, res) => {
    try {
      const { id } = req.params;
      const { loadoutId } = req.body;

      if (!loadoutId) {
        return res.status(400).json({
          ok: false,
          error: 'loadoutId is required'
        });
      }

      // Load loadout
      const { data: loadout, error: loadoutError } = await supabase
        .from('loadouts')
        .select('*')
        .eq('id', loadoutId)
        .single();

      if (loadoutError || !loadout) {
        return res.status(404).json({
          ok: false,
          error: 'Loadout not found'
        });
      }

      // Check compatibility
      const modules = loadout.modules as string[];
      const overrides = (loadout.overrides || {}) as Record<string, { params?: Record<string, unknown> }>;
      
      // Check ruleset compatibility for each module
      const compatIssues: string[] = [];
      for (const moduleId of modules) {
        // Extract base_id from moduleId
        const match = moduleId.match(/^module\.(.+)\.v\d+$/);
        if (match) {
          const moduleBaseId = `module.${match[1]}`;
          const { data: compat } = await supabase
            .from('ruleset_module_compat')
            .select('status')
            .eq('ruleset_id', loadout.ruleset_id)
            .eq('module_base_id', moduleBaseId)
            .single();

          if (compat && compat.status === 'forbidden') {
            compatIssues.push(`Module ${moduleId} is forbidden for ruleset ${loadout.ruleset_id}`);
          }
        }
      }

      if (compatIssues.length > 0) {
        return res.status(400).json({
          ok: false,
          error: 'Loadout incompatible with ruleset',
          details: compatIssues,
        });
      }

      // Apply loadout: update ruleset, attach modules, set params
      // Note: This is a simplified implementation; in production you might want transactions
      
      // 1. Update entry_point ruleset (if needed)
      // This would require entry_point_rulesets table updates - simplified for now
      
      // 2. Attach modules and set params
      for (const moduleId of modules) {
        const moduleOverrides = overrides[moduleId];
        
        // Check if already attached
        const { data: existing } = await supabase
          .from('story_modules')
          .select('module_id')
          .eq('story_id', id)
          .eq('module_id', moduleId)
          .single();

        if (existing) {
          // Update params if overrides exist
          if (moduleOverrides?.params) {
            await supabase
              .from('story_modules')
              .update({ params: moduleOverrides.params })
              .eq('story_id', id)
              .eq('module_id', moduleId);
          }
        } else {
          // Insert new attachment
          await supabase
            .from('story_modules')
            .insert({
              story_id: id,
              module_id: moduleId,
              params: moduleOverrides?.params || null,
            });
        }
      }

      res.json({
        ok: true,
        data: { loadoutId },
      });
    } catch (error) {
      console.error('Error applying loadout:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to apply loadout',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/modules/lint:
 *   get:
 *     summary: Lint modules for issues
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: moduleId
 *         schema:
 *           type: string
 *         description: Optional module ID to lint specific module
 *     responses:
 *       200:
 *         description: Lint warnings
 */
router.get('/modules/lint', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { moduleId } = req.query;
    
    const { lintModules } = await import('../services/modules-lint.service.js');
    const warnings = await lintModules(moduleId as string | undefined);

    res.json({
      ok: true,
      data: {
        warnings,
      },
    });
  } catch (error) {
    console.error('Error linting modules:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to lint modules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
