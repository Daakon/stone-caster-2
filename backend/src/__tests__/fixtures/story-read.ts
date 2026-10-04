import type { StorySourceRead } from "../../../../shared/src/types/chimera-story-read.js";
import type { WorldRead } from "../../../../shared/src/types/chimera-world-read.js";
export const storyOwner = "00000000-0000-4000-8000-000000000001";
export const storyOther = "00000000-0000-4000-8000-000000000002";
export const storyId = "00000000-0000-4000-8000-000000000003";
export const storyWorldId = "00000000-0000-4000-8000-000000000004";
export function storyFixture(user = storyOwner): StorySourceRead {
  return {
    id: storyId,
    display_name: "Authored story",
    owner_user_id: user,
    owner_kind: "player",
    owner_namespace: user,
    content_key: "story-key",
    release_state: "internal",
    visibility: "private",
    version: 1,
    content_rating: "safe",
    is_system_asset: false,
    created_at: "2026-10-04",
    updated_at: "2026-10-04",
    last_edited_at: null,
    story_definition: { authored: true },
    configuration: { rulesetIds: ["declared-rules"] },
    genesis_config: {},
    description_short: null,
    description: null,
    title: null,
    primary_image_url: null,
    image_url: null,
    opening_text: null,
    world_id: storyWorldId,
    protagonist_id: null,
    cast_ids: [],
    entity_ids: [],
    active_ruleset_ids: [],
    status: "draft",
    compile_status: "draft",
    current_compiled_id: null,
  };
}
export function storyWorldFixture(): WorldRead {
  return {
    id: storyWorldId,
    key: "world",
    content_key: "world",
    owner_kind: "player",
    owner_namespace: storyOwner,
    owner_user_id: storyOwner,
    release_state: "internal",
    visibility: "private",
    is_official: false,
    name: "Authored world",
    display_name: "Authored world",
    slug: "world",
    definition: {},
    description_short: "Authored description",
    description_long: null,
    character_schema_contributions: {},
    tags: [],
    genre_tags: [],
    images: [],
    genre: null,
    setting: null,
    created_at: "2026-10-04",
    updated_at: "2026-10-04",
  };
}
