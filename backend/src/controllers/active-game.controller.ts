import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { GameTurnService } from '../services/game/game-turn.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api';
import { requireAuth } from '../middleware/auth.unified.js';

const router = Router();

// Validation Schema
const TurnRequestSchema = z.object({
    input: z.string().min(1, 'Input is required'),
    entity_id: z.string().optional() // Optional for now, usually implies acting entity
});

/**
 * POST /api/games/:gameId/turn
 * Process a game turn
 */
router.post(
    '/:gameId/turn',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { gameId } = req.params;
            const validated = TurnRequestSchema.parse(req.body);
            const userId = (req as any).user?.id;

            if (!userId) {
                return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'User ID required', req);
            }

            const supabase = getChimeraSupabaseClient(req);
            const turnService = new GameTurnService(supabase);

            // Execute Turn
            const result = await turnService.processTurn(gameId, validated.input, userId);

            if (!result.success) {
                return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, result.message || 'Turn failed', req);
            }

            // Inject mock actions if mock mode is enabled
            const useMock = process.env.ENABLE_MOCK_AI === 'true' || process.env.USE_MOCK_LLM === 'true';
            if (useMock && result.delta) {
                result.delta.action_queue = [
                    "test_combat", "test_social", "test_mixed", "test_travel", 
                    "test_drunk_combat", "test_protective_combat"
                ];
                
                if (!result.delta.world) result.delta.world = {};
                if (!result.delta.world.narrative) result.delta.world.narrative = {};
                if (!result.delta.world.narrative.scene_context) result.delta.world.narrative.scene_context = {};
                result.delta.world.narrative.scene_context.available_actions = result.delta.action_queue;
            }

            return sendSuccess(res, {
                turn: result.turn,
                delta: result.delta,
                new_logs: result.new_logs // Return only new logs
            }, req);

        } catch (error) {
            console.error('[ActiveGameController] Turn Error:', error);
            const msg = error instanceof Error ? error.message : 'Unknown error';

            if (error instanceof z.ZodError) {
                return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Invalid input', req, error.errors);
            }

            return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, msg, req);
        }
    }
);

export default router;
