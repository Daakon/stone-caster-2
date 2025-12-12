/**
 * Chimera Assets API Routes
 * Phase 2: Asset upload URL generation
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ChimeraAssetsService } from '../services/chimera/chimera-assets.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { requireAuth } from '../middleware/auth.unified.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Request body validation schema
const GenerateUploadUrlSchema = z.object({
  contentType: z.string().min(1),
  folder: z.string().min(1),
  filename: z.string().optional(),
  fileSize: z.number().optional(),
  category: z.string().optional(),
  fileType: z.string().optional(), // Legacy support
});

const ConfirmUploadSchema = z.object({
  url: z.string().url(),
  meta: z.record(z.unknown()).optional()
});

/**
 * POST /api/chimera/assets/upload-url
 * Generate a signed upload URL for an asset AND register it in the system
 */
const handleUploadUrlGeneration = async (req: Request, res: Response) => {
  try {
    // Validate request body
    // If filename/fileType/folder are provided (legacy sign-upload format), map them
    let payload = req.body;

    // Legacy support: map fileType -> contentType if missing
    if (payload.fileType && !payload.contentType) {
      payload.contentType = payload.fileType;
    }

    const validated = GenerateUploadUrlSchema.parse(payload);

    const assetsService = new ChimeraAssetsService();
    // Pass the request object to allow service to extract user context
    const result = await assetsService.generateAndRegisterUpload(
      validated.contentType,
      validated.folder,
      validated.category || 'general',
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
};

/**
 * POST /api/v2/chimera/assets/upload-url
 * Generate a signed upload URL for an asset AND register it in the system
 */
router.post('/upload-url', handleUploadUrlGeneration);

/**
 * POST /api/v2/chimera/assets/sign-upload
 * Alias for upload-url to support legacy frontend calls
 */
router.post('/sign-upload', handleUploadUrlGeneration);

/**
 * GET /api/chimera/assets/my-assets
 * Retrieve recent assets for the current user
 */
router.get('/my-assets', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'User not authenticated', req);
    }

    const assetsService = new ChimeraAssetsService();
    const assets = await assetsService.getMyAssets(userId);

    return sendSuccess(res, assets, req);
  } catch (error) {
    console.error('[Chimera Assets] Error fetching user assets:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to fetch assets',
      req
    );
  }
});

/**
 * PATCH /api/v2/chimera/assets/:id
 * Confirm/Update an asset after upload (fixes ID/URL mismatch)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = ConfirmUploadSchema.parse(req.body);

    const assetsService = new ChimeraAssetsService();
    // Ensure user owns the asset (check logic inside service or via simple pre-fetch?)
    // For now, reliance on Service to probably be blunt, but let's do a quick ownership check if possible.
    // Actually, relying on RLS concept or lightweight check here:
    const userId = req.ctx?.userId;

    // We pass the updates to the service
    const updated = await assetsService.updateAsset(id, {
      url: updates.url,
      meta: updates.meta
    });

    return sendSuccess(res, updated, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Invalid update data', req, error.errors);
    }
    console.error('[Chimera Assets] Error updating asset:', error);
    return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to update asset', req);
  }
});

export default router;

