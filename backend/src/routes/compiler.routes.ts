import { Router, Request, Response } from 'express';
import { StoryCompilerService } from '../services/compiler/compiler.service';
import { requireAuth } from '../middleware/auth.unified.js'; // Assuming standard auth middleware exists

const router = Router();

/**
 * POST /api/chimera/compile/:storyId
 * Triggers the Story Compilation process.
 */
router.post('/api/chimera/compile/:storyId', requireAuth, async (req: Request, res: Response) => {
    const { storyId } = req.params;
    const userId = (req as any).user?.id; // Assuming auth middleware populates user

    if (!storyId) {
        return res.status(400).json({ error: 'Missing storyId' });
    }

    try {
        const result = await StoryCompilerService.compileStory(storyId, userId);
        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Compilation Route Error:', error.message);

        // Return 400 for validation/business logic errors, 500 for unexpected
        // Since the compiler throws detailed validation errors, passing the message is helpful
        return res.status(400).json({
            error: error.message || 'Compilation failed',
            details: error.toString()
        });
    }
});

export default router;
