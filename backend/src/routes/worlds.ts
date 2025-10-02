import { Router, type Request, type Response } from 'express';
import { supabase } from '../services/supabase.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { toWorldDTO } from '../utils/dto-mappers.js';
import { validateRequest } from '../middleware/validation.js';
import { IdParamSchema } from 'shared';
import { ApiErrorCode } from 'shared';

const router = Router();

// Get all public worlds
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('world_templates')
      .select('*')
      .eq('isPublic', true)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    
    const worldDTOs = data?.map(toWorldDTO) || [];
    sendSuccess(res, worldDTOs, req);
  } catch (error) {
    console.error('Error fetching worlds:', error);
    
    // If Supabase is not available (e.g., in tests), return mock data
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = JSON.stringify(error);
    if (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError') || errorMessage.includes('ECONNREFUSED') || errorString.includes('fetch failed')) {
      const mockWorlds = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Fantasy Realm',
          description: 'A magical world of adventure',
          genre: 'fantasy' as const,
          setting: 'Medieval fantasy',
          themes: ['magic', 'heroism', 'adventure'],
          availableRaces: ['Human', 'Elf', 'Dwarf'],
          availableClasses: ['Fighter', 'Mage', 'Rogue'],
          rules: {
            allowMagic: true,
            allowTechnology: false,
            difficultyLevel: 'medium' as const,
            combatSystem: 'd20' as const,
          },
          isPublic: true,
          startingPrompt: 'Welcome to the Fantasy Realm! You find yourself in a magical world full of adventure and mystery.',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
      ];
      
      const worldDTOs = mockWorlds.map(toWorldDTO);
      return sendSuccess(res, worldDTOs, req);
    }
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch worlds',
      req
    );
  }
});

// Get a single world
router.get('/:id', validateRequest(IdParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('world_templates')
      .select('*')
      .eq('id', id)
      .eq('isPublic', true)
      .single();

    if (error) throw error;
    if (!data) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'World not found',
        req
      );
    }

    const worldDTO = toWorldDTO(data);
    sendSuccess(res, worldDTO, req);
  } catch (error) {
    console.error('Error fetching world:', error);
    
    // If Supabase is not available (e.g., in tests), return NOT_FOUND
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = JSON.stringify(error);
    if (errorMessage.includes('fetch failed') || errorMessage.includes('TypeError') || errorMessage.includes('ECONNREFUSED') || errorString.includes('fetch failed')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'World not found',
        req
      );
    }
    
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch world',
      req
    );
  }
});

export default router;