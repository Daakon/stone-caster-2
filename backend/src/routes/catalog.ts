import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { ContentService } from '../services/content.service.js';

const router = Router();

// GET /api/catalog/worlds
router.get('/worlds', async (_req: Request, res: Response) => {
  try {
    const worlds = await ContentService.getWorlds();
    // Minimal public DTO
    const data = worlds.map(w => ({
      id: w.slug,
      slug: w.slug,
      title: w.title ?? w.name,
      name: w.name ?? w.title,
      description: w.description ?? '',
      tags: w.tags ?? [],
    }));
    sendSuccess(res, data, _req);
  } catch (error) {
    console.error('catalog.worlds error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch worlds', _req);
  }
});

// GET /api/catalog/worlds/:idOrSlug
router.get('/worlds/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const world = await ContentService.getWorldBySlug(idOrSlug);
    if (!world) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
    }
    const data = {
      id: world.slug,
      slug: world.slug,
      title: world.title ?? world.name,
      name: world.name ?? world.title,
      description: world.description ?? '',
      tags: world.tags ?? [],
    };
    sendSuccess(res, data, req);
  } catch (error) {
    console.error('catalog.world detail error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch world', req);
  }
});

// GET /api/catalog/stories (maps adventures)
router.get('/stories', async (req: Request, res: Response) => {
  try {
    const adventures = await ContentService.getAdventures();
    const data = adventures.map(a => ({
      id: a.slug,
      slug: a.slug,
      title: a.title ?? a.name,
      description: a.description ?? '',
      worldSlug: a.worldId,
      tags: a.tags ?? [],
    }));
    sendSuccess(res, data, req);
  } catch (error) {
    console.error('catalog.stories error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch stories', req);
  }
});

// GET /api/catalog/stories/:idOrSlug
router.get('/stories/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const adventure = await ContentService.getAdventureBySlug(idOrSlug);
    if (!adventure) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
    }
    const data = {
      id: adventure.slug,
      slug: adventure.slug,
      title: adventure.title ?? adventure.name,
      description: adventure.description ?? '',
      worldSlug: adventure.worldId,
      tags: adventure.tags ?? [],
      scenarios: adventure.scenarios ?? [],
    };
    sendSuccess(res, data, req);
  } catch (error) {
    console.error('catalog.story detail error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch story', req);
  }
});

// GET /api/catalog/npcs — placeholder (no public NPCs source yet)
router.get('/npcs', async (req: Request, res: Response) => {
  sendSuccess(res, [], req);
});

// GET /api/catalog/npcs/:id — placeholder
router.get('/npcs/:id', async (req: Request, res: Response) => {
  return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'NPC not found', req);
});

// GET /api/catalog/rulesets — placeholder
router.get('/rulesets', async (req: Request, res: Response) => {
  sendSuccess(res, [], req);
});

// GET /api/catalog/rulesets/:id — placeholder
router.get('/rulesets/:id', async (req: Request, res: Response) => {
  return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Ruleset not found', req);
});

export default router;





