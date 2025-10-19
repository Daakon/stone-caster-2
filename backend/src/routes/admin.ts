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
const PromptSchema = z.object({
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

const UpdatePromptSchema = PromptSchema.partial();

// Get all prompts with filtering
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

export default router;
