// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Chimera Play API Routes
 * Handles game loop execution and session initialization
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { PlayViewService } from "../services/play/play-view.service.js";
import {
  sendSuccess,
  sendErrorWithStatus,
  getTraceId,
} from "../utils/response.js";
import { ApiErrorCode } from "@shared/types/api";
import { requireAuth } from "../middleware/auth.unified.js";

const router = Router();

/**
 * GET /api/chimera/play/:gameStateId
 * Get the current game state
 */
router.get(
  "/:gameStateId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { gameStateId } = req.params;

      if (!gameStateId || !z.string().uuid().safeParse(gameStateId).success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          "Invalid game state ID",
          req,
        );
      }

      const userId = req.user?.id;
      if (!userId)
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          "User ID required",
          req,
        );
      const gameState = await PlayViewService.forRequest(req).load(
        gameStateId,
        userId,
      );

      if (!gameState) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          "Game state not found",
          req,
        );
      }

      return sendSuccess(res, gameState, req);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Play projection failed",
          traceId: getTraceId(req),
          detail:
            error instanceof Error ? error.message : "Unknown projection error",
        }),
      );
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Failed to load game state",
        req,
      );
    }
  },
);

// NOTE: turn submission lives at POST /api/games/:gameId/turn
// (active-game.controller.ts) — the /cast-stone route was an orphaned
// duplicate pipeline and has been removed.

/**
 * POST /api/chimera/play/start
 * Retired because this route cannot identify and pin a player-owned character.
 */
router.post("/start", requireAuth, (req: Request, res: Response) =>
  res.status(410).json({
    error:
      "Use POST /api/chimera/game/init with a frozen compiled story and player-owned character.",
  }),
);

export default router;
