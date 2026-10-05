/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Lore
 *     description: User-facing CRUD endpoints for Chimera lore entries (Pure RAG system)
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.unified.js";
import { sendSuccess, sendError, getTraceId } from "../utils/response.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";
import { LoreContentReadService } from "../services/content/lore-content-read.service.js";
import { LoreContentWriteService } from "../services/content/lore-content-write.service.js";
import { TagContentReadService } from "../services/content/tag-content-read.service.js";
import { TagReadQuerySchema } from "../../../shared/src/types/chimera-tag-read.js";
import {
  LoreReadQuerySchema,
  LoreContextQuerySchema,
} from "../../../shared/src/types/chimera-lore-read.js";
import {
  LoreCreateSchema,
  LoreUpdateSchema,
  LoreWriteIdSchema,
} from "../../../shared/src/types/chimera-lore-write.js";
import { EntityReadIdSchema } from "../../../shared/src/types/chimera-entity-read.js";
import { ServiceError } from "../utils/serviceError.js";

async function loreAction(
  req: Request,
  res: Response,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    sendSuccess(res, await action(), req);
  } catch (error) {
    if (error instanceof ServiceError)
      return sendError(
        res,
        error.error.code,
        error.error.message,
        req,
        error.statusCode,
      );
    if (error instanceof z.ZodError)
      return sendError(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid lore request",
        req,
        422,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "lore_route_failed",
        traceId: getTraceId(req),
      }),
    );
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Lore content is temporarily unavailable.",
      req,
      503,
    );
  }
}
const router = Router();
router.use(requireAuth);

router.post("/", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentWriteService.forRequest(req, getTraceId(req)).create(
      LoreCreateSchema.parse(req.body as unknown),
    ),
  ),
);
router.get("/my-creations", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentReadService.forRequest(req, getTraceId(req)).list(
      LoreReadQuerySchema.parse(req.query),
    ),
  ),
);
router.get("/tags", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    TagContentReadService.forRequest(req, getTraceId(req)).list(
      TagReadQuerySchema.parse(req.query),
    ),
  ),
);
router.get("/:id", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentReadService.forRequest(req, getTraceId(req)).find(
      EntityReadIdSchema.parse(req.params.id),
    ),
  ),
);
router.get("/", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentReadService.forRequest(req, getTraceId(req)).listContext(
      LoreContextQuerySchema.parse(req.query),
    ),
  ),
);
router.put("/:id", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentWriteService.forRequest(req, getTraceId(req)).update(
      LoreWriteIdSchema.parse(req.params.id),
      LoreUpdateSchema.parse(req.body as unknown),
    ),
  ),
);
router.delete("/:id", (req: Request, res: Response) =>
  loreAction(req, res, () =>
    LoreContentWriteService.forRequest(req, getTraceId(req)).delete(
      LoreWriteIdSchema.parse(req.params.id),
    ),
  ),
);
export default router;
