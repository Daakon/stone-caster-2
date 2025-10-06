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
    // Mock adventure data - in real implementation, this would come from database
    const adventures = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        worldId: '456e7890-e89b-12d3-a456-426614174001',
        name: 'The Tavern Mystery',
        description: 'A mysterious adventure that begins in a tavern',
        startingPrompt: 'You find yourself in a dimly lit tavern...',
        isPublic: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
    ];
    
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

// Get a single adventure
router.get('/:id', validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mock adventure data - in real implementation, this would come from database
    const adventure = {
      id,
      worldId: '456e7890-e89b-12d3-a456-426614174001',
      name: 'The Tavern Mystery',
      description: 'A mysterious adventure that begins in a tavern',
      startingPrompt: 'You find yourself in a dimly lit tavern...',
      isPublic: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

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

export default router;
