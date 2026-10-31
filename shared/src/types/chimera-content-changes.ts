import { z } from "zod";

const ContentCursorSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
const facets = z.record(z.union([z.string(), z.array(z.string())])).nullable();
const ContentChangeSchema = z
  .object({
    seq: ContentCursorSchema,
    generation: ContentCursorSchema,
    kind: z.string().min(1),
    namespace: z.string().min(1),
    key: z.string().min(1),
    old_facets: facets,
    new_facets: facets,
  })
  .strict();
export type ContentChange = z.infer<typeof ContentChangeSchema>;
const stream = z.object({
  generation: ContentCursorSchema,
  head_seq: ContentCursorSchema,
  retained_after_seq: ContentCursorSchema,
  changes: z.array(ContentChangeSchema).max(100),
});
export const ContentChangePageSchema = z
  .object({
    shared: stream,
    owners: z.array(stream.extend({ user_id: z.string().uuid() })).max(32),
  })
  .strict();
export type ContentChangePage = z.infer<typeof ContentChangePageSchema>;
export type ContentOwnerCursor = { user_id: string; after_seq: string | null };
export type ContentCacheAddress =
  | { type: "blob"; sha256: string }
  | (({ scope: "shared" } | { scope: "owner"; owner: string }) &
      (
        | {
            type: "source" | "preview";
            kind: string;
            namespace: string;
            key: string;
            audience: string;
          }
        | {
            type: "list";
            kind: string;
            audience: string;
            filter: Record<string, string | string[]>;
            page: string;
          }
      ));
