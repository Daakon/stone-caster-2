import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LoreContentWriteRepository,
  LoreWriteRepositoryError,
} from "./lore-content-write.repo.js";
import {
  LoreCreateSchema,
  LoreUpdateSchema,
} from "../../../../shared/src/types/chimera-lore-write.js";
import {
  loreWriteFixture as row,
  loreWriteId as id,
  loreWriteWorld as world,
} from "../../__tests__/fixtures/lore-write.js";
function fixture(data: unknown = row, error: unknown = null) {
  const overrideTypes = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ overrideTypes });
  return {
    repo: new LoreContentWriteRepository({ rpc } as unknown as SupabaseClient),
    rpc,
  };
}
describe("atomic lore write repository", () => {
  it("makes one caller-RLS mutation with no owner argument or client-side source read", async () => {
    const f = fixture(),
      input = LoreCreateSchema.parse({
        world_id: world,
        display_name: "Authored",
        entry_text: "Facts",
      });
    expect(await f.repo.write("create", null, input)).toEqual(row);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledWith("chimera_write_owned_lore", {
      p_action: "create",
      p_id: null,
      p_data: input,
    });
    expect(await f.repo.write("update", id, { entry_text: "Changed" })).toEqual(
      row,
    );
    expect(f.rpc).toHaveBeenLastCalledWith("chimera_write_owned_lore", {
      p_action: "update",
      p_id: id,
      p_data: { entry_text: "Changed" },
    });
  });
  it("parses deletion separately from source results", async () => {
    const f = fixture({ id, deleted: true });
    expect(await f.repo.write("delete", id, {})).toEqual({ id, deleted: true });
  });
  it.each([
    null,
    {},
    { ...row, owner_kind: "first_party" },
    { ...row, embedding: [100] },
  ])("rejects malformed or privileged response %s", async (data) => {
    await expect(
      fixture(data).repo.write("update", id, { entry_text: "Changed" }),
    ).rejects.toThrow();
  });
  it("retains only recognized entitlement reasons and safe error codes", async () => {
    for (const message of [
      "STORY_READ_ONLY_TIER_LIMIT",
      "ENTITLEMENT_NOT_CONFIGURED",
      "secret SQL/body diagnostics",
    ]) {
      const promise = fixture(null, { code: "P0001", message }).repo.write(
        "delete",
        id,
        {},
      );
      await expect(promise).rejects.toMatchObject({
        code: "P0001",
        reason: message.startsWith("secret") ? null : message,
      });
      await expect(promise).rejects.toThrow(LoreWriteRepositoryError);
      await expect(promise).rejects.toThrow("Lore write unavailable");
    }
  });
  it.each([
    { owner_kind: "first_party" },
    { owner_user_id: id },
    { visibility: "public" },
    { embedding: [] },
    { content_key: "spoof" },
    { fragment: {} },
    { world_id: world },
  ])("rejects spoofed/unsupported update fields %s", (patch) => {
    expect(
      LoreUpdateSchema.safeParse({ entry_text: "Facts", ...patch }).success,
    ).toBe(false);
  });
  it("requires a create context and bounds work without inventing a lore type", () => {
    expect(
      LoreCreateSchema.safeParse({ display_name: "Name", entry_text: "Facts" })
        .success,
    ).toBe(false);
    expect(LoreUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      LoreUpdateSchema.safeParse({ entry_text: "a".repeat(100001) }).success,
    ).toBe(false);
    expect(
      LoreUpdateSchema.safeParse({
        tag_names: Array.from({ length: 101 }, () => "TAG"),
      }).success,
    ).toBe(false);
    expect(
      LoreCreateSchema.parse({
        world_id: world,
        display_name: "Name",
        entry_text: "Facts",
      }).type,
    ).toBeUndefined();
  });
});
