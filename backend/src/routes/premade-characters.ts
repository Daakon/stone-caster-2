import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode, PremadeCharacterQuerySchema } from 'shared';
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

    // Validate world slug exists
    const worldValidation = await WorldValidationService.validateWorldSlug(world);
    if (!worldValidation.isValid) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        `World '${world}' not found or has no premade characters`,
        req
      );
    }

    // For now, return mock data since Supabase isn't configured
    // TODO: Replace with actual database call when Supabase is configured
    const mockPremadeCharacters = [
      {
        id: 'mock-1',
        worldSlug: world,
        archetypeKey: 'elven-court-guardian',
        displayName: 'Thorne Shifter',
        summary: 'A noble guardian of the elven courts, bound by ancient oaths to protect the realm.',
        avatarUrl: null,
        baseTraits: {
          class: 'shifter_warden',
          faction_alignment: 'shifter_tribes',
          crystal_affinity: 'nature_bond',
          personality_traits: ['wild', 'protective', 'intuitive']
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mock-2',
        worldSlug: world,
        archetypeKey: 'crystalborn-scholar',
        displayName: 'Lysara Brightmind',
        summary: 'A brilliant scholar who studies the mysteries of the Veil and its effects on reality.',
        avatarUrl: null,
        baseTraits: {
          class: 'crystalborn_scholar',
          faction_alignment: 'crystalborn_academy',
          crystal_affinity: 'knowledge_seeker',
          personality_traits: ['curious', 'analytical', 'determined']
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    sendSuccess(res, mockPremadeCharacters, req);
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
