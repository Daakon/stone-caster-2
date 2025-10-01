import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { CharacterSchema, CreateCharacterRequestSchema, UpdateCharacterRequestSchema, IdParamSchema } from 'shared';
import { z } from 'zod';
import { aiService } from '../services/ai.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toCharacterDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiErrorCode } from 'shared';

const router = express.Router();

// Get all characters for a user
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    
    const characterDTOs = data?.map(toCharacterDTO) || [];
    sendSuccess(res, characterDTOs, req);
  } catch (error) {
    console.error('Error fetching characters:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch characters',
      req
    );
  }
});

// Get a single character
router.get('/:id', optionalAuth, validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .eq('userId', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Character not found',
        req
      );
    }

    const characterDTO = toCharacterDTO(data);
    sendSuccess(res, characterDTO, req);
  } catch (error) {
    console.error('Error fetching character:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch character',
      req
    );
  }
});

// Create a new character
router.post('/', optionalAuth, validateRequest(CreateCharacterRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
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
    
    const characterDTO = toCharacterDTO(data);
    sendSuccess(res, characterDTO, req, 201);
  } catch (error) {
    console.error('Error creating character:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create character',
      req
    );
  }
});

// Update a character
router.patch('/:id', optionalAuth, validateRequest(IdParamSchema, 'params'), validateRequest(UpdateCharacterRequestSchema, 'body'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

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
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Character not found',
        req
      );
    }

    const characterDTO = toCharacterDTO(data);
    sendSuccess(res, characterDTO, req);
  } catch (error) {
    console.error('Error updating character:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to update character',
      req
    );
  }
});

// Delete a character
router.delete('/:id', optionalAuth, validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting character:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to delete character',
      req
    );
  }
});

// Generate character suggestions
router.post('/suggest', validateRequest(z.object({
  race: z.string().min(1),
  class: z.string().min(1),
}), 'body'), async (req: Request, res: Response) => {
  try {
    const { race, class: characterClass } = req.body;

    const suggestions = await aiService.generateCharacterSuggestions(race, characterClass);
    sendSuccess(res, suggestions, req);
  } catch (error) {
    console.error('Error generating character suggestions:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to generate suggestions',
      req
    );
  }
});

export default router;
