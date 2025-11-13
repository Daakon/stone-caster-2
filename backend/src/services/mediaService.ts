/**
 * Media Service
 * Phase 2a: Direct upload creation and media asset management
 * Phase 2b: Finalize uploads and metadata retrieval
 */

import { supabaseAdmin } from './supabase.js';
import { requestDirectUpload, getImageInfo, CloudflareImagesError } from '../lib/cloudflareImages.js';
import { isAdmin } from '../middleware/auth-admin.js';
import type { Request } from 'express';
import type { MediaKind, MediaAssetDTO } from '@shared/types/media.js';

export interface CreateDirectUploadParams {
  userId: string;
  kind: MediaKind;
  req?: Request; // Optional request for admin check
}

export interface CreateDirectUploadResult {
  uploadURL: string;
  media: {
    id: string;
    owner_user_id: string;
    kind: string;
    provider: string;
    provider_key: string;
    visibility: string;
    status: string;
    image_review_status: string;
    created_at: string;
  };
}

/**
 * Create a direct upload URL and persist a pending media_assets row
 * @param params User ID, media kind, and optional request for admin check
 * @returns Upload URL and created media asset
 * @throws CloudflareImagesError if CF API fails
 */
export async function createDirectUpload(
  params: CreateDirectUploadParams
): Promise<CreateDirectUploadResult> {
  const { userId, kind, req } = params;

  // Request direct upload from Cloudflare
  const { uploadURL, id: providerKey } = await requestDirectUpload({
    metadata: {
      kind,
      owner_user_id: userId,
    },
  });

  // Check if user is admin (for image_review_status)
  let imageReviewStatus: 'pending' | 'approved' = 'pending';
  if (req) {
    const admin = await isAdmin(req);
    if (admin) {
      imageReviewStatus = 'approved';
    }
  }

  // Insert media_assets row
  // Handle unique constraint conflict (retries, double-click)
  let media;
  const { data: insertedMedia, error: insertError } = await supabaseAdmin
    .from('media_assets')
    .insert({
      owner_user_id: userId,
      kind,
      provider: 'cloudflare_images',
      provider_key: providerKey,
      visibility: 'private',
      status: 'pending',
      image_review_status: imageReviewStatus,
    })
    .select()
    .single();

  if (insertError) {
    // Check if it's a unique constraint violation
    if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
      // Fetch existing row instead of failing
      const { data: existingMedia, error: fetchError } = await supabaseAdmin
        .from('media_assets')
        .select('*')
        .eq('provider', 'cloudflare_images')
        .eq('provider_key', providerKey)
        .single();

      if (fetchError || !existingMedia) {
        throw new Error(`Failed to create or fetch media asset: ${insertError.message}`);
      }

      media = existingMedia;
    } else {
      throw new Error(`Failed to create media asset: ${insertError.message}`);
    }
  } else {
    media = insertedMedia;
  }

  if (!media) {
    throw new Error('Media asset created but not returned');
  }

  // Log audit event
  console.log(JSON.stringify({
    event: 'media_direct_upload_issued',
    media_id: media.id,
    owner_user_id: userId,
    kind,
    provider_key: providerKey,
  }));

  return {
    uploadURL,
    media: {
      id: media.id,
      owner_user_id: media.owner_user_id,
      kind: media.kind,
      provider: media.provider,
      provider_key: media.provider_key,
      visibility: media.visibility,
      status: media.status,
      image_review_status: media.image_review_status,
      width: media.width,
      height: media.height,
      sha256: media.sha256,
      created_at: media.created_at,
      ready_at: media.ready_at,
    },
  };
}

export interface FinalizeUploadParams {
  mediaId: string;
  currentUserId: string;
  req?: Request; // Optional request for admin check
  provider_key?: string; // Optional: final image ID from Cloudflare upload response
}

/**
 * Finalize an uploaded image by fetching metadata from Cloudflare and updating the media_assets row
 * @param params Media ID, current user ID, and optional request for admin check
 * @returns Updated media asset
 * @throws Error if not found, not owned (non-admin), or CF API fails
 */
