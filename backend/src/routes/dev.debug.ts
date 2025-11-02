/**
 * Phase 4: Feature-flagged developer debug routes
 * 
 * WARNING: For developer use only. Do not enable in public environments.
 * 
 * These routes provide debugging capabilities for prompt assembly and game state inspection.
 * They are only enabled when DEBUG_ROUTES_ENABLED=true and require a shared secret token.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
// Legacy imports removed - v3 assembler used instead
import { config } from '../config/index.js';
import { GamesService } from '../services/games.service.js';
import { getTraceId } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';

const router = express.Router();

// In-memory rate limit: token bucket per X-Debug-Token
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_REQUESTS_PER_MIN = Number(process.env.DEBUG_ROUTES_RATELIMIT_PER_MIN || 30);
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Rate limit middleware for dev debug routes
 * Uses token bucket algorithm: refills at RATE_LIMIT_REQUESTS_PER_MIN tokens per minute
 */
function rateLimitDebugRoute(req: Request, res: Response, next: express.NextFunction): void {
  const debugToken = req.headers['x-debug-token'] as string;
  
  if (!debugToken) {
    return next(); // Guard middleware will handle missing token
  }

  const now = Date.now();
  let bucket = rateLimitBuckets.get(debugToken);

  if (!bucket) {
    // Initialize bucket
    bucket = {
      tokens: RATE_LIMIT_REQUESTS_PER_MIN,
      lastRefill: now,
    };
    rateLimitBuckets.set(debugToken, bucket);
  } else {
    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((elapsed / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_REQUESTS_PER_MIN);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_REQUESTS_PER_MIN, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  // Check if request can proceed
  if (bucket.tokens <= 0) {
    res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT_REQUESTS_PER_MIN} requests per minute.`,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }

  // Consume token
  bucket.tokens -= 1;
  next();
}

/**
 * Redact sensitive fields from metadata
 */
function redactSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sensitiveKeys = ['apiKey', 'api_key', 'secret', 'token', 'password', 'auth'];
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in redacted) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveFields(redacted[key]);
    }
  }

  return redacted;
}

// Guard middleware: checks if debug routes are enabled and token is valid
const requireDebugAccess = (req: Request, res: Response, next: express.NextFunction): void => {
  const debugEnabled = process.env.DEBUG_ROUTES_ENABLED === 'true';
  const debugToken = process.env.DEBUG_ROUTES_TOKEN;
  const providedToken = req.headers['x-debug-token'] as string;

  if (!debugEnabled) {
    res.status(403).json({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Debug routes are disabled',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }

  if (!debugToken) {
    res.status(403).json({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Debug routes token not configured',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }

  if (!providedToken || providedToken !== debugToken) {
    res.status(403).json({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid debug token',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }

  next();
};

// Apply guard and rate limit to all routes in this router
router.use(requireDebugAccess);
router.use(rateLimitDebugRoute);

/**
 * GET /api/dev/debug/prompt-assembly
 * 
 * Inspect prompt assembly without hitting the model or writing to DB.
 * 
 * Query parameters:
 * - world_id (uuid, required)
 * - entry_start_slug (string, required)
 * - scenario_slug (string, optional)
 * - ruleset_slug (string, optional)
 * - model (string, optional)
 * - budget (number, optional)
 * 
 * Returns assembled prompt preview, pieces, and metadata.
 */
const PromptAssemblyQuerySchema = z.object({
  entry_point_id: z.string().trim().min(1, 'entry_point_id is required'),
  entry_start_slug: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  budget: z.coerce.number().int().min(1).optional(),
});

router.get('/prompt-assembly', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate query parameters
    const validationResult = PromptAssemblyQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid query parameters',
          details: {
            fieldErrors: validationResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    if (!validationResult.data) {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'Missing required parameters' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }

    const {
      entry_point_id,
      entry_start_slug,
      model,
      budget,
    } = validationResult.data;

    // Assemble prompt using v3 entry-point assembler (no DB writes, no model call)
    const { EntryPointAssemblerV3 } = await import('../prompts/entry-point-assembler-v3.js');
    const assembler = new EntryPointAssemblerV3();

    const budgetTokens = budget || config.prompt.tokenBudgetDefault;

    const assembleResult = await assembler.assemble({
      entryPointId: entry_point_id,
      entryStartSlug: entry_start_slug,
      model: model || config.prompt.modelDefault,
      budgetTokens,
    });

    // Return preview (first 400 chars) and full metadata (with sensitive fields redacted)
    const promptPreview = assembleResult.prompt.substring(0, 400);
    const safeMeta = redactSensitiveFields(assembleResult.meta);

    res.json({
      ok: true,
      data: {
        promptPreview: promptPreview + (assembleResult.prompt.length > 400 ? '...' : ''),
        promptLength: assembleResult.prompt.length,
        pieces: assembleResult.pieces,
        meta: {
          included: safeMeta.included,
          dropped: safeMeta.dropped,
          policy: safeMeta.policy || [],
          tokenEst: {
            input: safeMeta.tokenEst?.input,
            budget: safeMeta.tokenEst?.budget,
            pct: safeMeta.tokenEst?.pct,
          },
          model: safeMeta.model,
          worldId: safeMeta.worldId,
          rulesetSlug: safeMeta.rulesetSlug,
          entryStartSlug: safeMeta.entryStartSlug,
          source: safeMeta.source,
          version: safeMeta.version,
          selectionContext: safeMeta.selectionContext,
          npcTrimmedCount: (safeMeta as any).npcTrimmedCount || 0,
        },
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error in prompt-assembly:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to assemble prompt',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

/**
 * GET /api/dev/debug/game/:gameId/turns
 * 
 * Inspect turn stream for a game with slimmed metadata.
 * Returns ordered turn list with turn_number, role, created_at, and slimmed meta.
 * Does not include full content (for privacy/performance).
 */
router.get('/game/:gameId/turns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;

    if (!gameId || typeof gameId !== 'string') {
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'gameId is required',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    const gamesService = new GamesService();
    
    // Get turns with pagination (default: all turns, max 100 for debug)
    const { turns } = await gamesService.getGameTurns(gameId, { limit: 100 });

    // Slim down metadata: only include policy, tokenEst, and pieces.length (with sensitive fields redacted)
    const slimmedTurns = turns.map((turn: any) => {
      const safeMeta = turn.meta ? redactSensitiveFields(turn.meta) : null;
      
      return {
        turn_number: turn.turn_number,
        role: turn.role,
        created_at: turn.created_at,
        meta: safeMeta ? {
          policy: safeMeta.policy || [],
          tokenEst: safeMeta.tokenEst ? {
            input: safeMeta.tokenEst.input,
            budget: safeMeta.tokenEst.budget,
            pct: safeMeta.tokenEst.pct,
          } : undefined,
          piecesCount: safeMeta.pieces ? safeMeta.pieces.length : 0,
          includedCount: safeMeta.included ? safeMeta.included.length : 0,
          droppedCount: safeMeta.dropped ? safeMeta.dropped.length : 0,
        } : null,
      };
    });

    res.json({
      ok: true,
      data: {
        gameId,
        turns: slimmedTurns,
        count: slimmedTurns.length,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error in game turns inspector:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch turns',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

/**
 * GET /api/dev/debug/traces/:gameId
 * Fetch prompt traces for a game (admin-only)
 */
router.get('/traces/:gameId', requireDebugAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!gameId || typeof gameId !== 'string') {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'gameId is required' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }

    // Verify user is admin (via userId from optionalAuth middleware if present)
    const userId = (req as any).ctx?.userId || (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }
    
    const { getUserRole } = await import('../utils/debugResponse.js');
    const userRole = await getUserRole(userId);
    if (userRole !== 'admin') {
      res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }

    const { getPromptTraces } = await import('../services/prompt-trace.service.js');
    const traces = await getPromptTraces(gameId, limit);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      data: {
        gameId,
        traces,
        count: traces.length,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error fetching traces:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch traces',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

/**
 * GET /api/dev/debug/cache-stats
 * Get cache statistics (admin only)
 */
/**
 * GET /api/dev/debug/preview-prompt/:gameId
 * 
 * Preview the prompt that would be generated for a game's next turn (or initial turn).
 * This is useful for testing and debugging prompt assembly before actually making an AI call.
 * 
 * Query params:
 *   - optionId: The option ID to use (default: 'game_start' for initial, or latest turn's option)
 *   - fullPrompt: If true, return the full prompt instead of preview (default: false)
 */
router.get('/preview-prompt/:gameId', requireDebugAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameId } = req.params;
    const optionId = (req.query.optionId as string) || 'game_start';
    const fullPrompt = req.query.fullPrompt === 'true';

    // Load the game
    const gamesService = new GamesService();
    const game = await gamesService.loadGame(gameId);

    if (!game) {
      res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Game not found' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }

    // Build prompt using v3 assembler (same as turns service)
    const turnsService = (await import('../services/turns.service.js')).turnsService;
    
    // Use the private buildPromptV2 method via reflection (or make it public)
    // For now, let's replicate the logic here
    if (!game.entry_point_id) {
      res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'Game missing entry_point_id; v3 assembler requires entry point' },
        meta: { traceId: getTraceId(req) },
      });
      return;
    }

    const { EntryPointAssemblerV3 } = await import('../prompts/entry-point-assembler-v3.js');
    const assembler = new EntryPointAssemblerV3();

    const budgetTokens = config.prompt.tokenBudgetDefault;
    const model = config.prompt.modelDefault;

    // Get entry_start_slug if needed
    const { supabaseAdmin } = await import('../services/supabase.js');
    const { data: entryPoint } = await supabaseAdmin
      .from('entry_points')
      .select('id, content')
      .eq('id', game.entry_point_id)
      .single();

    let entryStartSlug: string | undefined;
    if (entryPoint) {
      entryStartSlug = entryPoint.content?.doc?.entryStartSlug ||
                      entryPoint.content?.entryStartSlug ||
                      undefined;
    }

    // Assemble prompt using v3 assembler
    const assembleResult = await assembler.assemble({
      entryPointId: game.entry_point_id,
      entryStartSlug,
      model,
      budgetTokens,
    });

    // Return the prompt (full or preview)
    const promptToReturn = fullPrompt 
      ? assembleResult.prompt 
      : assembleResult.prompt.substring(0, 2000) + (assembleResult.prompt.length > 2000 ? '\n\n... (truncated, use ?fullPrompt=true for full prompt)' : '');

    res.json({
      ok: true,
      data: {
        prompt: promptToReturn,
        promptLength: assembleResult.prompt.length,
        pieces: assembleResult.pieces,
        meta: assembleResult.meta,
        gameInfo: {
          id: game.id,
          entry_point_id: game.entry_point_id,
          world_id: (game as any).world_id || (game as any).world_slug,
          turn_count: game.turn_count,
        },
        optionId,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error in preview-prompt:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to preview prompt',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

router.get('/cache-stats', requireDebugAccess, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rulesetCache, npcListCache } = await import('../utils/cache.js');
    
    const rulesetStats = rulesetCache.getStats();
    const npcStats = npcListCache.getStats();
    
    res.json({
      ok: true,
      data: {
        ruleset: rulesetStats,
        npc: npcStats,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error fetching cache stats:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch cache stats',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

export default router;

