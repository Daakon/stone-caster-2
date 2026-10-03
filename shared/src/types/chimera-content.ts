type ContentFormatVersion = 1;
export type ContentReleaseState = "internal" | "published";

export type ContentKind =
  | "ruleset"
  | "world"
  | "entity"
  | "lore"
  | "tag"
  | "asset_tag"
  | "mechanic_skill"
  | "mechanic_condition"
  | "mechanic_resource"
  | "premade_character"
  | "localization_glossary"
  | "localization_rule"
  | "localization_pack"
  | "injection_map"
  | "dialogue_config"
  | "dialogue_graph"
  | "quest_graph"
  | "quest_graph_index"
  | "content_pack"
  | "exclusion_group"
  | "world_ruleset_link"
  | "pack_entity_link"
  | "pack_lore_link"
  | "pack_ruleset_link"
  | "pack_dependency";

export interface ContentKeyRef {
  kind: ContentKind;
  owner_namespace: string;
  key: string;
}

export interface ContentSourceItemV1 {
  kind: ContentKind;
  key: string;
  body: Record<string, unknown> | unknown[];
  refs: ContentKeyRef[];
}

export interface ContentFileV1 {
  format_version: ContentFormatVersion;
  items: ContentSourceItemV1[];
}

export interface ContentManifestV1 {
  format_version: ContentFormatVersion;
  namespace: "first_party";
  release_state: "internal";
  files: string[];
}

export interface ContentSyncBundleV1 {
  items: Array<
    ContentSourceItemV1 & {
      owner_namespace: "first_party";
      format_version: ContentFormatVersion;
    }
  >;
}

export interface CompiledContentManifestV1 {
  kind: ContentKind | "compiled_payload";
  owner_namespace: string;
  key: string;
  sha256: string;
}

export interface FirstPartyCompileSelectionV1 {
  world: ContentKeyRef;
  rulesets: ContentKeyRef[];
  entities: ContentKeyRef[];
  lore?: ContentKeyRef[];
  title?: string;
}
