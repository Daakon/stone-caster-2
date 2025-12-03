/**
 * Chimera Assets API Routes
 * Phase 2: Asset upload URL generation using Cloudflare Images
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AssetService } from '../services/assets/asset.service.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';

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

/**
 * POST /api/chimera/assets/sign-upload
 * Generate a signed upload URL for an asset (alias for upload-url)
 * Phase 9: UX Repair, World Filtering & Asset Restoration
 */
router.post('/sign-upload', async (req: Request, res: Response) => {
  try {
    // Validate request body - accept filename/fileType or contentType/folder
    const SignUploadSchema = z.object({
      filename: z.string().optional(),
      fileType: z.string().optional(),
      contentType: z.string().optional(),
      folder: z.string().optional(),
    });

    const validated = SignUploadSchema.parse(req.body);
    
    // Map filename/fileType to contentType/folder if needed
    const contentType = validated.contentType || validated.fileType || 'image/jpeg';
    const folder = validated.folder || (validated.filename ? `uploads/${validated.filename.split('.').pop()}` : 'uploads');
    
    const assetService = new AssetService();
    const result = await assetService.generateUploadUrl(
      contentType,
      folder,
      req
    );
    
    // Log upload URL generation for debugging (without exposing sensitive data)
    console.log('[Chimera Assets] Generated upload URL:', {
      uploadUrlPrefix: result.uploadUrl.substring(0, 50) + '...',
      publicUrlPrefix: result.publicUrl.substring(0, 50) + '...',
      path: result.path,
    });
    
    // Return in format expected by frontend: { uploadUrl, accessUrl }
    return sendSuccess(res, {
      uploadUrl: result.uploadUrl,
      accessUrl: result.publicUrl,
      path: result.path,
    }, req);
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
    
    console.error('[Chimera Assets] Error generating sign-upload URL:', error);
    
    // Provide more helpful error message for Cloudflare auth issues
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate upload URL';
    if (errorMessage.includes('authentication failed') || errorMessage.includes('5403')) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Cloudflare Images configuration error: Please verify CF_ACCOUNT_ID and CF_API_TOKEN are correct and the API token has Cloudflare Images permissions. Check server logs for details.',
        req
      );
    }
    
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      errorMessage,
      req
    );
  }
});

export default router;

