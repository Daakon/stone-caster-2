import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { GameSaveSchema, CreateGameRequestSchema, GameTurnRequestSchema, IdParamSchema } from 'shared';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toGameDTO } from '../utils/dto-mappers.js';
import { validateRequest, requireIdempotencyKey } from '../middleware/validation.js';
import { optionalAuth, jwtAuth, requireAuth } from '../middleware/auth.js';
import { ApiErrorCode } from 'shared';

const router = express.Router();

// Get all game saves for a user (auth only)
router.get('/', jwtAuth, requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;

    const { data, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('userId', userId)
      .order('lastPlayedAt', { ascending: false });

    if (error) throw error;
    
    const gameDTOs = data?.map(toGameDTO) || [];
    sendSuccess(res, gameDTOs, req);
  } catch (error) {
    console.error('Error fetching game saves:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch game saves',
      req
    );
  }
});

// Get a single game save
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
      .from('game_saves')
      .select('*')
      .eq('id', id)
      .eq('userId', userId)
      .single();

    if (error) throw error;
    if (!data) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game save not found',
        req
      );
    }

    const gameDTO = toGameDTO(data);
    sendSuccess(res, gameDTO, req);
  } catch (error) {
    console.error('Error fetching game save:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch game save',
      req
    );
  }
});

// Create a new game save
router.post('/', optionalAuth, validateRequest(CreateGameRequestSchema, 'body'), async (req: Request, res: Response) => {
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
    
    const gameDTO = toGameDTO(data);
    sendSuccess(res, gameDTO, req, 201);
  } catch (error) {
    console.error('Error creating game save:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create game save',
      req
    );
  }
});

// Update a game save
router.put('/:id', optionalAuth, validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
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
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game save not found',
        req
      );
    }

    const gameDTO = toGameDTO(data);
    sendSuccess(res, gameDTO, req);
  } catch (error) {
    console.error('Error updating game save:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to update game save',
      req
    );
  }
});

// Delete a game save
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
      .from('game_saves')
      .delete()
      .eq('id', id)
      .eq('userId', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game save:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to delete game save',
      req
    );
  }
});

// Submit a game turn
router.post('/:id/turn', optionalAuth, validateRequest(IdParamSchema, 'params'), validateRequest(GameTurnRequestSchema, 'body'), requireIdempotencyKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;
    const userId = req.ctx?.userId;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    // Mock turn processing - in real implementation, this would process the turn
    const turnResult = {
      gameId: id,
      optionId,
      result: 'Turn processed successfully',
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, turnResult, req);
  } catch (error) {
    console.error('Error processing game turn:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to process game turn',
      req
    );
  }
});

// Get game relationships
router.get('/:id/relationships', optionalAuth, validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
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

    // Mock relationships data - in real implementation, this would come from database
    const relationships = {
      npcs: [
        { id: 'npc-1', name: 'Barkeep', relationship: 50 },
        { id: 'npc-2', name: 'Mysterious Stranger', relationship: -20 },
      ],
    };

    sendSuccess(res, relationships, req);
  } catch (error) {
    console.error('Error fetching game relationships:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch game relationships',
      req
    );
  }
});

// Get game factions
router.get('/:id/factions', optionalAuth, validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
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

    // Mock factions data - in real implementation, this would come from database
    const factions = {
      factions: [
        { id: 'faction-1', name: 'Town Guard', reputation: 75 },
        { id: 'faction-2', name: 'Thieves Guild', reputation: -30 },
      ],
    };

    sendSuccess(res, factions, req);
  } catch (error) {
    console.error('Error fetching game factions:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch game factions',
      req
    );
  }
});

export default router;
