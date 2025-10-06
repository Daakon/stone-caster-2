import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toAdventureDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { IdParamSchema } from '@shared';
import { ApiErrorCode } from '@shared';

const router = Router();

// Get all public adventures
router.get('/', async (req: Request, res: Response) => {
  try {
    // Load static adventure data from content service
    const { ContentService } = await import('../services/content.service.js');
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

// Get a single adventure by ID
router.get('/:id', validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Load static adventure data from content service
    const { ContentService } = await import('../services/content.service.js');
    const adventures = await ContentService.getAdventures();
    
    const adventure = adventures.find((a: any) => a.id === id);
    if (!adventure) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Adventure not found',
        req
      );
    }

    const adventureDTO = toAdventureDTO(adventure);
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

// Get a single adventure by slug
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Load static adventure data from content service
    const { ContentService } = await import('../services/content.service.js');
    const adventures = await ContentService.getAdventures();
    
    const adventure = adventures.find((a: any) => a.slug === slug);
    if (!adventure) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Adventure not found',
        req
      );
    }

    const adventureDTO = toAdventureDTO(adventure);
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

export default router;
