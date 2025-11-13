/**
 * Media Approval Service
 * Phase 2d: Admin image approval workflow
 */

import { supabaseAdmin } from './supabase.js';
import type { MediaAssetDTO } from '@shared/types/media.js';
import { MediaKindSchema } from '@shared/types/media.js';

export interface ListPendingParams {
  limit: number;
  cursor?: string;
  kind?: 'npc' | 'world' | 'story' | 'site';
  owner?: string;
}

export interface ListPendingResult {
  items: MediaAssetDTO[];
  nextCursor?: string;
}

export interface ReviewMediaParams {
  id: string;
  review: 'approved' | 'rejected';
  adminUserId: string;
  reason?: string;
}

export interface BulkReviewMediaParams {
  ids: string[];
  review: 'approved' | 'rejected';
  adminUserId: string;
}

export interface BulkReviewMediaResult {
  updated: string[];
  skipped: string[];
}

/**
 * Encode cursor for keyset pagination
 */
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
}

/**
 * Decode cursor for keyset pagination
 */
function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * List pending images with keyset pagination
 */
export async function listPending(
  params: ListPendingParams
): Promise<ListPendingResult> {
  const { limit, cursor, kind, owner } = params;

  let query = supabaseAdmin
    .from('media_assets')
    .select('*')
    .eq('image_review_status', 'pending')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1); // Fetch one extra to determine if there's a next page

  if (kind) {
    query = query.eq('kind', kind);
  }

  if (owner) {
    query = query.eq('owner_user_id', owner);
  }

  // Apply cursor for keyset pagination (server-side filtering)
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // Use keyset pagination: where (created_at, id) < (cursor.createdAt, cursor.id)
      // Supabase PostgREST supports lt on created_at, then we filter by id in SQL
      // For exact keyset: created_at < cursor.createdAt OR (created_at = cursor.createdAt AND id < cursor.id)
      // We'll use created_at <= cursor.createdAt and filter by id in the query
      query = query.or(`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list pending images: ${error.message}`);
  }

  // Filter by cursor if provided (for exact keyset pagination)
  let filteredData = data || [];
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      filteredData = filteredData.filter((item: any) => {
        const itemCreatedAt = new Date(item.created_at).toISOString();
        const cursorCreatedAt = decoded.createdAt;
        if (itemCreatedAt < cursorCreatedAt) {
          return true;
        }
        if (itemCreatedAt === cursorCreatedAt && item.id < decoded.id) {
          return true;
        }
        return false;
      });
    }
  }

  const items = filteredData.slice(0, limit);
  const hasNext = filteredData.length > limit;

  // Build next cursor from last item
  let nextCursor: string | undefined;
  if (hasNext && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
  }

  // Map to DTOs
  const dtos: MediaAssetDTO[] = items.map((item: any) => ({
    id: item.id,
    owner_user_id: item.owner_user_id,
    kind: item.kind as any,
    provider: item.provider,
    provider_key: item.provider_key,
    visibility: item.visibility as any,
    status: item.status as any,
    image_review_status: item.image_review_status as any,
    width: item.width,
    height: item.height,
    sha256: item.sha256,
    created_at: item.created_at,
    ready_at: item.ready_at,
  }));

  return {
    items: dtos,
    nextCursor,
  };
}

/**
 * Review a single media asset
 */
export async function reviewOne(
  params: ReviewMediaParams
): Promise<MediaAssetDTO> {
  const { id, review, adminUserId, reason } = params;

  // Load media asset
  const { data: media, error: fetchError } = await supabaseAdmin
    .from('media_assets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !media) {
    throw new Error('Media asset not found');
  }

  // Update review status
  const { data: updatedMedia, error: updateError } = await supabaseAdmin
    .from('media_assets')
    .update({
      image_review_status: review,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError || !updatedMedia) {
    throw new Error(`Failed to update review status: ${updateError?.message || 'Unknown error'}`);
  }

  // Map to DTO
  return {
    id: updatedMedia.id,
    owner_user_id: updatedMedia.owner_user_id,
    kind: updatedMedia.kind as any,
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

/**
 * Bulk review multiple media assets
 */
export async function reviewBulk(
  params: BulkReviewMediaParams
): Promise<BulkReviewMediaResult> {
  const { ids, review, adminUserId } = params;

  const updated: string[] = [];
  const skipped: string[] = [];

  // Process each ID
  for (const id of ids) {
    try {
      // Check if media exists
      const { data: media, error: fetchError } = await supabaseAdmin
        .from('media_assets')
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError || !media) {
        skipped.push(id);
        continue;
      }

      // Update review status
      const { error: updateError } = await supabaseAdmin
        .from('media_assets')
        .update({
          image_review_status: review,
        })
        .eq('id', id);

      if (updateError) {
        skipped.push(id);
        continue;
      }

      updated.push(id);
    } catch (error) {
      skipped.push(id);
    }
  }

  return {
    updated,
    skipped,
  };
}

