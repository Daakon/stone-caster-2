/**
 * Media Preflight Service
 * Phase 2e: Check media requirements before publishing
 */

import { supabaseAdmin } from './supabase.js';
import { isAdminMediaEnabled } from '../config/featureFlags.js';
import type { PublishableType } from '@shared';

export interface MediaPreflightError {
  code: 'MISSING_COVER_MEDIA' | 'COVER_NOT_READY' | 'COVER_NOT_APPROVED';
  message: string;
}

export interface MediaPreflightWarning {
  code: 'GALLERY_ITEMS_NOT_APPROVED';
  message: string;
  mediaIds: string[];
}

export interface MediaPreflightResult {
  ok: boolean;
  errors?: MediaPreflightError[];
  warnings?: MediaPreflightWarning[];
}

/**
 * Media preflight rules per entity type
 * Phase 2e refinement: Explicit rules for cover requirements
 */
const MEDIA_PREFLIGHT_RULES: Record<PublishableType, { requiresCover: boolean }> = {
  world: { requiresCover: true },
  story: { requiresCover: true },
  npc: { requiresCover: true }, // Currently uniform; can be changed to false if NPCs are optional
};

/**
 * Check media requirements for publishing
 * Phase 2e: Requires cover_media_id with status='ready' and image_review_status='approved'
 * Phase 2e refinement: Per-entity rules (currently all require cover; NPCs can be made optional)
 */
export async function checkMediaPreflight(params: {
  type: PublishableType;
  id: string;
}): Promise<MediaPreflightResult> {
  const { type, id } = params;

  // Only enforce if feature flag is enabled
  if (!isAdminMediaEnabled()) {
    return { ok: true };
  }

  const errors: MediaPreflightError[] = [];
  const warnings: MediaPreflightWarning[] = [];

  // Get rules for this entity type
  const rules = MEDIA_PREFLIGHT_RULES[type];
  if (!rules) {
    // Unknown type, skip media checks
    return { ok: true };
  }

  // Map type to table name
  const tableName = type === 'story' ? 'entry_points' : `${type}s`;

  // Load entity with cover_media_id
  const { data: entity, error: entityError } = await supabaseAdmin
    .from(tableName)
    .select('id, cover_media_id')
    .eq('id', id)
    .single();

  if (entityError || !entity) {
    // Entity not found - this will be caught by the main preflight
    return { ok: true };
  }

  // Check cover_media_id is present (if required)
  if (rules.requiresCover && !entity.cover_media_id) {
    errors.push({
      code: 'MISSING_COVER_MEDIA',
      message: `${type} must have a cover image before publishing`,
    });
    return { ok: false, errors, warnings };
  }

  // If cover not required or not present, skip further checks
  if (!rules.requiresCover || !entity.cover_media_id) {
    return { ok: true, warnings };
  }

  // Load cover media asset
  const { data: coverMedia, error: mediaError } = await supabaseAdmin
    .from('media_assets')
    .select('id, status, image_review_status')
    .eq('id', entity.cover_media_id)
    .single();

  if (mediaError || !coverMedia) {
    errors.push({
      code: 'MISSING_COVER_MEDIA',
      message: `Cover image not found`,
    });
    return { ok: false, errors, warnings };
  }

  // Check status is 'ready'
  if (coverMedia.status !== 'ready') {
    errors.push({
      code: 'COVER_NOT_READY',
      message: `Cover image must be finalized (status: ${coverMedia.status})`,
    });
  }

  // Check image_review_status is 'approved'
  if (coverMedia.image_review_status !== 'approved') {
    errors.push({
      code: 'COVER_NOT_APPROVED',
      message: `Cover image must be approved (review status: ${coverMedia.image_review_status})`,
    });
  }

  // Check gallery links (warnings only, don't block)
  const targetColumn = type === 'world' ? 'world_id' : type === 'story' ? 'story_id' : 'npc_id';
  const { data: galleryLinks, error: linksError } = await supabaseAdmin
    .from('media_links')
    .select('media_id')
    .eq(targetColumn, id);

  if (!linksError && galleryLinks && galleryLinks.length > 0) {
    const mediaIds = galleryLinks.map((link: any) => link.media_id);
    const { data: galleryMedia, error: galleryError } = await supabaseAdmin
      .from('media_assets')
      .select('id, status, image_review_status')
      .in('id', mediaIds);

    if (!galleryError && galleryMedia) {
      const notApproved = galleryMedia.filter(
        (media: any) => media.status !== 'ready' || media.image_review_status !== 'approved'
      );

      if (notApproved.length > 0) {
        warnings.push({
          code: 'GALLERY_ITEMS_NOT_APPROVED',
          message: `${notApproved.length} gallery image(s) are not ready or approved`,
          mediaIds: notApproved.map((m: any) => m.id),
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

