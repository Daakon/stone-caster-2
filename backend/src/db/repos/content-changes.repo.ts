import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseAdminClient } from "../supabase-client.js";
import type { ContentOwnerCursor } from "../../../../shared/src/types/chimera-content-changes.js";

export class ContentChangesRepository {
  constructor(
    private readonly client: SupabaseClient = getChimeraSupabaseAdminClient() as SupabaseClient,
  ) {}
  async page(
    after: string | null,
    owners: ContentOwnerCursor[],
  ): Promise<unknown> {
    const { data, error } = await this.client
      .rpc("chimera_content_change_page", {
        p_after_seq: after,
        p_owners: owners,
        p_limit: 100,
      })
      .abortSignal(AbortSignal.timeout(1000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("Unable to read content changes");
    return data;
  }
}
