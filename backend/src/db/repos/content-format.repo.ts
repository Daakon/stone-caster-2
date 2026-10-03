import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseAdminClient } from "../supabase-client.js";

export class ContentFormatRepository {
  constructor(
    private readonly client: SupabaseClient = getChimeraSupabaseAdminClient() as SupabaseClient,
  ) {}
  async inventory(): Promise<unknown> {
    const { data, error } = await this.client
      .rpc("chimera_content_format_inventory")
      .abortSignal(AbortSignal.timeout(1000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("Unable to read content format inventory");
    return data;
  }
}
