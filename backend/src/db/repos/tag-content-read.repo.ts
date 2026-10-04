import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { z } from "zod";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import {
  TagReadSchema,
  type TagRead,
  type TagReadQuery,
} from "../../../../shared/src/types/chimera-tag-read.js";

/** A fresh, bounded page under caller RLS; no service-role tag lookup. */
export class TagContentReadRepository {
  static forRequest(req: Request): TagContentReadRepository {
    return new TagContentReadRepository(getChimeraSupabaseClient(req));
  }
  constructor(private readonly client: SupabaseClient) {}
  async list(params: TagReadQuery): Promise<TagRead[]> {
    const { data, error } = await this.client
      .rpc("chimera_approved_tag_page", {
        p_limit: params.limit,
        p_offset: params.offset,
      })
      .abortSignal(AbortSignal.timeout(2000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("Tag selector unavailable");
    return z.array(TagReadSchema).max(params.limit).parse(data);
  }
}
