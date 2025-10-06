import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode, PremadeCharacterQuerySchema } from '@shared';
import { PremadeCharactersService } from '../services/premade-characters.service.js';
import { WorldValidationService } from '../services/worldValidation.service.js';

const router = Router();

/**
 * @swagger
 * /api/premades:
 *   get:
 *     summary: Get premade characters for a world
 *     description: Retrieves all active premade characters for a specific world
 *     tags: [Premade Characters]
 *     parameters:
 *       - in: query
 *         name: world
 *         required: true
 *         schema:
 *           type: string
 *         description: World slug to get premade characters for
 *         example: mystika
 *     responses:
 *       200:
 *         description: List of premade characters
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
 *                         $ref: '#/components/schemas/PremadeCharacter'
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: World not found or has no premade characters
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
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = PremadeCharacterQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req,
        validationResult.error.errors
      );
    }

    const { world } = validationResult.data;

    // Validate world slug exists by checking if it has premade characters
    const hasPremadeCharacters = await PremadeCharactersService.validateWorldSlug(world);
    if (!hasPremadeCharacters) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        `World '${world}' not found or has no premade characters`,
        req
      );
    }

    // Layer M1: Use live Supabase data instead of mock data
    const premadeCharacters = await PremadeCharactersService.getPremadeCharactersByWorld(world);
    
    if (premadeCharacters.length === 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        `World '${world}' has no premade characters available`,
        req
      );
    }

    sendSuccess(res, premadeCharacters, req);
  } catch (error) {
    console.error('Error fetching premade characters:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

export default router;
