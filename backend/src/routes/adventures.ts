import { Router, type Request, type Response } from 'express';
import { ApiErrorCode, type AdventureDTO } from '@shared';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toAdventureDTO } from '../utils/dto-mappers.js';
import { resolveAdventureByIdentifier } from '../utils/adventure-identity.js';
import { ContentService } from '../services/content.service.js';

const router = Router();

// Get all public adventures
router.get('/', async (req: Request, res: Response) => {
  try {
    const adventures = await ContentService.getAdventures();
    
    if (adventures.length === 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'No adventures available',
        req
      );
    }
    
    const adventureDTOs = adventures.map(toAdventureDTO);
    sendSuccess(res, adventureDTOs, req);
  } catch (error) {
    console.error('Error fetching adventures:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch adventures',
      req
    );
  }
});

// Get a single adventure by slug
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const resolvedAdventure = await resolveAdventureByIdentifier(slug);
    if (!resolvedAdventure) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Adventure not found',
        req
      );
    }

    const world =
      (await ContentService.getWorldBySlug(resolvedAdventure.worldSlug)) ?? null;

    const adventureDTO: AdventureDTO = {
      id: resolvedAdventure.id,
      slug: resolvedAdventure.slug,
      title: resolvedAdventure.title,
      description: resolvedAdventure.description ?? '',
      worldSlug: resolvedAdventure.worldSlug,
      worldName: world?.name ?? world?.title ?? resolvedAdventure.worldSlug,
      tags: resolvedAdventure.tags,
      scenarios: resolvedAdventure.scenarios,
    };

    sendSuccess(res, adventureDTO, req);
  } catch (error) {
    console.error('Error fetching adventure by slug:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch adventure',
      req
    );
  }
});

// Get a single adventure by ID (UUID) or slug
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const resolvedAdventure = await resolveAdventureByIdentifier(id);
    if (!resolvedAdventure) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Adventure not found',
        req
      );
    }

    const world =
      (await ContentService.getWorldBySlug(resolvedAdventure.worldSlug)) ?? null;

    const adventureDTO: AdventureDTO = {
      id: resolvedAdventure.id,
      slug: resolvedAdventure.slug,
      title: resolvedAdventure.title,
      description: resolvedAdventure.description ?? '',
      worldSlug: resolvedAdventure.worldSlug,
      worldName: world?.name ?? world?.title ?? resolvedAdventure.worldSlug,
      tags: resolvedAdventure.tags,
      scenarios: resolvedAdventure.scenarios,
    };

    sendSuccess(res, adventureDTO, req);
  } catch (error) {
    console.error('Error fetching adventure:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch adventure',
      req
    );
  }
});

export default router;