export async function finalizeUpload(
  params: FinalizeUploadParams
): Promise<MediaAssetDTO> {
  const { mediaId, currentUserId, req } = params;
  const startTime = Date.now();

  // Log telemetry: finalize started
  console.log(JSON.stringify({
    event: 'media_finalize_started',
    media_id: mediaId,
    owner_user_id: currentUserId,
  }));

  // Fetch media row
  const { data: media, error: fetchError } = await supabaseAdmin
    .from('media_assets')
    .select('*')
    .eq('id', mediaId)
    .single();

  if (fetchError || !media) {
    throw new Error('Media asset not found');
  }

  // Enforce ownership or admin
  const isOwner = media.owner_user_id === currentUserId;
  let isUserAdmin = false;

  if (req) {
    isUserAdmin = await isAdmin(req);
  }

  if (!isOwner && !isUserAdmin) {
    throw new Error('Forbidden: You do not own this media asset');
  }

  // If already ready, return early (idempotent)
  if (media.status === 'ready') {
    return {
      id: media.id,
      owner_user_id: media.owner_user_id,
      kind: media.kind as MediaKind,
      provider: media.provider,
      provider_key: media.provider_key,
      visibility: media.visibility as any,
      status: media.status as any,
      image_review_status: media.image_review_status as any,
      width: media.width,
      height: media.height,
      sha256: media.sha256,
      created_at: media.created_at,
      ready_at: media.ready_at,
    };
  }

  // Update provider_key if provided (from upload response)
  if (params.provider_key && params.provider_key !== media.provider_key) {
    const { error: updateError } = await supabaseAdmin
      .from('media_assets')
      .update({ provider_key: params.provider_key })
      .eq('id', mediaId);
    
    if (updateError) {
      console.warn(`[finalizeUpload] Failed to update provider_key: ${updateError.message}`);
    } else {
      media.provider_key = params.provider_key;
    }
  }

  // Call Cloudflare API to get image info
  // Use more retries and longer delays since Cloudflare may take time to process
  const imageInfo = await getImageInfo(media.provider_key, 5, 2000);

  // Update row with metadata
  // Only set width/height if they're valid (non-zero)
  const readyAt = new Date().toISOString();
  const updateData: {
    width: number | null;
    height: number | null;
    status: string;
    ready_at: string;
    content_type?: string | null;
  } = {
    width: imageInfo.width && imageInfo.width > 0 ? imageInfo.width : null,
    height: imageInfo.height && imageInfo.height > 0 ? imageInfo.height : null,
    status: 'ready',
    ready_at: readyAt,
    content_type: imageInfo.contentType || null,
  };

  const { data: updatedMedia, error: updateError } = await supabaseAdmin
    .from('media_assets')
    .update(updateData)
    .eq('id', mediaId)
    .select()
    .single();

  if (updateError || !updatedMedia) {
    throw new Error(`Failed to update media asset: ${updateError?.message || 'Unknown error'}`);
  }

  const durationMs = Date.now() - startTime;

  // Log telemetry: finalize succeeded
  console.log(JSON.stringify({
    event: 'media_finalize_succeeded',
    media_id: mediaId,
    width: imageInfo.width,
    height: imageInfo.height,
    duration_ms: durationMs,
  }));

  return {
    id: updatedMedia.id,
    owner_user_id: updatedMedia.owner_user_id,
    kind: updatedMedia.kind as MediaKind,
    provider: updatedMedia.provider,
    provider_key: updatedMedia.provider_key,
    visibility: updatedMedia.visibility as any,
    status: updatedMedia.status as any,
    image_review_status: updatedMedia.image_review_status as any,
    width: updatedMedia.width,
    height: updatedMedia.height,
    sha256: updatedMedia.sha256,
    created_at: updatedMedia.created_at,
    ready_at: updatedMedia.ready_at,
  };
}

