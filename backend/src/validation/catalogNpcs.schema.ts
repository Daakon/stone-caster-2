/**
 * Validation schema for NPC catalog list endpoint
 */

import { z } from 'zod';

export const listParamsSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  world: z.string().trim().min(1).max(120).optional(), // id or slug
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
  sort: z.enum(['name', 'created_at', 'popularity']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListParams = z.infer<typeof listParamsSchema>;

export const detailParamsSchema = z.object({
  idOrSlug: z.string().trim().min(1).max(120),
});

export type DetailParams = z.infer<typeof detailParamsSchema>;

