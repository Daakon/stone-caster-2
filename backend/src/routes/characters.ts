import express from 'express';
import type { Request, Response } from 'express';
import { CreateCharacterRequestSchema, CreateCharacterLegacyRequestSchema, UpdateCharacterRequestSchema, IdParamSchema } from '@shared';
import { z } from 'zod';
import { aiService } from '../services/ai.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toCharacterDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { optionalAuth } from '../middleware/auth.js';
import { ApiErrorCode } from '@shared';
import { CharactersService } from '../services/characters.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/characters:
 *   get:
 *     summary: Get all characters for a user
 *     description: Retrieves all characters for the authenticated user or guest
 *     tags: [Characters]
 *     security:
 *       - BearerAuth: []
 *       - GuestCookie: []
 *     parameters:
 *       - in: query
 *         name: world
 *         schema:
 *           type: string
 *         description: Filter characters by world slug
 *         example: mystika
 *     responses:
 *       200:
 *         description: List of characters
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
 *                         $ref: '#/components/schemas/Character'
 *       401:
 *         description: Unauthorized
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

    // Check if world filter is provided
    const worldSlug = req.query.world as string;
    const options = worldSlug ? { worldSlug } : {};

    const characters = await CharactersService.getCharacters(userId, isGuest, options);
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
/**
 * @swagger
 * /api/characters:
 *   post:
 *     summary: Create a new character
 *     description: Creates a new character for the authenticated user or guest. Supports both generic worldData format and legacy D&D-style format.
 *     tags: [Characters]
 *     security:
 *       - BearerAuth: []
 *       - GuestCookie: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCharacterRequest'
 *           examples:
 *             premade:
 *               summary: Create from premade character
 *               value:
 *                 worldSlug: mystika
 *                 archetypeKey: elven-court-guardian
 *                 name: Thorne Shifter
 *                 fromPremade: true
 *             custom:
 *               summary: Create custom character with worldData
 *               value:
 *                 worldSlug: mystika
 *                 name: Daakon
 *                 worldData:
 *                   class: shifter_warden
 *                   faction_alignment: shifter_tribes
 *                   backstory: A mysterious wanderer
 *                   crystal_affinity: nature_bond
 *                   personality_traits: [wild, protective, intuitive]
 *             legacy:
 *               summary: Create legacy D&D-style character
 *               value:
 *                 worldSlug: mystika
 *                 name: Aragorn
 *                 race: Human
 *                 class: Ranger
 *                 level: 1
 *                 experience: 0
 *                 attributes:
 *                   strength: 14
 *                   dexterity: 16
 *                   constitution: 13
 *                   intelligence: 12
 *                   wisdom: 15
 *                   charisma: 10
 *                 skills: [archery, survival, stealth]
 *                 inventory: []
 *                 currentHealth: 100
 *                 maxHealth: 100
 *     responses:
 *       201:
 *         description: Character created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Character'
 *       400:
 *         description: Validation failed
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
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

    // Determine which schema to use based on the request body
    const isNewFormat = req.body.worldSlug && (req.body.fromPremade !== undefined || req.body.archetypeKey || req.body.worldData);
    
    let character;
    if (isNewFormat) {
      // New format: create from premade or custom
      const validationResult = CreateCharacterRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request data',
          req,
          validationResult.error.errors
        );
      }

      const { worldSlug, name, archetypeKey, fromPremade, worldData, ...legacyFields } = validationResult.data as any;

      if (fromPremade && archetypeKey) {
        // Create from premade
        character = await CharactersService.createCharacterFromPremade(
          { worldSlug, name, archetypeKey, fromPremade },
          userId,
          isGuest
        );
      } else if (worldData) {
        // Create custom character with new generic format
        const genericInput = {
          name: name || 'Custom Character',
          worldSlug,
          worldData,
          // Include any legacy fields that were provided
          ...legacyFields,
        };
        character = await CharactersService.createCharacter(genericInput, userId, isGuest);
      } else {
        // Create custom character (fallback to legacy format with minimal data)
        const legacyInput = {
          name: name || 'Custom Character',
          race: 'Custom',
          class: 'Adventurer',
          level: 1,
          experience: 0,
          attributes: {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
          },
          skills: [],
          inventory: [],
          worldSlug,
        };
        character = await CharactersService.createCharacter(legacyInput, userId, isGuest);
      }
    } else {
      // Legacy format: full character creation
      const validationResult = CreateCharacterLegacyRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request data',
          req,
          validationResult.error.errors
        );
      }

      character = await CharactersService.createCharacter(req.body, userId, isGuest);
    }
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
