import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { CharacterSchema } from 'shared';
import { aiService } from '../services/ai.js';

const router = express.Router();

// Get all characters for a user
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

// Get a single character
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .eq('userId', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: 'Failed to fetch character' });
  }
});

// Create a new character
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const characterData = CharacterSchema.parse({
      ...req.body,
      userId,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('characters')
      .insert([characterData])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// Update a character
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { data, error } = await supabase
      .from('characters')
      .update({
        ...req.body,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Delete a character
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting character:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// Generate character suggestions
router.post('/suggest', async (req: Request, res: Response) => {
  try {
    const { race, class: characterClass } = req.body;
    
    if (!race || !characterClass) {
      return res.status(400).json({ error: 'Race and class are required' });
    }

    const suggestions = await aiService.generateCharacterSuggestions(race, characterClass);
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating character suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

export default router;
