/**
 * Chimera V2 API Types
 * Strictly typed interfaces matching the V2 API documentation/requirements.
 * (Updated)
 */

import type { ChimeraAssetRef } from '@shared/types/chimera-assets';

// Re-export for convenience
export type { ChimeraAssetRef };

export interface ChimeraWorldV2 {
    id: string;
    display_name: string;
    description_short?: string;
    description_long?: string;
    tags: string[];
    images: ChimeraAssetRef[];
    metadata?: Record<string, unknown>;
    status: 'draft' | 'pending' | 'published';
    updated_at: string;
}

export interface ChimeraEntityV2 {
    id: string;
    display_name: string;
    entity_type: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION';
    archetype_handle?: string;
    images: ChimeraAssetRef[]; // Using shared type which has 'role' instead of 'usage_tag'
    status: string;
    updated_at: string;
}

export interface ChimeraStoryV2 {
    id: string;
    display_name: string;
    world_id: string;
    world_display_name?: string;
    status: string;
    updated_at: string;
}

/**
 * Helper to get the primary image URL from a list of assets.
 * Maps 'cover'/'primary' intent to shared 'banner'/'portrait' roles.
 */
export function getPrimaryImageUrl(images?: ChimeraAssetRef[]): string | null {
    if (!images || images.length === 0) {
        return null;
    }

    // Map user intent to shared roles
    // 'banner' is typically used for world covers
    // 'portrait' is typically used for entity primary images
    const primary = images.find(img => img.role === 'banner' || img.role === 'portrait');

    return primary ? primary.url : images[0].url;
}
