/** Health endpoints for load balancer probes. */
import { Router, type Request, type Response } from "express";
import { ContentFormatService } from "../services/content/content-format.service.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendSuccess, sendError, getTraceId } from "../utils/response.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";

const router = Router();
async function ready(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  req.headers["x-trace-id"] = req.traceId ?? getTraceId(req);
  res.setHeader("X-Trace-Id", req.headers["x-trace-id"]);
  try {
    sendSuccess(
      res,
      await ContentFormatService.forRequest(req).readiness(),
      req,
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      sendError(
        res,
        error.error.code,
        error.message,
        req,
        error.statusCode,
        error.error.details,
      );
      return;
    }
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Content readiness is unavailable.",
      req,
      503,
    );
  }
}
router.get("/ready", (req, res, next) => {
  void ready(req, res).catch(next);
});

// Preserve the existing process-liveness contract; it does not query content.
router.get("/live", (_req: Request, res: Response): void => {
  res
    .status(200)
    .json({ ok: true, status: "alive", timestamp: new Date().toISOString() });
});
export default router;
