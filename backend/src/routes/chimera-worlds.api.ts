/**
 * Chimera Worlds API Routes
 * Phase 2: API endpoints using WorldsRepository
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { WorldsRepository } from '../db/repos/worlds.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { WorldDefinitionSchema } from '@shared/types/chimera-authoring';

const router = Router();

// Param validation schema
const IdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * POST /api/chimera/worlds
 * Create a new world
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = WorldDefinitionSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new WorldsRepository(supabase);
    
    const ownerId = req.ctx?.userId || undefined;
    const id = await repo.create(validated, undefined, ownerId);
    
    return sendSuccess(res, { id }, req, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid world definition',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Worlds] Error creating world:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create world',
      req
    );
  }
});

/**
 * GET /api/chimera/worlds/:id
 * Get a world by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new WorldsRepository(supabase);
    
    const world = await repo.findById(id);
    
    if (!world) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'World not found',
        req
      );
    }
    
    return sendSuccess(res, world, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid ID format',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Worlds] Error fetching world:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch world',
      req
    );
  }
});

/**
 * PUT /api/chimera/worlds/:id
 * Update a world
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    // Validate request body
    const validated = WorldDefinitionSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new WorldsRepository(supabase);
    
    // Check if world exists
    const existing = await repo.findById(id);
    if (!existing) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'World not found',
        req
      );
    }
    
    // Get the key for this world ID
    const key = await repo.getKeyById(id);
    if (!key) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'World key not found',
        req
      );
    }
    
    await repo.update(key, validated);
    
    return sendSuccess(res, { id, updated: true }, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Worlds] Error updating world:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to update world',
      req
    );
  }
});

/**
 * GET /api/chimera/worlds
 * List all worlds
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getChimeraSupabaseClient(req);
    const repo = new WorldsRepository(supabase);
    
    const worlds = await repo.listAll();
    
    return sendSuccess(res, worlds, req);
  } catch (error) {
    console.error('[Chimera Worlds] Error listing worlds:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to list worlds',
      req
    );
  }
});

export default router;

