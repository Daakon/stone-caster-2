/**
 * Entity Guard Service
 * Phase 2c: Enforce publish immutability and ownership rules
 */

import type { Request } from 'express';
import { isAdmin } from '../middleware/auth-admin.js';

export interface EntityWithPublishStatus {
  owner_user_id: string;
  publish_status?: string | null;
}

export interface AssertCanMutateEntityParams {
  entity: EntityWithPublishStatus;
  userId: string;
  req?: Request; // Optional request for admin check
}

/**
 * Assert that a user can mutate an entity
 * - If entity is published and user is not admin → throws 403
 * - If user is not admin and doesn't own the entity → throws 403
 * @param params Entity, user ID, and optional request for admin check
 * @throws Error with message containing "Forbidden" if mutation is not allowed
 */
export async function assertCanMutateEntity(
  params: AssertCanMutateEntityParams
): Promise<void> {
  const { entity, userId, req } = params;

  // Check if entity is published
  const isPublished = entity.publish_status === 'published';

  // Check if user is admin
  let isUserAdmin = false;
  if (req) {
    isUserAdmin = await isAdmin(req);
  }

  // If published and user is not admin, deny
  if (isPublished && !isUserAdmin) {
    throw new Error('Forbidden: Published entities cannot be modified by non-admins');
  }

  // If user is not admin, must own the entity
  if (!isUserAdmin && entity.owner_user_id !== userId) {
    throw new Error('Forbidden: You do not own this entity');
  }
}



