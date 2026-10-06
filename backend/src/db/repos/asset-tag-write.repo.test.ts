import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AssetTagWriteRepository,
  AssetTagWriteRepositoryError,
} from "./asset-tag-write.repo.js";
const id = "00000000-0000-4000-8000-000000000010";
function fixture(
  data: unknown = [{ id, tag_name: "AUTHORED" }],
  error: unknown = null,
) {
  const rpc = vi.fn().mockReturnValue({
    overrideTypes: vi.fn().mockResolvedValue({ data, error }),
  });
  return {
    rpc,
    repo: new AssetTagWriteRepository({ rpc } as unknown as SupabaseClient),
  };
}
describe("owned asset tag repository", () => {
  it("uses one request-RLS RPC without owner arguments, global lookups or retries", async () => {
    const f = fixture();
    expect(await f.repo.replace("world", id, ["AUTHORED"])).toEqual([
      { id, tag_name: "AUTHORED" },
    ]);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.rpc).toHaveBeenCalledWith("chimera_replace_owned_asset_tags", {
      p_asset_type: "world",
      p_asset_id: id,
      p_tag_names: ["AUTHORED"],
    });
    await f.repo.replace("entity_template", id, []);
    expect(f.rpc).toHaveBeenLastCalledWith("chimera_replace_owned_asset_tags", {
      p_asset_type: "entity_template",
      p_asset_id: id,
      p_tag_names: [],
    });
  });
  it.each([
    null,
    {},
    [{ id: "canonical", tag_name: "NAME" }],
    [{ id, tag_name: "NAME", owner_user_id: id }],
  ])("refuses invalid result %s", async (data) => {
    await expect(fixture(data).repo.replace("world", id, [])).rejects.toThrow();
  });
  it("drops database diagnostics and never retries a failed mutation", async () => {
    const f = fixture(null, {
      code: "40001",
      message: "secret name or SQL",
      details: "secret",
    });
    const promise = f.repo.replace("world", id, []);
    await expect(promise).rejects.toThrow(AssetTagWriteRepositoryError);
    await expect(promise).rejects.toMatchObject({
      code: "40001",
      message: "Asset tag write unavailable",
    });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
});
