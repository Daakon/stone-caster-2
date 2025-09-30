import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { GameSaveSchema } from 'shared';

const router = express.Router();

// Get all game saves for a user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('userId', userId)
      .order('lastPlayedAt', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching game saves:', error);
    res.status(500).json({ error: 'Failed to fetch game saves' });
  }
});

// Get a single game save
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { data, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('id', id)
      .eq('userId', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Game save not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching game save:', error);
    res.status(500).json({ error: 'Failed to fetch game save' });
  }
});

// Create a new game save
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const gameSaveData = GameSaveSchema.parse({
      ...req.body,
      userId,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('game_saves')
      .insert([gameSaveData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating game save:', error);
    res.status(500).json({ error: 'Failed to create game save' });
  }
});

// Update a game save
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { data, error } = await supabase
      .from('game_saves')
      .update({
        ...req.body,
        updatedAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Game save not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating game save:', error);
    res.status(500).json({ error: 'Failed to update game save' });
  }
});

// Delete a game save
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { error } = await supabase
      .from('game_saves')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game save:', error);
    res.status(500).json({ error: 'Failed to delete game save' });
  }
});

export default router;
