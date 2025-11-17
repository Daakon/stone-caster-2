/**
 * Chimera Profile Service
 * API client for Chimera V2 creator profile endpoints
 */

import { apiFetch, apiPut } from '@/lib/api';

export interface CreatorProfileData {
  creator_slug: string | null;
  public_bio: string | null;
  profile_image_url: string | null;
  website_url: string | null;
}

export interface UpdateCreatorProfileData {
  creator_slug?: string | null;
  public_bio?: string | null;
  website_url?: string | null;
  new_avatar_url?: string | null;
}

export const chimeraProfileService = {
  /**
   * Update creator profile fields
   */
  async updateCreatorProfile(data: UpdateCreatorProfileData): Promise<CreatorProfileData> {
    const result = await apiPut<CreatorProfileData>('/api/v2/chimera/profile', data);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to update creator profile');
    }
    return result.data!;
  },
};

