/**
 * Asset Service
 * Handles asset upload URL generation for Chimera assets using Cloudflare Images
 */

import { requestDirectUpload, CloudflareImagesError } from '../../lib/cloudflareImages.js';
import { getCloudflareImagesDeliveryUrl } from '../../config/media.js';
// Import buildImageUrl - check if it's exported from shared index or import directly
// For now, we'll construct the URL manually since buildImageUrl may not be available server-side
import type { Request } from 'express';

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  path: string;
}

export class AssetService {
  /**
   * Generate a signed upload URL for an asset using Cloudflare Images
   * @param contentType - MIME type of the file (e.g., 'image/png', 'image/jpeg')
   * @param folder - Folder path within the bucket (used as metadata, not actual folder structure in CF Images)
   * @param req - Express request (optional, for auth context)
   * @returns Object containing uploadUrl, publicUrl, and path
   */
  async generateUploadUrl(
    contentType: string,
    folder: string,
    req?: Request
  ): Promise<UploadUrlResponse> {
    try {
      // Request direct upload URL from Cloudflare Images
      // The folder parameter is stored as metadata for organization
      const { uploadURL, id } = await requestDirectUpload({
        metadata: {
          folder: folder,
          content_type: contentType,
          // Add user ID if available from request context
          ...(req?.ctx?.userId ? { user_id: req.ctx.userId } : {}),
        },
      });

      // Build the public URL using the Cloudflare Images delivery URL
      // The id from Cloudflare is the image ID (provider_key)
      const deliveryUrl = getCloudflareImagesDeliveryUrl();
      // Format: https://imagedelivery.net/{accountHash}/{imageId}/public
      const publicUrl = deliveryUrl 
        ? `${deliveryUrl.replace(/\/$/, '')}/${id}/public`
        : `https://imagedelivery.net/unknown/${id}/public`; // Fallback if delivery URL not configured

      // Generate a path identifier (folder/imageId format for reference)
      const path = `${folder}/${id}`;

      return {
        uploadUrl: uploadURL,
        publicUrl,
        path,
      };
    } catch (error) {
      if (error instanceof CloudflareImagesError) {
        throw new Error(`Failed to generate upload URL: ${error.message}`);
      }
      throw error;
    }
  }
}
