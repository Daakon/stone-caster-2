/**
 * Cloudflare Images API Client
 * Phase 2a: Direct upload support
 * Phase 2b: Image metadata retrieval
 */

import { validateCloudflareImagesConfig } from '../config/media.js';

export interface DirectUploadRequest {
  metadata?: Record<string, string>;
}

export interface DirectUploadResponse {
  uploadURL: string;
  id: string;
}

export class CloudflareImagesError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly errors?: Array<{ code: number; message: string }>
  ) {
    super(message);
    this.name = 'CloudflareImagesError';
  }
}

/**
 * Request a direct upload URL from Cloudflare Images
 * @param opts Optional metadata to attach to the upload
 * @returns Upload URL and image ID
 * @throws CloudflareImagesError if request fails
 */
export async function requestDirectUpload(
  opts?: DirectUploadRequest
): Promise<DirectUploadResponse> {
  const config = validateCloudflareImagesConfig();
  if (!config) {
    throw new CloudflareImagesError(
      500,
      'Cloudflare Images configuration is missing. Check environment variables.'
    );
  }

  // Cloudflare Images direct upload endpoint
  // Request an upload URL that the client will use to upload the image directly
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/direct_upload`;

  // Build request body - only include if we have metadata
  const requestBody: Record<string, unknown> | null = opts?.metadata && Object.keys(opts.metadata).length > 0
    ? { metadata: opts.metadata }
    : null;

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
    };

    // Only set Content-Type and body if we have a body
    if (requestBody) {
      headers['Content-Type'] = 'application/json';
    }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      const data = await response.json() as any;

      if (!response.ok) {
        // Handle Cloudflare API errors
        const errorMessage =
          data.errors?.[0]?.message || data.message || `HTTP ${response.status}`;
        const errorCode = response.status;

        throw new CloudflareImagesError(
          errorCode,
          `Cloudflare Images API error: ${errorMessage}`,
          data.errors
        );
      }

      // Extract upload URL and image ID from response
      // CF API returns: { result: { uploadURL: string, id: string }, success: boolean, ... }
      if (!data.result || !data.result.uploadURL || !data.result.id) {
        throw new CloudflareImagesError(
          500,
          'Invalid response from Cloudflare Images API: missing uploadURL or id'
        );
      }

      return {
        uploadURL: data.result.uploadURL,
        id: data.result.id,
      };
  } catch (error) {
    if (error instanceof CloudflareImagesError) {
      throw error;
    }

    // Wrap network/fetch errors
    throw new CloudflareImagesError(
      500,
      `Failed to request direct upload: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export interface ImageInfo {
  width: number;
  height: number;
  uploaded: string; // ISO timestamp
  meta?: Record<string, unknown>;
  variants?: string[];
  requireSignedURLs?: boolean;
  draft?: boolean;
  contentType?: string; // From meta.content_type or inferred
}

/**
 * Get image metadata from Cloudflare Images
 * @param imageId Cloudflare Images ID (provider_key)
 * @param retries Number of retry attempts (default: 3)
 * @param retryDelayMs Initial delay between retries in ms (default: 1000)
 * @returns Image metadata including dimensions
 * @throws CloudflareImagesError if request fails after all retries
 */
export async function getImageInfo(
  imageId: string,
  retries: number = 3,
  retryDelayMs: number = 1000
): Promise<ImageInfo> {
  const config = validateCloudflareImagesConfig();
  if (!config) {
    throw new CloudflareImagesError(
      500,
      'Cloudflare Images configuration is missing. Check environment variables.'
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/images/v1/${imageId}`;

  let lastError: CloudflareImagesError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as any;

      if (!response.ok) {
        // Handle Cloudflare API errors
        const errorMessage =
          data.errors?.[0]?.message || data.message || `HTTP ${response.status}`;
        const errorCode = response.status;

        // If image not found (404) and we have retries left, wait and retry
        // This handles the case where Cloudflare is still processing the upload
        if (errorCode === 404 && attempt < retries) {
          const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
          console.log(
            `[Cloudflare Images] Image ${imageId} not found (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          lastError = new CloudflareImagesError(
            errorCode,
            `Cloudflare Images API error: ${errorMessage}`,
            data.errors
          );
          continue;
        }

        throw new CloudflareImagesError(
          errorCode,
          `Cloudflare Images API error: ${errorMessage}`,
          data.errors
        );
      }

      // Extract image info from response
      // CF API returns: { result: { filename, uploaded, requireSignedURLs, variants, ... }, success: boolean, ... }
      if (!data.result) {
        throw new CloudflareImagesError(
          500,
          'Invalid response from Cloudflare Images API: missing result'
        );
      }

      const result = data.result;

      // Extract dimensions from result
      // CF Images API v1 response structure:
      // - result.filename, result.uploaded, result.requireSignedURLs
      // - result.variants: array of variant URLs
      // - Dimensions may be in result directly or need to be extracted
      // Note: CF Images may not always provide dimensions in the metadata endpoint
      // We'll check multiple possible locations
      let width: number | null = null;
      let height: number | null = null;

      // Try direct fields first
      if (result.width && result.height) {
        width = Number(result.width);
        height = Number(result.height);
      }
      // Try meta object
      else if (result.meta && typeof result.meta === 'object') {
        width = result.meta.width ? Number(result.meta.width) : null;
        height = result.meta.height ? Number(result.meta.height) : null;
      }

      // If still no dimensions, we'll allow null (caller can handle)
      // Some images may not have dimensions available immediately after upload

      // Extract content_type from meta or infer from filename
      // Phase 2e refinement: Default to image/* if CF doesn't return it
      let contentType: string | undefined;
      if (result.meta && typeof result.meta === 'object' && result.meta.content_type) {
        contentType = String(result.meta.content_type);
      } else if (result.filename) {
        // Infer from filename extension
        const ext = result.filename.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === 'png') {
          contentType = 'image/png';
        } else if (ext === 'gif') {
          contentType = 'image/gif';
        } else if (ext === 'webp') {
          contentType = 'image/webp';
        } else if (ext) {
          contentType = `image/${ext}`;
        }
      }
      
      // Fallback: default to generic image/* if nothing else available
      if (!contentType) {
        contentType = 'image/*';
      }

      // Success! Return the image info
      return {
        width: width || 0, // Default to 0 if not available (caller should handle)
        height: height || 0,
        uploaded: result.uploaded || new Date().toISOString(),
        meta: result.meta || {},
        variants: result.variants || [],
        requireSignedURLs: result.requireSignedURLs || false,
        draft: result.draft || false,
        contentType,
      };
    } catch (error) {
      // If this is a CloudflareImagesError and it's a 404 with retries left, continue the loop
      if (error instanceof CloudflareImagesError && error.code === 404 && attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        console.log(
          `[Cloudflare Images] Image ${imageId} not found (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = error;
        continue;
      }

      // If it's a CloudflareImagesError, throw it (or save for final throw)
      if (error instanceof CloudflareImagesError) {
        if (attempt < retries) {
          lastError = error;
          const delay = retryDelayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      // Wrap network/fetch errors
      const wrappedError = new CloudflareImagesError(
        500,
        `Failed to get image info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      if (attempt < retries) {
        lastError = wrappedError;
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw wrappedError;
    }
  }

  // If we exhausted all retries, throw the last error
  if (lastError) {
    throw lastError;
  }

  // This should never be reached, but TypeScript needs it
  throw new CloudflareImagesError(500, 'Failed to get image info: Unknown error');
}

