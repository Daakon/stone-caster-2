/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrative API endpoints for content management
 */

import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
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
    const { name, description, status = 'draft', prompt } = req.body;
    
    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'Name is required'
      });
    }

    // Generate UUIDs
    const worldId = crypto.randomUUID();
    const uuidId = crypto.randomUUID();

    // Generate a slug from the name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data: result, error } = await supabase
      .from('worlds')
      .insert({
        id: worldId,
        name: name,
        slug: slug,
        description: description,
        status: status,
        version: 1,
        doc: prompt || {} // Store prompt directly as JSONB
      })
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
    
    const { data, error } = await supabase
      .from('worlds_admin')
      .select('*')
      .eq('id', id)
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
      .eq('id', mapping.text_id)
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

    const insertData: any = {
      name,
      description,
      status
    };

    if (finalSlug) {
      insertData.slug = finalSlug;
    }

    if (prompt) {
      insertData.prompt = prompt;
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

    if (world_id) {
      query = query.eq('world_id', world_id);
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

    res.json({
      ok: true,
      data: data || [],
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
    
    const { data, error } = await supabase
      .from('entry_points')
      .select('*')
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

    res.json({
      ok: true,
      data
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
    const { name, slug, type, world_id, rulesetIds, title, subtitle, description, synopsis, tags, visibility, content_rating, prompt, entry_id } = req.body;
    
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
        prompt,
        entry_id
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

export default router;
