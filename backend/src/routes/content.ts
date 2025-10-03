import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from 'shared';
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

// Transform world data to match expected DTO structure
function transformWorldToDTO(world: any, adventures: any[]) {
  // Filter adventures for this world
  const worldAdventures = adventures
    .filter(adventure => adventure.worldId === world.id)
    .map(transformAdventureToDTO);

  return {
    slug: world.id,
    name: world.title,
    rules: world.rules,
    tags: world.tags,
    adventures: worldAdventures,
  };
}

// GET /api/content/worlds - Static content endpoint
router.get('/worlds', async (req: Request, res: Response) => {
  try {
    const staticWorlds = loadStaticWorlds();
    const staticAdventures = loadStaticAdventures();
    
    if (staticWorlds.length === 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to load world content',
        req
      );
    }

    // Transform to DTO format
    const worldDTOs = staticWorlds.map((world: any) => transformWorldToDTO(world, staticAdventures));
    
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
