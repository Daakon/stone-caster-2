import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { WorldTemplateSchema } from 'shared';

const router = express.Router();

// Get all public world templates + user's private templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    let query = supabase
      .from('world_templates')
      .select('*');

    if (userId) {
      query = query.or(`isPublic.eq.true,createdBy.eq.${userId}`);
    } else {
      query = query.eq('isPublic', true);
    }

    const { data, error } = await query.order('createdAt', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching world templates:', error);
    res.status(500).json({ error: 'Failed to fetch world templates' });
  }
});

// Get a single world template
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('world_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'World template not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching world template:', error);
    res.status(500).json({ error: 'Failed to fetch world template' });
  }
});

// Create a new world template
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const templateData = WorldTemplateSchema.parse({
      ...req.body,
      id: crypto.randomUUID(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('world_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating world template:', error);
    res.status(500).json({ error: 'Failed to create world template' });
  }
});

// Update a world template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { data, error } = await supabase
      .from('world_templates')
      .update({
        ...req.body,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('createdBy', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'World template not found or unauthorized' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating world template:', error);
    res.status(500).json({ error: 'Failed to update world template' });
  }
});

// Delete a world template
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { error } = await supabase
      .from('world_templates')
      .delete()
      .eq('id', id)
      .eq('createdBy', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting world template:', error);
    res.status(500).json({ error: 'Failed to delete world template' });
  }
});

export default router;
