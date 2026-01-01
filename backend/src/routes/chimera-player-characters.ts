import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { ChimeraEntitiesService } from '../services/chimera/chimera-entities.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';

const router = express.Router();

router.use(requireAuth);

const CreatePlayerCharacterSchema = z.object({
    name: z.string().min(1),
    state_snapshot: z.record(z.unknown()), // The tier1_entity payload
    world_id: z.string().uuid(),
});


router.get('/', async (req, res) => {
    try {
        const userId = req.user!.id;
        const characters = await ChimeraEntitiesService.listPlayerCharacters(userId);
        return sendSuccess(res, characters, req);
    } catch (error) {
        return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : 'Failed to list player characters',
            req
        );
    }
});

router.post('/', validateRequest(CreatePlayerCharacterSchema), async (req, res) => {
    try {
        const userId = req.user!.id;
        const character = await ChimeraEntitiesService.createPlayerCharacter({
            userId,
            ...req.body
        });
        return sendSuccess(res, character, req);
    } catch (error) {
        return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : 'Failed to create player character',
            req
        );
    }
});

export default router;
