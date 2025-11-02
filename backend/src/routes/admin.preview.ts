/**
 * Admin Preview Routes
 * Entry point preview without AI calls - for authoring and QA
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AdminPreviewService } from '../services/admin-preview.service.js';
import { ContentQAService } from '../services/content-qa.service.js';
import { requireAdmin, isAdmin } from '../services/authz.js';
import { getTraceId } from '../utils/response.js';
import { config } from '../config/index.js';

const router = Router();

// In-memory rate limit: token bucket per X-Debug-Token (reused from dev.debug.ts)
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_REQUESTS_PER_MIN = Number(process.env.DEBUG_ROUTES_RATE_LIMIT || 30);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function rateLimitDebugRoute(req: Request, res: Response, next: () => void): void {
  const debugToken = req.headers['x-debug-token'] as string;
  
  if (!debugToken) {
    return next(); // Guard middleware will handle missing token
  }

  const now = Date.now();
  let bucket = rateLimitBuckets.get(debugToken);

  if (!bucket) {
    bucket = {
      tokens: RATE_LIMIT_REQUESTS_PER_MIN,
      lastRefill: now,
    };
    rateLimitBuckets.set(debugToken, bucket);
  }

  // Refill tokens
  const timeSinceRefill = now - bucket.lastRefill;
  const tokensToAdd = Math.floor((timeSinceRefill / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_REQUESTS_PER_MIN);
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(RATE_LIMIT_REQUESTS_PER_MIN, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please try again later.',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
    return;
  }

  bucket.tokens--;
  next();
}

// Apply rate limiting
router.use(rateLimitDebugRoute);

// Guard middleware: requires admin role and debug routes enabled
const requireAdminPreview = async (req: Request, res: Response, next: () => void): Promise<void> => {
  try {
    // Check debug routes enabled
    if (!config.debug.routesEnabled) {
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
      return;
    }

    // Check admin role
    const admin = await isAdmin(req);
    if (!admin) {
      res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin role required',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Authorization check failed',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
};

// Apply guard to all routes
router.use(requireAdminPreview);

/**
 * GET /api/admin/preview/entry-point/:entryPointId
 * Preview entry point prompt assembly (no AI call)
 * 
 * Query params:
 * - rulesetSlug (optional)
 * - budget (optional number)
 * - warnPct (optional number)
 * - npcLimit (optional int)
 * - includeNpcs (0|1, default 1)
 * - entryStartSlug (optional)
 * - qa=1 (include QA report)
 */
const PreviewQuerySchema = z.object({
  rulesetSlug: z.string().optional(),
  budget: z.coerce.number().int().positive().optional(),
  warnPct: z.coerce.number().min(0).max(1).optional(),
  npcLimit: z.coerce.number().int().positive().optional(),
  includeNpcs: z.enum(['0', '1']).optional(),
  entryStartSlug: z.string().optional(),
  qa: z.enum(['0', '1']).optional(),
});

router.get('/entry-point/:entryPointId', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate entry point ID
    const entryPointId = req.params.entryPointId;
    if (!entryPointId || typeof entryPointId !== 'string') {
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid entry point ID',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
      return;
    }

    // Validate query parameters
    const queryValidation = PreviewQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid query parameters',
          details: {
            fieldErrors: queryValidation.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          },
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
      return;
    }

    const query = queryValidation.data;

    // Prepare overrides
    const overrides = {
      rulesetSlug: query.rulesetSlug,
      budget: query.budget,
      warnPct: query.warnPct,
      npcLimit: query.npcLimit,
      includeNpcs: query.includeNpcs !== '0', // Default true
      entryStartSlug: query.entryStartSlug,
    };

    // Run preview
    const previewService = new AdminPreviewService();
    const result = await previewService.previewEntryPoint(entryPointId, overrides);

    // Run QA if requested
    let qaReport: Array<{
      type: string;
      piece: string;
      severity: string;
      message: string;
      pct?: number;
    }> = [];

    if (query.qa === '1') {
      const qaService = new ContentQAService();
      const budget = overrides.budget || config.prompt.tokenBudgetDefault;
      qaReport = await qaService.checkPieces(result.pieces, budget);
      
      // Add QA report to diagnostics
      (result.diagnostics as any).qaReport = qaReport;
    }

    // Always set no-store
    res.setHeader('Cache-Control', 'no-store');

    res.json({
      ok: true,
      data: {
        prompt: result.prompt,
        pieces: result.pieces,
        meta: {
          ...result.meta,
          source: 'entry-point',
          version: 'v3',
        },
        diagnostics: result.diagnostics,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('[ADMIN_PREVIEW] Error previewing entry point:', error);
    
    // Handle assembler errors
    if (error instanceof Error && error.message.includes('EntryPointAssemblerError')) {
      res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Entry point not found or invalid',
          details: error.message,
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
      return;
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to preview entry point',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

export default router;

