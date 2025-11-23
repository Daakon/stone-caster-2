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

// Log route registration
console.log('[Chimera Rulesets Repo] Router initialized, registering routes...');

// Add middleware to log all requests to this router
router.use((req, res, next) => {
  console.log('[Chimera Rulesets Repo] Incoming request:', req.method, req.path, req.params);
  next();
});

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
  console.log('[Chimera Rulesets PUT] Route hit:', req.method, req.path, req.params);
  console.log('[Chimera Rulesets PUT] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate params
    const { id } = IdParamSchema.parse(req.params);
    console.log('[Chimera Rulesets PUT] Parsed ID:', id);
    
    // Validate request body
    const validated = RulesetDefinitionSchema.parse(req.body);
    console.log('[Chimera Rulesets PUT] Validated definition:', JSON.stringify(validated, null, 2));
    
    const supabase = getChimeraSupabaseClient(req);
    const repo = new RulesetsRepository(supabase);
    
    // Check if it looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    console.log('[Chimera Rulesets PUT] Is UUID?', isUUID);
    
    let key = id;
    
    if (isUUID) {
      // Get the key from UUID
      console.log('[Chimera Rulesets PUT] Looking up key for UUID:', id);
      const foundKey = await repo.getKeyById(id);
      console.log('[Chimera Rulesets PUT] Found key:', foundKey);
      
      if (!foundKey) {
        // Key is missing or empty - update by UUID and set the key from definition
        console.log('[Chimera Rulesets PUT] Key not found/empty, updating by UUID and setting key');
        await repo.updateById(id, validated);
        
        // Return the updated ruleset
        const updated = await repo.findById(id);
        console.log('[Chimera Rulesets PUT] Returning updated ruleset');
        return sendSuccess(res, updated, req);
      }
      key = foundKey;
    }
    
    console.log('[Chimera Rulesets PUT] Updating ruleset with key:', key);
    // Update by key
    await repo.update(key, validated);
    console.log('[Chimera Rulesets PUT] Update successful, fetching updated ruleset');
    
    // Return the updated ruleset
    const updated = await repo.findByKey(key);
    console.log('[Chimera Rulesets PUT] Returning updated ruleset');
    
    return sendSuccess(res, updated, req);
  } catch (error) {
    console.error('[Chimera Rulesets PUT] Error caught:', error);
    if (error instanceof z.ZodError) {
      console.error('[Chimera Rulesets PUT] Zod validation error:', error.errors);
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

console.log('[Chimera Rulesets Repo] Routes registered: GET /, GET /:id, POST /, PUT /:id');

export default router;

