import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { GameTurnService } from '../services/game/game-turn.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api';
import { requireAuth } from '../middleware/auth.unified.js';
import { ServiceError } from '../utils/serviceError.js';
import { TurnTimelineTracker } from '../services/runtime/turn-timeline.js';
import { GamesService } from '../services/games.service.js';

const router = Router();

/**
 * GET /api/games
 * Return the authenticated user's saved games.
 *
 * This route shares the /api/games mount with the active turn endpoint below.
 */
router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const ownerId = req.ctx?.userId || req.user?.id;
            if (!ownerId) {
                return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
            }

            const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
            const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
            const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
            const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

            const games = await new GamesService().getGames(ownerId, false, limit, offset);
            return sendSuccess(res, games, req);
        } catch (error) {
            console.error('[ActiveGameController] List Games Error:', error);
            return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch games', req);
        }
    }
);

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
            const timeline = new TurnTimelineTracker();
            timeline.mark('request_received');

            // Execute Turn
            const result = await turnService.processTurn(gameId, validated.input, userId, timeline);

            if (!result.success) {
                return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, result.message || 'Turn failed', req);
            }

            // Suggested actions flow from the Director (turn_meta.suggested_actions)
            // through GameTurnService into delta.action_queue in both mock and
            // real mode — no injection needed here.
            timeline.mark('response_sent');
            return sendSuccess(res, {
                turn: result.turn,
                delta: result.delta,
                new_logs: result.new_logs,
                runtime_timeline: timeline.snapshot(),
            }, req);

        } catch (error) {
            console.error('[ActiveGameController] Turn Error:', error);

            if (error instanceof z.ZodError) {
                return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Invalid input', req, error.errors);
            }

            // ServiceError carries its own code + user-safe message (404/409/429/504...)
            if (error instanceof ServiceError) {
                return sendErrorWithStatus(res, error.error.code, error.error.message, req, error.error.details);
            }

            // Never leak raw internal error messages to the client
            return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to process turn. Please try again.', req);
        }
    }
);

export default router;
