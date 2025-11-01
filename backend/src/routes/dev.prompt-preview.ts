/**
 * Phase 8.1: Dev route for prompt preview
 * GET /api/dev/test/prompt-preview
 * Requires DEBUG_ROUTES_ENABLED=true and X-Debug-Token header
 * Supports X-Test-Rollback: 1 for ephemeral transactions
 */

import express, { Request, Response } from 'express';
import { getTraceId } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { z } from 'zod';
import { PromptPreviewService } from '../services/prompt-preview.service.js';
import { requireDebugAccess } from './dev.test.js';
import { getTestTxClient } from '../middleware/testTx.js';
import { config } from '../config/index.js';

const router = express.Router();

// Query parameter schema
const PreviewQuerySchema = z.object({
  gameId: z.string().uuid('Invalid game ID format'),
  mode: z.enum(['start', 'turn']).default('start'),
  turnNumber: z.coerce.number().optional(),
  playerMessage: z.string().optional(),
  model: z.string().optional(),
  budgetTokens: z.coerce.number().optional(),
});

/**
 * GET /api/dev/test/prompt-preview
 * Preview a prompt for a game without executing it
 */
router.get('/prompt-preview', requireDebugAccess, async (req: Request, res: Response) => {
  try {
    // Parse and validate query parameters
    const queryValidation = PreviewQuerySchema.safeParse(req.query);
    
    if (!queryValidation.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid query parameters',
          details: queryValidation.error.errors,
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    const { gameId, mode, turnNumber, playerMessage, model, budgetTokens } = queryValidation.data;

    // Validate turnNumber for turn mode
    if (mode === 'turn' && !turnNumber) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'turnNumber is required when mode="turn"',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Check if test rollback is requested
    const testRollback = req.headers['x-test-rollback'] === '1' && config.testTx.enabled;
    const txClient = testRollback ? getTestTxClient(req) : null;

    // Log request
    console.log(JSON.stringify({
      event: 'preview.prompt.request',
      gameId,
      mode,
      turnNumber,
      hasPlayerMessage: !!playerMessage,
      testRollback: !!testRollback,
      traceId: getTraceId(req),
    }));

    // Create preview service and preview prompt
    const previewService = new PromptPreviewService();
    const result = await previewService.preview({
      gameId,
      mode,
      turnNumber,
      playerMessage,
      model,
      budgetTokens,
    });

    // Log result
    if (result.ok && result.data) {
      console.log(JSON.stringify({
        event: 'preview.prompt.result',
        gameId,
        mode,
        turnNumber,
        tokenPct: result.data.meta.tokenEst.pct,
        policy: result.data.meta.policy,
        includedCount: result.data.meta.included.length,
        droppedCount: result.data.meta.dropped.length,
        traceId: getTraceId(req),
      }));
    } else {
      console.error(JSON.stringify({
        event: 'preview.prompt.error',
        gameId,
        mode,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        traceId: getTraceId(req),
      }));
    }

    // Return result
    if (!result.ok) {
      const statusCode = result.error?.code === ApiErrorCode.NOT_FOUND ? 404
        : result.error?.code === ApiErrorCode.VALIDATION_FAILED ? 400
        : 500;

      return res.status(statusCode).json({
        ok: false,
        error: {
          code: result.error?.code || ApiErrorCode.INTERNAL_ERROR,
          message: result.error?.message || 'Preview failed',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: result.data,
      meta: {
        traceId: getTraceId(req),
        testRollback: !!testRollback,
      },
    });
  } catch (error) {
    console.error('[DEV_PROMPT_PREVIEW] Unexpected error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

export default router;

