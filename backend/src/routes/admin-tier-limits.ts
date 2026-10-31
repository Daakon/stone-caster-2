import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.unified.js";
import { EntitlementsService } from "../services/content/entitlements.service.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendSuccess, sendError, getTraceId } from "../utils/response.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";

const router = Router();
const admin: RequestHandler = (req, res, next) => {
  void requireAdmin(req, res, next).catch(next);
};
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
      "Invalid tier policy",
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
      event: "tier_policy_request_failed",
      traceId: getTraceId(req),
    }),
  );
  sendError(
    res,
    ApiErrorCode.INTERNAL_ERROR,
    "Unable to update tier policy",
    req,
    500,
  );
}
router.get(
  "/tier-limits",
  admin,
  handle(async (req: Request, res: Response) => {
    try {
      sendSuccess(
        res,
        await EntitlementsService.forRequest(req).policies(),
        req,
      );
    } catch (error) {
      failure(error, req, res);
    }
  }),
);
router.patch(
  "/tier-limits",
  admin,
  handle(async (req: Request, res: Response) => {
    try {
      sendSuccess(
        res,
        await EntitlementsService.forRequest(req).setTier(req.body),
        req,
      );
    } catch (error) {
      failure(error, req, res);
    }
  }),
);
router.post(
  "/users/:userId/tier",
  admin,
  handle(async (req: Request, res: Response) => {
    try {
      sendSuccess(
        res,
        await EntitlementsService.forRequest(req).assign(
          z.string().uuid().parse(req.params.userId),
          req.body,
        ),
        req,
      );
    } catch (error) {
      failure(error, req, res);
    }
  }),
);
export default router;
