import { z } from "zod";

export const ContentGcRequestSchema = z
  .object({
    batch_size: z.number().int().min(1).max(1000),
    dry_run: z.boolean(),
  })
  .strict();
export type ContentGcRequest = z.infer<typeof ContentGcRequestSchema>;
const count = z.number().int().nonnegative();
export const ContentGcReceiptSchema = z
  .object({
    dry_run: z.boolean(),
    batch_size: z.number().int().min(1).max(1000),
    compiled_candidates: count,
    blob_candidates: count,
    compiled_deleted: count,
    blobs_deleted: count,
    bytes_eligible: z.string().regex(/^\d+$/),
    bytes_reclaimed: z.string().regex(/^\d+$/),
  })
  .strict();
export type ContentGcReceipt = z.infer<typeof ContentGcReceiptSchema>;
