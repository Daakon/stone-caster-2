import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode, ContentWorldDTO } from '@shared';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Load static world data
function loadStaticWorlds() {
  try {
    // Path to the frontend mock data
    const worldsPath = join(__dirname, '../../../frontend/src/mock/worlds.json');
    const worldsData = readFileSync(worldsPath, 'utf-8');
    return JSON.parse(worldsData);
  } catch (error) {
    console.error('Error loading static worlds data:', error);
    return [];
  }
}

// Load static adventure data
function loadStaticAdventures() {
  try {
    // Path to the frontend mock data
    const adventuresPath = join(__dirname, '../../../frontend/src/mock/adventures.json');
    const adventuresData = readFileSync(adventuresPath, 'utf-8');
    return JSON.parse(adventuresData);
  } catch (error) {
    console.error('Error loading static adventures data:', error);
    return [];
  }
}

// Transform adventure data to match expected DTO structure
function transformAdventureToDTO(adventure: any) {
  return {
    slug: adventure.id,
    name: adventure.title,
    tags: adventure.tags,
    scenarios: adventure.scenarios.map((scenario: string, index: number) => ({
      slug: `${adventure.id}-scenario-${index + 1}`,
      name: scenario,
    })),
  };
}

// Transform world data to match Layer M0 ContentWorldDTO structure
function transformWorldToContentDTO(world: any): ContentWorldDTO {
  return {
    title: world.title,
    slug: world.id,
    tags: world.tags || [],
    scenarios: world.scenarios || [],
    displayRules: {
      allowMagic: world.rules?.allowMagic ?? true,
      allowTechnology: world.rules?.allowTechnology ?? false,
      difficultyLevel: world.rules?.difficultyLevel ?? 'medium',
      combatSystem: world.rules?.combatSystem ?? 'd20',
    },
  };
}

// GET /api/content/worlds - Layer M0: Static content endpoint with proper DTO and traceId
router.get('/worlds', async (req: Request, res: Response) => {
  try {
    const staticWorlds = loadStaticWorlds();
    
    if (staticWorlds.length === 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to load world content',
        req
      );
    }

    // Transform to Layer M0 ContentWorldDTO format
    const worldDTOs: ContentWorldDTO[] = staticWorlds.map((world: any) => transformWorldToContentDTO(world));
    
    // Layer M0: Always carries traceId in response envelope
    sendSuccess(res, worldDTOs, req);
  } catch (error) {
    console.error('Error fetching content worlds:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch world content',
      req
    );
  }
});

export default router;
