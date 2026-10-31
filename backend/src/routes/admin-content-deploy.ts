import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
} from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.unified.js";
import { ContentDeployHistoryService } from "../services/content/content-deploy-history.service.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { ApiErrorCode } from "../../../shared/src/types/api.js";

const router = Router();
const admin: RequestHandler = (req, res, next) => {
  void requireAdmin(req, res, next).catch(next);
};
async function history(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  try {
    sendSuccess(
      res,
      await ContentDeployHistoryService.forRequest(req).page(req.query),
      req,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid deployment history page",
        req,
        422,
      );
      return;
    }
    if (error instanceof ServiceError) {
      sendError(res, error.error.code, error.message, req, error.statusCode);
      return;
    }
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Unable to read content deployment history",
      req,
      500,
    );
  }
}
router.get("/content/deploy-log", admin, (req, res, next) => {
  void history(req, res).catch(next);
});
export default router;
