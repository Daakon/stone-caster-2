/**
 * Chimera Lore API Routes
 * Phase 2: API endpoints using LoreRepository
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { LoreRepository } from '../db/repos/lore.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { LoreFragmentSchema } from '@shared/types/chimera-authoring';

const router = Router();

// Param validation schema
const IdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * POST /api/chimera/lore
 * Create a new lore fragment
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = LoreFragmentSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new LoreRepository(supabase);
    
    const id = await repo.create(validated);
    
    return sendSuccess(res, { id }, req, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid lore fragment',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Lore] Error creating lore fragment:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create lore fragment',
      req
    );
  }
});

/**
 * GET /api/chimera/lore/:id
 * Get a lore fragment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new LoreRepository(supabase);
    
    const fragment = await repo.findById(id);
    
    if (!fragment) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Lore fragment not found',
        req
      );
    }
    
    return sendSuccess(res, fragment, req);
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
    
    console.error('[Chimera Lore] Error fetching lore fragment:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch lore fragment',
      req
    );
  }
});

/**
 * PUT /api/chimera/lore/:id
 * Update a lore fragment
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    // Validate request body
    const validated = LoreFragmentSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new LoreRepository(supabase);
    
    // Check if fragment exists
    const existing = await repo.findById(id);
    if (!existing) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Lore fragment not found',
        req
      );
    }
    
    await repo.update(id, validated);
    
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
    
    console.error('[Chimera Lore] Error updating lore fragment:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to update lore fragment',
      req
    );
  }
});

/**
 * DELETE /api/chimera/lore/:id
 * Delete a lore fragment
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new LoreRepository(supabase);
    
    // Check if fragment exists
    const existing = await repo.findById(id);
    if (!existing) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Lore fragment not found',
        req
      );
    }
    
    await repo.delete(id);
    
    return sendSuccess(res, { id, deleted: true }, req);
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
    
    console.error('[Chimera Lore] Error deleting lore fragment:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to delete lore fragment',
      req
    );
  }
});

/**
 * GET /api/chimera/lore
 * List all lore fragments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getChimeraSupabaseClient(req);
    const repo = new LoreRepository(supabase);
    
    const fragments = await repo.listAll();
    
    return sendSuccess(res, fragments, req);
  } catch (error) {
    console.error('[Chimera Lore] Error listing lore fragments:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to list lore fragments',
      req
    );
  }
});

export default router;

