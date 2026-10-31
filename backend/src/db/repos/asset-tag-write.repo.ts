import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import {
  AssetTagResultSchema,
  type AssetTagType,
} from "../../../../shared/src/types/chimera-asset-tags.js";

export class AssetTagWriteRepositoryError extends Error {
  constructor(readonly code: string) {
    super("Asset tag write unavailable");
  }
}
export class AssetTagWriteRepository {
  static forRequest(req: Request) {
    return new AssetTagWriteRepository(getChimeraSupabaseClient(req));
  }
  constructor(private readonly client: SupabaseClient) {}
  async replace(type: AssetTagType, id: string, names: string[]) {
    const { data, error } = await this.client
      .rpc("chimera_replace_owned_asset_tags", {
        p_asset_type: type,
        p_asset_id: id,
        p_tag_names: names,
      })
      .overrideTypes<unknown, { merge: false }>();
    // No retry or read-abort deadline: neither can undo a committed mutation.
    if (error) throw new AssetTagWriteRepositoryError(error.code);
    return AssetTagResultSchema.parse(data);
  }
}
