/**
 * Media Guard Service
 * Phase 2c: Enforce media ownership rules
 */

import type { Request } from 'express';
import { isAdmin } from '../middleware/auth-admin.js';

export interface MediaWithOwner {
  owner_user_id: string;
}

export interface AssertMediaOwnershipOrAdminParams {
  media: MediaWithOwner;
  userId: string;
  req?: Request; // Optional request for admin check
}

/**
 * Assert that a user owns a media asset or is an admin
 * - If user is not admin and doesn't own the media → throws 403
 * @param params Media, user ID, and optional request for admin check
 * @throws Error with message containing "Forbidden" if access is not allowed
 */
export async function assertMediaOwnershipOrAdmin(
  params: AssertMediaOwnershipOrAdminParams
): Promise<void> {
  const { media, userId, req } = params;

  // Check if user is admin
  let isUserAdmin = false;
  if (req) {
    isUserAdmin = await isAdmin(req);
  }

  // If user is not admin, must own the media
  if (!isUserAdmin && media.owner_user_id !== userId) {
    throw new Error('Forbidden: You do not own this media asset');
  }
}



