/**
 * Chimera Assets API Routes
 * Phase 2: Asset upload URL generation using Cloudflare Images
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AssetService } from '../services/assets/asset.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';

const router = Router();

// Request body validation schema
const GenerateUploadUrlSchema = z.object({
  contentType: z.string().min(1),
  folder: z.string().min(1),
});

/**
 * POST /api/chimera/assets/upload-url
 * Generate a signed upload URL for an asset using Cloudflare Images
 */
router.post('/upload-url', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validated = GenerateUploadUrlSchema.parse(req.body);
    
    const assetService = new AssetService();
    const result = await assetService.generateUploadUrl(
      validated.contentType,
      validated.folder,
      req
    );
    
    return sendSuccess(res, result, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }
    
    console.error('[Chimera Assets] Error generating upload URL:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to generate upload URL',
      req
    );
  }
});

export default router;

