import express from 'express';
import type { Request, Response } from 'express';
import { CreateCharacterRequestSchema, UpdateCharacterRequestSchema, IdParamSchema } from 'shared';
import { z } from 'zod';
import { aiService } from '../services/ai.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toCharacterDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiErrorCode } from 'shared';
import { CharactersService } from '../services/characters.service.js';

const router = express.Router();

// Get all characters for a user (guest or authenticated)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest || false;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const characters = await CharactersService.getCharacters(userId, isGuest);
    const characterDTOs = characters.map(toCharacterDTO);
    
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
    const isGuest = req.ctx?.isGuest || false;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const character = await CharactersService.getCharacterById(id, userId, isGuest);
    
    if (!character) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Character not found',
        req
      );
    }

    const characterDTO = toCharacterDTO(character);
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
    const isGuest = req.ctx?.isGuest || false;
    
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const character = await CharactersService.createCharacter(req.body, userId, isGuest);
    const characterDTO = toCharacterDTO(character);
    
    sendSuccess(res, characterDTO, req, 201);
  } catch (error) {
    console.error('Error creating character:', error);
    
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('Invalid world slug')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        error.message,
        req
      );
    }
    
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
    const isGuest = req.ctx?.isGuest || false;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const character = await CharactersService.updateCharacter(id, req.body, userId, isGuest);
    
    if (!character) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Character not found',
        req
      );
    }

    const characterDTO = toCharacterDTO(character);
    sendSuccess(res, characterDTO, req);
  } catch (error) {
    console.error('Error updating character:', error);
    
    // Handle validation errors specifically
    if (error instanceof Error && error.message.includes('Invalid world slug')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        error.message,
        req
      );
    }
    
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
    const isGuest = req.ctx?.isGuest || false;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User authentication required',
        req
      );
    }

    const success = await CharactersService.deleteCharacter(id, userId, isGuest);
    
    if (!success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Character not found',
        req
      );
    }
    
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
