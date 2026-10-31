import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseClient } from "../supabase-client.js";
import type { ContentDeployHistoryQuery } from "../../../../shared/src/types/chimera-content-deploy.js";

export class ContentDeployHistoryRepository {
  constructor(private readonly client: SupabaseClient) {}
  static forRequest(request: Request) {
    return new ContentDeployHistoryRepository(
      getChimeraSupabaseClient(request) as SupabaseClient,
    );
  }
  async page(query: ContentDeployHistoryQuery): Promise<unknown> {
    const { data, error } = await this.client
      .rpc("chimera_admin_content_deploy_log", {
        p_limit: query.limit,
        p_before_generation: query.before_generation ?? null,
      })
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("Unable to read content deployment history");
    return data;
  }
}
