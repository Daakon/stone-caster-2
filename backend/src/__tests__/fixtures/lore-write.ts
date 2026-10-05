import { LoreWriteResultSchema } from "../../../../shared/src/types/chimera-lore-write.js";
export const loreWriteOwner = "00000000-0000-4000-8000-000000000001";
export const loreWriteId = "00000000-0000-4000-8000-000000000002";
export const loreWriteWorld = "00000000-0000-4000-8000-000000000003";
export const loreWriteFixture = LoreWriteResultSchema.parse({
  id: loreWriteId,
  content_key: loreWriteId,
  owner_kind: "player",
  owner_namespace: loreWriteOwner,
  owner_user_id: loreWriteOwner,
  visibility: "private",
  release_state: "internal",
  is_official: false,
  world_id: loreWriteWorld,
  entity_id: null,
  story_id: null,
  fragment: { display_name: "Authored lore", entry_text: "Authored facts" },
  keywords: [],
  display_name: "Authored lore",
  entry_text: "Authored facts",
  content_chunk: "Authored facts",
  type: null,
  embedding: null,
  tags: [],
  created_at: "2026-10-04T00:00:00Z",
  updated_at: "2026-10-04T00:00:00Z",
});
