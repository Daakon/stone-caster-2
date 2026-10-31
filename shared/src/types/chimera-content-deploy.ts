import { z } from "zod";

const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const ContentDeployMetadataSchema = z
  .object({ commit_sha: z.string().regex(/^[0-9a-f]{40}$/) })
  .strict();
export type ContentDeployMetadata = z.infer<typeof ContentDeployMetadataSchema>;
const key = z
  .object({
    kind: z.string().min(1),
    namespace: z.literal("first_party"),
    key: z.string().min(1),
  })
  .strict();
const change = key.extend({ old_hash: hash.nullable(), new_hash: hash });
export const ContentDeployReceiptSchema = z
  .object({
    generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    manifest_hash: hash,
    item_count: z.number().int().positive(),
    deploy_id: z.string().uuid(),
    commit_sha: ContentDeployMetadataSchema.shape.commit_sha,
    format_version: z.literal(1),
    changed_keys: z.array(key),
    old_new_hashes: z.array(change),
    outcome: z.literal("applied"),
  })
  .strict();
export type ContentDeployReceipt = z.infer<typeof ContentDeployReceiptSchema>;
const generation = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
export const ContentDeployHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    before_generation: generation.optional(),
  })
  .strict();
export type ContentDeployHistoryQuery = z.infer<
  typeof ContentDeployHistoryQuerySchema
>;
const entry = z.object({
  id: z.string().uuid(),
  generation,
  manifest_hash: hash,
  item_count: z.number().int().nonnegative(),
  actor: z.string().min(1),
  deployed_at: z.string().datetime({ offset: true }),
});
export const ContentDeployHistorySchema = z
  .object({
    items: z.array(
      z.discriminatedUnion("provenance", [
        entry
          .extend({
            provenance: z.literal("legacy"),
            commit_sha: z.null(),
            format_version: z.null(),
            changed_keys: z.null(),
            old_new_hashes: z.null(),
            outcome: z.null(),
          })
          .strict(),
        entry
          .extend({
            provenance: z.literal("recorded"),
            commit_sha: ContentDeployMetadataSchema.shape.commit_sha,
            format_version: z.number().int().positive(),
            changed_keys: z.array(key),
            old_new_hashes: z.array(change),
            outcome: z.literal("applied"),
          })
          .strict(),
      ]),
    ),
    next_before_generation: generation.nullable(),
  })
  .strict();
export type ContentDeployHistory = z.infer<typeof ContentDeployHistorySchema>;
/** Operator-selected connection policy; never include this object in logs. */
export type ContentDeploymentConnection =
  | { target: "local" }
  | {
      target: "staging" | "production";
      expectedDatabase: string;
      expectedApp: string;
      tls: {
        ca: string;
        servername: string;
        rejectUnauthorized: true;
        minVersion: "TLSv1.2";
      };
    };
