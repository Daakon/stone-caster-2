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
import { DatabasePromptAssembler } from '../prompts/database-prompt-assembler.js';
import { PromptRepository } from '../repositories/prompt.repository.js';
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
    return res.status(429).json({
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
    return res.status(403).json({
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
    return res.status(403).json({
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
    return res.status(403).json({
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
  world_id: z.string().uuid('world_id must be a valid UUID'),
  entry_start_slug: z.string().trim().min(1, 'entry_start_slug is required'),
  scenario_slug: z.string().trim().min(1).nullable().optional(),
  ruleset_slug: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  budget: z.coerce.number().int().min(1).optional(),
});

router.get('/prompt-assembly', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validationResult = PromptAssemblyQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
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

    const {
      world_id,
      entry_start_slug,
      scenario_slug,
      ruleset_slug,
      model,
      budget,
    } = validationResult.data;

    // Assemble prompt using Phase 2 assembler (no DB writes, no model call)
    const promptRepository = new PromptRepository(
      config.supabase.url,
      config.supabase.serviceKey
    );
    const assembler = new DatabasePromptAssembler(promptRepository);

    const budgetTokens = budget || config.prompt.tokenBudgetDefault;

    const assembleResult = await assembler.assemblePromptV2({
      worldId: world_id,
      rulesetSlug: ruleset_slug || undefined,
      scenarioSlug: scenario_slug || null,
      entryStartSlug: entry_start_slug,
      model: model || config.prompt.modelDefault,
      budgetTokens,
    });

    // Return preview (first 400 chars) and full metadata (with sensitive fields redacted)
    const promptPreview = assembleResult.prompt.substring(0, 400);
    const safeMeta = redactSensitiveFields(assembleResult.meta);

    return res.json({
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
          scenarioSlug: safeMeta.scenarioSlug,
          entryStartSlug: safeMeta.entryStartSlug,
        },
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[DEV_DEBUG] Error in prompt-assembly:', error);
    return res.status(500).json({
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
router.get('/game/:gameId/turns', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({
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

    return res.json({
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
    return res.status(500).json({
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

export default router;

