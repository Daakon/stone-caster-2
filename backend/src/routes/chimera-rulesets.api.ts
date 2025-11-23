/**
 * Chimera Rulesets API Routes
 * Phase 2: API endpoints using RulesetsRepository
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getChimeraSupabaseClient } from '../db/supabase-client.js';
import { RulesetsRepository } from '../db/repos/rulesets.repo.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { RulesetDefinitionSchema } from '@shared/types/chimera-authoring';

const router = Router();

// Param validation schema - accepts both UUID and key (string)
const IdParamSchema = z.object({
  id: z.string().min(1),
});

// Query validation schema
const CategoryQuerySchema = z.object({
  category: z.enum(['foundation', 'expansion', 'flavor']).optional(),
});

/**
 * POST /api/chimera/rulesets
 * Create a new ruleset
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = RulesetDefinitionSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new RulesetsRepository(supabase);
    
    const id = await repo.create(validated);
    
    return sendSuccess(res, { id }, req, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid ruleset definition',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Rulesets] Error creating ruleset:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to create ruleset',
      req
    );
  }
});

/**
 * GET /api/chimera/rulesets/:id
 * Get a ruleset by ID (UUID) or key
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new RulesetsRepository(supabase);
    
    // Check if it looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let ruleset = null;
    
    if (isUUID) {
      // Try by UUID first
      ruleset = await repo.findById(id);
      
      // If not found by UUID, try by key (fallback)
      if (!ruleset) {
        ruleset = await repo.findByKey(id);
      }
    } else {
      // Try by key
      ruleset = await repo.findByKey(id);
    }
    
    if (!ruleset) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Ruleset not found',
        req
      );
    }
    
    return sendSuccess(res, ruleset, req);
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
    
    console.error('[Chimera Rulesets] Error fetching ruleset:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch ruleset',
      req
    );
  }
});

/**
 * PUT /api/chimera/rulesets/:id
 * Update a ruleset by ID (UUID) or key
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    
    // Validate request body
    const validated = RulesetDefinitionSchema.parse(req.body);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new RulesetsRepository(supabase);
    
    // Check if it looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let key = id;
    
    if (isUUID) {
      // Get the key from UUID
      const foundKey = await repo.getKeyById(id);
      if (!foundKey) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Ruleset not found',
          req
        );
      }
      key = foundKey;
    }
    
    // Update by key
    await repo.update(key, validated);
    
    // Return the updated ruleset
    const updated = await repo.findByKey(key);
    
    return sendSuccess(res, updated, req);
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
    
    console.error('[Chimera Rulesets] Error updating ruleset:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to update ruleset',
      req
    );
  }
});

/**
 * GET /api/chimera/rulesets
 * List rulesets, optionally filtered by category
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate query params
    const query = CategoryQuerySchema.parse(req.query);
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new RulesetsRepository(supabase);
    
    let rulesets;
    
    if (query.category) {
      // Filter by category
      rulesets = await repo.findByCategory(query.category);
    } else {
      // Get all rulesets
      rulesets = await repo.listAll();
    }
    
    return sendSuccess(res, rulesets, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Rulesets] Error listing rulesets:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to list rulesets',
      req
    );
  }
});

export default router;

