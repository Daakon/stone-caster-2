/**
 * Phase 6: Dev-only test helper routes
 * Requires DEBUG_ROUTES_ENABLED=true and X-Debug-Token header
 */

import express, { Request, Response } from 'express';
import { getTestTxClient, isTestTxActive } from '../middleware/testTx.js';
import { config } from '../config/index.js';
import { getTraceId } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { z } from 'zod';

const router = express.Router();

// Guard middleware: checks if debug routes are enabled and token is valid
export const requireDebugAccess = (req: Request, res: Response, next: express.NextFunction): void => {
  const debugEnabled = config.debug.routesEnabled;
  const debugToken = config.debug.routesToken;
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
    return;
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
    return;
  }

  if (providedToken !== debugToken) {
    res.status(401).json({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid debug token',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
    return;
  }

  next();
};

router.use(requireDebugAccess);

const SeedTurnsSchema = z.object({
  gameId: z.string().uuid(),
  count: z.number().int().min(1).max(1000),
});

// POST /api/dev/test/seed-turns - Create N turns for a game (inside test transaction)
router.post('/seed-turns', async (req: Request, res: Response) => {
  try {
    const validationResult = SeedTurnsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid request data',
          details: validationResult.error.errors,
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    const { gameId, count } = validationResult.data;

    // Phase 6: Check if test transaction is active
    const txClient = getTestTxClient(req);
    if (!txClient || !isTestTxActive(req)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Test transaction not active. Include X-Test-Rollback: 1 header and ensure TEST_TX_ENABLED=true.',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Use txClient to insert turns
    const insertedCount = await insertTestTurns(txClient, gameId, count);

    res.json({
      ok: true,
      data: {
        gameId,
        inserted: insertedCount,
        message: `Created ${insertedCount} test turns (will be rolled back)`,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('Error seeding test turns:', error);
    res.status(500).json({
      ok: false,
      error: {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Failed to seed test turns',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

/**
 * Insert test turns into a game using the transaction client
 */
async function insertTestTurns(
  txClient: any,
  gameId: string,
  count: number
): Promise<number> {
  // Get current max turn_number for this game
  const maxResult = await txClient.query(
    'SELECT COALESCE(MAX(turn_number), 0) as max_turn FROM turns WHERE game_id = $1',
    [gameId]
  );
  const maxTurn = parseInt(maxResult.rows[0]?.max_turn || '0', 10);

  let inserted = 0;
  const now = new Date().toISOString();

  // Insert turns in batches
  for (let i = 1; i <= count; i++) {
    const turnNumber = maxTurn + i;
    const role = i % 2 === 0 ? 'user' : 'narrator';
    
    await txClient.query(
      `INSERT INTO turns (game_id, turn_number, role, content, meta, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        gameId,
        turnNumber,
        role,
        `Test turn ${turnNumber} content for E2E testing`,
        JSON.stringify({ test: true, turnNumber }),
        now,
      ]
    );
    inserted++;
  }

  return inserted;
}

export { router as devTestRouter };

