import { z } from "zod";

export const TagReadQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
export type TagReadQuery = z.infer<typeof TagReadQuerySchema>;
export const TagReadSchema = z.object({
  id: z.string().min(1),
  tag_name: z.string().min(1),
  is_approved: z.literal(true),
});
export type TagRead = z.infer<typeof TagReadSchema>;
