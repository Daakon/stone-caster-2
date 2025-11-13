/**
 * Admin Media Service
 * Phase 3b: Client helpers for cover and gallery management
 */

import { apiPost, apiPatch, apiDelete, apiGet } from '@/lib/api';
import type { MediaAssetDTO, MediaLinkDTO } from '@shared/types/media';

export type EntityKind = 'world' | 'story' | 'npc';

export interface SetCoverMediaParams {
  entityKind: EntityKind;
  entityId: string;
  mediaId: string | null;
}

export interface CreateMediaLinkParams {
  target: {
    kind: EntityKind;
    id: string;
  };
  mediaId: string;
  role?: string;
  sortOrder?: number;
}

export interface ReorderMediaLinksParams {
  target: {
    kind: EntityKind;
    id: string;
  };
  orders: Array<{
    linkId: string;
    sortOrder: number;
  }>;
}

export interface ListRecentUploadsParams {
  kind: EntityKind;
  limit?: number;
  owner?: string;
}

/**
 * Set or clear cover media for an entity
 */
export async function setCoverMedia(params: SetCoverMediaParams): Promise<{ ok: true; data: any } | { ok: false; error: any }> {
  const { entityKind, entityId, mediaId } = params;
  
  const endpoint = entityKind === 'story' 
    ? `/api/stories/${entityId}/cover-media`
    : `/api/${entityKind}s/${entityId}/cover-media`;

  return apiPatch(endpoint, { mediaId });
}

/**
 * Create a gallery link
 */
export async function createMediaLink(params: CreateMediaLinkParams): Promise<{ ok: true; data: { link: MediaLinkDTO } } | { ok: false; error: any }> {
  return apiPost('/api/media/links', {
    target: params.target,
    mediaId: params.mediaId,
    role: params.role || 'gallery',
    sortOrder: params.sortOrder || 0,
  });
}

/**
 * Delete a gallery link
 */
export async function deleteMediaLink(linkId: string): Promise<{ ok: true } | { ok: false; error: any }> {
  return apiDelete(`/api/media/links/${linkId}`);
}

/**
 * Reorder gallery links
 */
export async function reorderMediaLinks(params: ReorderMediaLinksParams): Promise<{ ok: true; data: { ok: boolean } } | { ok: false; error: any }> {
  return apiPatch('/api/media/links/reorder', {
    target: params.target,
    orders: params.orders,
  });
}

/**
 * List recent uploads for a kind (reuses pending list endpoint with owner filter)
 */
export async function listRecentUploads(params: ListRecentUploadsParams): Promise<{ ok: true; data: { items: MediaAssetDTO[] } } | { ok: false; error: any }> {
  const { kind, limit = 6, owner } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(limit));
  if (owner) {
    queryParams.set('owner', owner);
  }
  if (kind) {
    queryParams.set('kind', kind);
  }

  const result = await apiGet<{ items: MediaAssetDTO[]; nextCursor?: string }>(`/api/media/pending?${queryParams.toString()}`);
  if (!result.ok) {
    return result;
  }
  return { ok: true, data: { items: result.data.items } };
}

/**
 * Get gallery links for an entity (with media assets)
 */
export interface GetGalleryLinksParams {
  kind: EntityKind;
  entityId: string;
}

export interface GalleryLinkWithMedia extends MediaLinkDTO {
  media: MediaAssetDTO;
}

export async function getGalleryLinks(params: GetGalleryLinksParams): Promise<{ ok: true; data: { items: GalleryLinkWithMedia[] } } | { ok: false; error: any }> {
  const { kind, entityId } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.set('kind', kind);
  queryParams.set('id', entityId);
  queryParams.set('include', 'media');

  const result = await apiGet<{ items: GalleryLinkWithMedia[] }>(`/api/media/links?${queryParams.toString()}`);
  return result;
}

/**
 * Get cover media for an entity
 */
export interface GetCoverMediaParams {
  kind: EntityKind;
  entityId: string;
}

export async function getCoverMedia(params: GetCoverMediaParams): Promise<{ ok: true; data: MediaAssetDTO | null } | { ok: false; error: any }> {
  const { kind, entityId } = params;
  
  // Fetch entity to get cover_media_id
  let endpoint: string;
  if (kind === 'story') {
    endpoint = `/api/admin/entry-points/${entityId}`;
  } else if (kind === 'world') {
    endpoint = `/api/admin/worlds/${entityId}`;
  } else {
    endpoint = `/api/admin/npcs/${entityId}`;
  }

  const entityResult = await apiGet<any>(endpoint);
  if (!entityResult.ok || !entityResult.data) {
    return entityResult;
  }

  const coverMediaId = entityResult.data.cover_media_id;
  if (!coverMediaId) {
    return { ok: true, data: null };
  }

  // Fetch media asset using GET /api/media/:id
  const mediaResult = await apiGet<MediaAssetDTO>(`/api/media/${coverMediaId}`);
  if (!mediaResult.ok) {
    // If media not found, return null (cover_media_id might be stale)
    if (mediaResult.error?.code === 'NOT_FOUND') {
      return { ok: true, data: null };
    }
    return mediaResult;
  }

  return { ok: true, data: mediaResult.data };
}

/**
 * Phase 3c: Admin Approvals Service
 */

export interface ListPendingMediaParams {
  limit?: number;
  cursor?: string;
  kind?: 'npc' | 'world' | 'story' | 'site' | 'all';
  owner?: string; // UUID
}

export interface ListPendingMediaResponse {
  items: MediaAssetDTO[];
  nextCursor?: string;
}

/**
 * List pending images for approval
 */
export async function listPendingMedia(params: ListPendingMediaParams = {}): Promise<{ ok: true; data: ListPendingMediaResponse } | { ok: false; error: any }> {
  const { limit = 25, cursor, kind, owner } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(limit));
  if (cursor) {
    queryParams.set('cursor', cursor);
  }
  if (kind && kind !== 'all') {
    queryParams.set('kind', kind);
  }
  if (owner) {
    queryParams.set('owner', owner);
  }

  return apiGet<ListPendingMediaResponse>(`/api/media/pending?${queryParams.toString()}`);
}

export interface ReviewMediaParams {
  id: string;
  review: 'approved' | 'rejected';
  reason?: string;
}

/**
 * Approve or reject a single image
 */
export async function reviewMedia(params: ReviewMediaParams): Promise<{ ok: true; data: { media: MediaAssetDTO } } | { ok: false; error: any }> {
  const { id, review, reason } = params;
  
  return apiPost<{ media: MediaAssetDTO }>(`/api/media/${id}/approve`, {
    review,
    reason,
  });
}

export interface BulkReviewMediaParams {
  ids: string[];
  review: 'approved' | 'rejected';
}

export interface BulkReviewMediaResponse {
  updated: string[];
  skipped: string[];
}

/**
 * Bulk approve or reject multiple images
 */
export async function bulkReviewMedia(params: BulkReviewMediaParams): Promise<{ ok: true; data: BulkReviewMediaResponse } | { ok: false; error: any }> {
  const { ids, review } = params;
  
  return apiPost<BulkReviewMediaResponse>('/api/media/approve-bulk', {
    ids,
    review,
  });
}

