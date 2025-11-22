/**
 * Chimera Asset Reference Types
 * Defines the structure for referencing assets (images, media) within the Chimera system
 */

import { z } from 'zod';

/**
 * Asset role types that define how an asset is used in the system
 */
export const ChimeraAssetRoleSchema = z.enum(['icon', 'banner', 'portrait', 'gallery']);

export type ChimeraAssetRole = z.infer<typeof ChimeraAssetRoleSchema>;

/**
 * ChimeraAssetRef
 * Reference to an asset with metadata about its role and usage
 */
export const ChimeraAssetRefSchema = z.object({
  /**
   * Unique identifier for the asset
   */
  id: z.string().uuid(),

  /**
   * URL or path to the asset resource
   */
  url: z.string().url(),

  /**
   * Role of the asset in the system
   */
  role: ChimeraAssetRoleSchema,

  /**
   * Optional human-readable label for the asset
   */
  label: z.string().optional(),

  /**
   * Optional metadata object for additional asset information
   */
  meta: z.record(z.unknown()).optional(),
});

export type ChimeraAssetRef = z.infer<typeof ChimeraAssetRefSchema>;

