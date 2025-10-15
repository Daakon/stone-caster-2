import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

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

// Schema for prompt creation/update
const PromptSchema = z.object({
  layer: z.enum(['foundation', 'core', 'engine', 'ai_behavior', 'data_management', 'performance', 'content', 'enhancement']),
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
      .from('prompts')
      .select('*')
      .order('layer', { ascending: true })
      .order('sort_order', { ascending: true });

    // Apply filters
    if (layer) query = query.eq('layer', layer);
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
      data: data || [],
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
router.get('/prompts/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompts')
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
      data
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
      .from('prompts')
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
      data
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
router.put('/prompts/:id', authenticateToken, requireAdminRole, async (req, res) => {
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
      .from('prompts')
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
    const updateData: any = { ...validatedData };
    if (validatedData.metadata) {
      updateData.metadata = JSON.stringify(validatedData.metadata);
    }

    const { data, error } = await supabase
      .from('prompts')
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
});

// Delete prompt
router.delete('/prompts/:id', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if prompt exists and is not locked
    const { data: existingPrompt, error: fetchError } = await supabase
      .from('prompts')
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
      .from('prompts')
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
router.patch('/prompts/:id/toggle-active', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get current status
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('prompts')
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
      .from('prompts')
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
      data
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
router.patch('/prompts/:id/toggle-locked', authenticateToken, requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get current status
    const { data: currentPrompt, error: fetchError } = await supabase
      .from('prompts')
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
      .from('prompts')
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
      data
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
      .from('prompts')
      .update(updateData)
      .in('id', promptIds)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      ok: true,
      data,
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

export default router;
