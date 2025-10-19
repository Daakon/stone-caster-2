/**
 * AWF Mechanics Admin Routes
 * CRUD operations for mechanics registries
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const SkillSchema = z.object({
  id: z.string().min(1).max(50),
  description: z.string().min(1).max(200),
  baseline: z.number().min(0).max(100),
  tags: z.array(z.string()).optional(),
});

const ConditionSchema = z.object({
  id: z.string().min(1).max(50),
  stacking: z.enum(['none', 'add', 'cap']),
  cap: z.number().min(1).max(10).optional(),
  cleanseKeys: z.array(z.string()).optional(),
  tickHooks: z.object({
    resourceDeltas: z.array(z.object({
      key: z.string(),
      delta: z.number(),
    })).optional(),
  }).optional(),
});

const ResourceSchema = z.object({
  id: z.string().min(1).max(50),
  minValue: z.number().min(0),
  maxValue: z.number().min(1),
  regenPerTick: z.number().min(0).max(100),
  decayPerTick: z.number().min(0).max(100),
});

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', req.user?.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * SKILLS ROUTES
 */

// GET /api/admin/awf/mechanics/skills
router.get('/mechanics/skills', async (req, res) => {
  try {
    const { data: skills, error } = await supabase
      .from('mechanics_skills')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch skills' });
    }

    res.json({ skills: skills || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/mechanics/skills
router.post('/mechanics/skills', async (req, res) => {
  try {
    const skillData = SkillSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_skills')
      .insert({
        id: skillData.id,
        description: skillData.description,
        baseline: skillData.baseline,
        tags: skillData.tags || [],
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create skill' });
    }

    res.json({ skill: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid skill data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/mechanics/skills/:id
router.put('/mechanics/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const skillData = SkillSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_skills')
      .update({
        description: skillData.description,
        baseline: skillData.baseline,
        tags: skillData.tags || [],
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update skill' });
    }

    res.json({ skill: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid skill data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/mechanics/skills/:id
router.delete('/mechanics/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('mechanics_skills')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete skill' });
    }

    res.json({ success: true, message: 'Skill deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * CONDITIONS ROUTES
 */

// GET /api/admin/awf/mechanics/conditions
router.get('/mechanics/conditions', async (req, res) => {
  try {
    const { data: conditions, error } = await supabase
      .from('mechanics_conditions')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch conditions' });
    }

    res.json({ conditions: conditions || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/mechanics/conditions
router.post('/mechanics/conditions', async (req, res) => {
  try {
    const conditionData = ConditionSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_conditions')
      .insert({
        id: conditionData.id,
        stacking: conditionData.stacking,
        cap: conditionData.cap,
        cleanse_keys: conditionData.cleanseKeys || [],
        tick_hooks: conditionData.tickHooks || {},
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create condition' });
    }

    res.json({ condition: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid condition data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/mechanics/conditions/:id
router.put('/mechanics/conditions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conditionData = ConditionSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_conditions')
      .update({
        stacking: conditionData.stacking,
        cap: conditionData.cap,
        cleanse_keys: conditionData.cleanseKeys || [],
        tick_hooks: conditionData.tickHooks || {},
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update condition' });
    }

    res.json({ condition: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid condition data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/mechanics/conditions/:id
router.delete('/mechanics/conditions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('mechanics_conditions')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete condition' });
    }

    res.json({ success: true, message: 'Condition deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * RESOURCES ROUTES
 */

// GET /api/admin/awf/mechanics/resources
router.get('/mechanics/resources', async (req, res) => {
  try {
    const { data: resources, error } = await supabase
      .from('mechanics_resources')
      .select('*')
      .order('id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch resources' });
    }

    res.json({ resources: resources || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/awf/mechanics/resources
router.post('/mechanics/resources', async (req, res) => {
  try {
    const resourceData = ResourceSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_resources')
      .insert({
        id: resourceData.id,
        min_value: resourceData.minValue,
        max_value: resourceData.maxValue,
        regen_per_tick: resourceData.regenPerTick,
        decay_per_tick: resourceData.decayPerTick,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to create resource' });
    }

    res.json({ resource: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid resource data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/awf/mechanics/resources/:id
router.put('/mechanics/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resourceData = ResourceSchema.parse(req.body);

    const { data, error } = await supabase
      .from('mechanics_resources')
      .update({
        min_value: resourceData.minValue,
        max_value: resourceData.maxValue,
        regen_per_tick: resourceData.regenPerTick,
        decay_per_tick: resourceData.decayPerTick,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update resource' });
    }

    res.json({ resource: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid resource data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/awf/mechanics/resources/:id
router.delete('/mechanics/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('mechanics_resources')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete resource' });
    }

    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


