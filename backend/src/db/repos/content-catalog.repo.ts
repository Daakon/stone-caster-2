import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContentKeyRef,
  ContentKind,
  ContentReleaseState,
} from "../../../../shared/src/types/chimera-content.js";

export interface ContentCatalogRow extends ContentKeyRef {
  content_kind: ContentKind;
  content_format_version: number;
  body: Record<string, unknown>;
  content_refs: ContentKeyRef[];
  content_hash: string;
  release_state: ContentReleaseState;
  catalog_generation: number;
}

export class ContentCatalogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getGeneration(): Promise<number> {
    const { data, error } = await (
      this.supabase.from("chimera_content_catalog_state") as any
    )
      .select("generation")
      .eq("singleton", true)
      .single();
    if (error || !data)
      throw new Error(
        `Failed to read content catalog generation: ${error?.message ?? "row missing"}`,
      );
    return Number(data.generation);
  }

  async find(ref: ContentKeyRef): Promise<ContentCatalogRow | null> {
    const { data, error } = await (
      this.supabase.from("chimera_content_source_items") as any
    )
      .select(
        "content_kind, owner_namespace, content_key, content_format_version, body, content_refs, content_hash, release_state, catalog_generation",
      )
      .eq("content_kind", ref.kind)
      .eq("owner_namespace", ref.owner_namespace)
      .eq("content_key", ref.key)
      .maybeSingle();
    if (error)
      throw new Error(
        `Failed to read ${ref.kind}:${ref.key}: ${error.message}`,
      );
    if (!data) return null;
    return {
      ...data,
      kind: data.content_kind,
      key: data.content_key,
    } as ContentCatalogRow;
  }

  async listByKind(kind: ContentKind): Promise<ContentCatalogRow[]> {
    const { data, error } = await (
      this.supabase.from("chimera_content_source_items") as any
    )
      .select(
        "content_kind, owner_namespace, content_key, content_format_version, body, content_refs, content_hash, release_state, catalog_generation",
      )
      .eq("content_kind", kind)
      .eq("owner_namespace", "first_party")
      .order("content_key");
    if (error)
      throw new Error(`Failed to read ${kind} content: ${error.message}`);
    return (data ?? []).map((row: any) => ({
      ...row,
      kind: row.content_kind,
      key: row.content_key,
    }));
  }
}
