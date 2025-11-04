import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode, ContentWorldDTO } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Load static adventure data
function loadStaticAdventures() {
  try {
    // Path to the frontend mock data - try multiple possible locations
    const possiblePaths = [
      join(__dirname, '../../../frontend/src/mock/adventures.json'), // From backend/dist/routes
      join(__dirname, '../../../../frontend/src/mock/adventures.json'), // From backend/dist
      join(process.cwd(), 'frontend/src/mock/adventures.json'), // From project root
      join(process.cwd(), '../frontend/src/mock/adventures.json'), // From backend directory
    ];
    
    let adventuresPath = '';
    for (const path of possiblePaths) {
      try {
        readFileSync(path, 'utf-8');
        adventuresPath = path;
        break;
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!adventuresPath) {
      throw new Error(`Could not find adventures.json in any of the expected locations: ${possiblePaths.join(', ')}`);
    }
    
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


// GET /api/content/worlds - Layer M0: Content endpoint with proper DTO and traceId
// Loads from database (worlds table) instead of static files for production compatibility
router.get('/worlds', async (req: Request, res: Response) => {
  try {
    // Query active worlds from database
    const { data: worldsData, error } = await supabaseAdmin
      .from('worlds')
      .select('id, version, name, description, status, doc, created_at, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[content/worlds] Database error:', error);
      throw error;
    }

    if (!worldsData || worldsData.length === 0) {
      // Return empty array instead of error - no worlds available yet
      return sendSuccess(res, [], req);
    }

    // Transform database worlds to Layer M0 ContentWorldDTO format
    const worldDTOs: ContentWorldDTO[] = worldsData.map((world: any) => {
      const doc = (world.doc as Record<string, any>) || {};
      return {
        title: world.name || doc.title || world.id,
        slug: doc.slug || world.id,
        tags: doc.tags || [],
        scenarios: doc.scenarios || [],
        displayRules: {
          allowMagic: doc.rules?.allowMagic ?? true,
          allowTechnology: doc.rules?.allowTechnology ?? false,
          difficultyLevel: doc.rules?.difficultyLevel ?? 'medium',
          combatSystem: doc.rules?.combatSystem ?? 'd20',
        },
      };
    });
    
    // Layer M0: Always carries traceId in response envelope
    sendSuccess(res, worldDTOs, req);
  } catch (error) {
    console.error('[content/worlds] Error fetching content worlds:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch world content',
      req
    );
  }
});

export default router;
