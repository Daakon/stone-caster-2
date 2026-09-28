import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.unified.js'; // Assuming standard auth middleware exists

const router = Router();

/**
 * POST /api/chimera/compile/:storyId
 * Triggers the Story Compilation process.
 */
router.post('/api/chimera/compile/:storyId', requireAuth, async (req: Request, res: Response) => {
    return res.status(410).json({
        error: 'UUID-based compilation is retired. Use POST /api/chimera/compile with stable ContentKeyRef values.',
        requestId: req.ctx?.requestId,
    });
});

export default router;
