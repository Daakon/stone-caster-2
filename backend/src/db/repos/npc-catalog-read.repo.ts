import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import { EntityContentReadRepository } from "./entity-content-read.repo.js";
import type { EntityContentRow } from "./entity-content-read.repo.js";
import type { NpcCatalogQuery } from "../../../../shared/src/types/chimera-npc-catalog-read.js";

const pageSchema = z.object({
  items: z.array(
    z
      .object({
        content_key: z.string(),
        owner_namespace: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
      })
      .passthrough(),
  ),
  total: z.number().int().nonnegative(),
});
export class NpcCatalogReadRepository {
  static forPublic(): NpcCatalogReadRepository {
    return new NpcCatalogReadRepository(getChimeraSupabaseClient());
  }
  private readonly entities: EntityContentReadRepository;
  constructor(private readonly client: SupabaseClient) {
    this.entities = new EntityContentReadRepository(client);
  }
  worldKey(id: string): Promise<string | null> {
    return this.entities.worldKey(id);
  }
  firstPartyAliases(keys: string[]) {
    return this.entities.firstPartyAliases(keys);
  }
  async list(
    params: NpcCatalogQuery,
    worldKey: string | null,
  ): Promise<{ items: EntityContentRow[]; total: number }> {
    const { data, error } = await this.client
      .rpc("chimera_public_npc_page", {
        p_search: params.q || params.search || null,
        p_world: params.world ?? null,
        p_world_key: worldKey,
        p_active_only: params.activeOnly,
        p_limit: params.limit,
        p_offset: params.offset,
      })
      .abortSignal(AbortSignal.timeout(2000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("NPC catalog unavailable");
    return pageSchema.parse(data);
  }
}
