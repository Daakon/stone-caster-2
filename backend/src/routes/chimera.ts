/**
 * @swagger
 * tags:
 *   - name: Chimera V2
 *     description: Project Chimera (V2) engine API endpoints
 */

import { Router, Request, Response } from 'express';
import chimeraAdminRulesetsRouter from './chimera-admin-rulesets.js';
import chimeraAdminTagsRouter from './chimera-admin-tags.js';
import chimeraAdminEntitiesRouter from './chimera-admin-entities.js';
import chimeraWorldsRouter from './chimera-worlds.js';
import chimeraProfileRouter from './chimera-profile.js';
import chimeraEntitiesRouter from './chimera-entities.js';
import chimeraStoriesRouter from './chimera-stories.js';
import chimeraPacksRouter from './chimera-packs.js';
import chimeraLoreRouter from './chimera-lore.js';

const router = Router();

/**
 * GET /api/v2/chimera/health
 * Health check endpoint for Chimera V2 engine
 */
router.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
  });
});

// Mount admin routes
router.use('/admin/rulesets', chimeraAdminRulesetsRouter);
router.use('/admin/tags', chimeraAdminTagsRouter);
router.use('/admin/entities', chimeraAdminEntitiesRouter);

// Mount user-facing routes
router.use('/profile', chimeraProfileRouter);
router.use('/worlds', chimeraWorldsRouter);
router.use('/entities', chimeraEntitiesRouter);
router.use('/stories', chimeraStoriesRouter);
router.use('/packs', chimeraPacksRouter);
router.use('/lore', chimeraLoreRouter);

export default router;

