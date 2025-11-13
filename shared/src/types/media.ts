import { z } from 'zod';

/**
 * Admin Media Types
 * Phase 1: Foundation types for media assets and links
 */

/**
 * Media kind enum
 */
export const MediaKindSchema = z.enum(['npc', 'world', 'story', 'site']);
export type MediaKind = z.infer<typeof MediaKindSchema>;

/**
 * Media visibility enum
 */
export const MediaVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type MediaVisibility = z.infer<typeof MediaVisibilitySchema>;

/**
 * Media status enum
 */
export const MediaStatusSchema = z.enum(['pending', 'ready', 'failed']);
export type MediaStatus = z.infer<typeof MediaStatusSchema>;

/**
 * Image review status enum
 */
export const ImageReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ImageReviewStatus = z.infer<typeof ImageReviewStatusSchema>;

/**
 * Media Asset DTO Schema
 * Phase 2b: Consistent DTO for media asset responses
 */
export const MediaAssetDTOSchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  kind: MediaKindSchema,
  provider: z.string(),
  provider_key: z.string(),
  visibility: MediaVisibilitySchema,
  status: MediaStatusSchema,
  image_review_status: ImageReviewStatusSchema,
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sha256: z.string().nullable(),
  created_at: z.string().datetime(),
  ready_at: z.string().datetime().nullable(),
});

export type MediaAssetDTO = z.infer<typeof MediaAssetDTOSchema>;

/**
 * Media Link DTO Schema
 * Phase 2c: Gallery link management
 */
export const MediaLinkDTOSchema = z.object({
  id: z.string().uuid(),
  role: z.string().default('gallery'),
  sort_order: z.number().int().default(0),
  media_id: z.string().uuid(),
  target: z.object({
    kind: MediaKindSchema,
    id: z.string(),
  }),
});

export type MediaLinkDTO = z.infer<typeof MediaLinkDTOSchema>;

/**
 * Request schemas for cover media
 */
export const SetCoverMediaRequestSchema = z.object({
  mediaId: z.string().uuid().nullable(),
});

/**
 * Request schemas for gallery links
 */
export const CreateMediaLinkRequestSchema = z.object({
  target: z.object({
    kind: MediaKindSchema,
    id: z.string(),
  }),
  mediaId: z.string().uuid(),
  role: z.string().default('gallery').optional(),
  sortOrder: z.number().int().default(0).optional(),
});

export const ReorderMediaLinksRequestSchema = z.object({
  target: z.object({
    kind: MediaKindSchema,
    id: z.string(),
  }),
  orders: z.array(
    z.object({
      linkId: z.string().uuid(),
      sortOrder: z.number().int(),
    })
  ),
});

/**
 * Phase 2d: Approval request/response schemas
 */
export const ListPendingQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 25),
  cursor: z.string().optional(),
  kind: MediaKindSchema.optional(),
  owner: z.string().uuid().optional(),
});

export const ReviewMediaRequestSchema = z.object({
  review: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

export const BulkReviewMediaRequestSchema = z.object({
  ids: z.array(z.string().uuid()),
  review: z.enum(['approved', 'rejected']),
});

