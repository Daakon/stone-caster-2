import { Router } from 'express';
import { getChimeraSupabaseAdminClient } from '../db/supabase-client.js';
import { GameInstanceService } from '../services/game/instance.service.js';
import { GameSetupService } from '../services/game/setup.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { z } from 'zod';

const router = Router();

// Validation schema for start game
const StartGameSchema = z.object({
    compiledStoryId: z.string().uuid(),
    characterData: z.record(z.unknown())
});

const SetupParamsSchema = z.object({
    storyId: z.string().uuid()
});

// GET /api/chimera/v3/game/setup/:storyId
router.get('/setup/:storyId', async (req, res) => {
    try {
        const { storyId } = SetupParamsSchema.parse(req.params);

        const supabaseAdmin = getChimeraSupabaseAdminClient();
        const service = new GameSetupService(supabaseAdmin);

        const result = await service.getSetupConfig(storyId);

        return sendSuccess(res, result, req);
    } catch (error) {
        console.error('[GameV3] Setup Error:', error);
        if (error instanceof z.ZodError) {
            // Need to map status codes manually or use a helper that handles error instance
            // sendErrorWithStatus in response.ts takes ApiErrorCode enum, but here we have string/number mismatch
            // Quick fix: generic err response
            return res.status(400).json({ success: false, error: 'Invalid story ID', details: error.errors });
        }
        return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
});

// POST /api/chimera/v3/game/start
router.post('/start', async (req, res) => {
    try {
        // 1. Validate Input
        const { compiledStoryId, characterData } = StartGameSchema.parse(req.body);
        // Explicitly cast req.user to any to avoid type errors
        const userId = (req.user as any)?.id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // 2. Instantiate Service
        const supabaseAdmin = getChimeraSupabaseAdminClient();
        const service = new GameInstanceService(supabaseAdmin);

        // 3. Execute
        const result = await service.createInstance({
            userId,
            compiledStoryId,
            characterData
        });

        // 4. Return
        return sendSuccess(res, result, req);

    } catch (error) {
        console.error('[GameV3] Start Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid input parameters', details: error.errors });
        }
        // Simple error mapping for now
        return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
});

// Turn Processing Schema
const TurnSchema = z.object({
    instanceId: z.string().uuid(),
    input: z.string().min(1)
});

// POST /api/chimera/v3/game/:instanceId/turn
router.post('/:instanceId/turn', async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { input } = req.body;

        // Validate
        TurnSchema.parse({ instanceId, input });

        // Explicitly cast req.user to any to avoid type errors
        const userId = (req.user as any)?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const supabaseAdmin = getChimeraSupabaseAdminClient();
        const { GameTurnService } = await import('../services/game/turn.service.js');
        const service = new GameTurnService(supabaseAdmin);

        const result = await service.processTurn(instanceId, input);

        if (!result.success) {
            return res.status(400).json({ success: false, error: result.message || 'Turn processing failed' });
        }

        return sendSuccess(res, result, req);

    } catch (error) {
        console.error('[GameV3] Turn Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
        }
        return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
});

export default router;
