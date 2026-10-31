import type { SupabaseClient } from "@supabase/supabase-js";
import { getChimeraSupabaseAdminClient } from "../supabase-client.js";
import {
  SUPPORTED_CONTENT_FORMAT,
  type ContentRuntimeIdentity,
} from "../../../../shared/src/types/chimera-content-readiness.js";

export class ContentFormatRepository {
  constructor(
    private readonly client: SupabaseClient = getChimeraSupabaseAdminClient() as SupabaseClient,
  ) {}
  async inventory(runtime?: ContentRuntimeIdentity): Promise<unknown> {
    const probe = runtime
      ? this.client.rpc("chimera_register_content_runtime", {
          p_app_name: runtime.app_name,
          p_machine_id: runtime.machine_id,
          p_machine_version: runtime.machine_version,
          p_image_ref: runtime.image_ref,
          p_format_min: SUPPORTED_CONTENT_FORMAT.min,
          p_format_max: SUPPORTED_CONTENT_FORMAT.max,
        })
      : this.client.rpc("chimera_content_format_inventory");
    const { data, error } = await probe
      .abortSignal(AbortSignal.timeout(1000))
      .overrideTypes<unknown, { merge: false }>();
    if (error) throw new Error("Unable to read content format inventory");
    return data;
  }
}
