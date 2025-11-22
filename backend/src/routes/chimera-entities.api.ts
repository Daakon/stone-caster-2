/**
 * Chimera Entities API Routes
 * Phase 2: API endpoints using EntitiesRepository
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { EntitiesRepository } from '../db/repos/entities.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { EntityTemplateSchema } from '@shared/types/chimera-authoring';

const router = Router();

// Param validation schema
const IdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * POST /api/chimera/entities
 * Create a new entity
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = EntityTemplateSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new EntitiesRepository(supabase);
    
    const id = await repo.create(validated);
    
    return sendSuccess(res, { id }, req, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid entity template',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Entities] Error creating entity:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create entity',
      req
    );
  }
});

/**
 * GET /api/chimera/entities/:id
 * Get an entity by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new EntitiesRepository(supabase);
    
    const entity = await repo.findById(id);
    
    if (!entity) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Entity not found',
        req
      );
    }
    
    return sendSuccess(res, entity, req);
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
    
    console.error('[Chimera Entities] Error fetching entity:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch entity',
      req
    );
  }
});

/**
 * PUT /api/chimera/entities/:id
 * Update an entity
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    // Validate request body
    const validated = EntityTemplateSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new EntitiesRepository(supabase);
    
    // Check if entity exists
    const existing = await repo.findById(id);
    if (!existing) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Entity not found',
        req
      );
    }
    
    // Update using the key from existing entity
    // The existing.id is the key (since EntityTemplate uses key as id)
    await repo.update(existing.id, validated);
    
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
    
    console.error('[Chimera Entities] Error updating entity:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to update entity',
      req
    );
  }
});

/**
 * DELETE /api/chimera/entities/:id
 * Delete an entity
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new EntitiesRepository(supabase);
    
    // Check if entity exists
    const existing = await repo.findById(id);
    if (!existing) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Entity not found',
        req
      );
    }
    
    await repo.delete(existing.id);
    
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
    
    console.error('[Chimera Entities] Error deleting entity:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to delete entity',
      req
    );
  }
});

/**
 * GET /api/chimera/entities
 * List all entities
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getChimeraSupabaseClient(req);
    const repo = new EntitiesRepository(supabase);
    
    const entities = await repo.listAll();
    
    return sendSuccess(res, entities, req);
  } catch (error) {
    console.error('[Chimera Entities] Error listing entities:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to list entities',
      req
    );
  }
});

export default router;

