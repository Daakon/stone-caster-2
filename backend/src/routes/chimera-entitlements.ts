import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.unified.js";
import { EntitlementsService } from "../services/content/entitlements.service.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendSuccess, sendError, getTraceId } from "../utils/response.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";

const router = Router();
router.use((req, res, next) => {
  void requireAuth(req, res, next).catch(next);
});
function handle(
  work: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void work(req, res).catch(next);
  };
}
function failure(error: unknown, req: Request, res: Response) {
  if (error instanceof z.ZodError) {
    sendError(
      res,
      ApiErrorCode.VALIDATION_FAILED,
      "Invalid active selection",
      req,
      422,
      error.errors,
    );
    return;
  }
  if (error instanceof ServiceError) {
    sendError(
      res,
      error.error.code,
      error.error.message,
      req,
      error.statusCode,
      error.error.details,
    );
    return;
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "entitlement_request_failed",
      traceId: getTraceId(req),
    }),
  );
  sendError(
    res,
    ApiErrorCode.INTERNAL_ERROR,
    "Unable to load entitlement settings",
    req,
    500,
  );
}
router.get(
  "/active",
  handle(async (req: Request, res: Response) => {
    try {
      sendSuccess(res, await EntitlementsService.forRequest(req).active(), req);
    } catch (error) {
      failure(error, req, res);
    }
  }),
);
router.put(
  "/active",
  handle(async (req: Request, res: Response) => {
    try {
      sendSuccess(
        res,
        await EntitlementsService.forRequest(req).choose(req.body),
        req,
      );
    } catch (error) {
      failure(error, req, res);
    }
  }),
);
export default router;
