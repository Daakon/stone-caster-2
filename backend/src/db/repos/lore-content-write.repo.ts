import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import {
  LoreDeleteResultSchema,
  LoreWriteResultSchema,
  type LoreWriteAction,
  type LoreCreate,
  type LoreUpdate,
  type LoreWriteResult,
  type LoreDeleteResult,
} from "../../../../shared/src/types/chimera-lore-write.js";

/** Retain only codes and explicitly recognized reasons, never database diagnostics. */
export class LoreWriteRepositoryError extends Error {
  constructor(
    readonly code: string,
    readonly reason: string | null,
  ) {
    super("Lore write unavailable");
  }
}
export class LoreContentWriteRepository {
  static forRequest(req: Request): LoreContentWriteRepository {
    return new LoreContentWriteRepository(getChimeraSupabaseClient(req));
  }
  constructor(private readonly client: SupabaseClient) {}
  write(
    action: "delete",
    id: string | null,
    data: LoreUpdate,
  ): Promise<LoreDeleteResult>;
  write(
    action: "create" | "update",
    id: string | null,
    data: LoreCreate | LoreUpdate,
  ): Promise<LoreWriteResult>;
  async write(
    action: LoreWriteAction,
    id: string | null,
    data: LoreCreate | LoreUpdate,
  ) {
    const { data: result, error } = await this.client
      .rpc("chimera_write_owned_lore", {
        p_action: action,
        p_id: id,
        p_data: data,
      })
      .overrideTypes<unknown, { merge: false }>();
    // Writes rely on the database's transaction/statement timeout; an HTTP read abort
    // cannot undo a committed mutation and must not invite an automatic write retry.
    if (error) {
      const reason = [
        "STORY_READ_ONLY_TIER_LIMIT",
        "ENTITLEMENT_NOT_CONFIGURED",
      ].includes(error.message)
        ? error.message
        : null;
      throw new LoreWriteRepositoryError(error.code, reason);
    }
    return action === "delete"
      ? LoreDeleteResultSchema.parse(result)
      : LoreWriteResultSchema.parse(result);
  }
}
