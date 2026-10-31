import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, it, expect, vi } from "vitest";
import type { Database } from "../supabase-client.js";
import {
  CompiledStoriesRepository,
  FrozenCompileRetryError,
} from "./compiled-stories.repo.js";

describe("frozen publication retry classification", () => {
  function repository(result: unknown) {
    const rpc = vi.fn().mockResolvedValue(result);
    return new CompiledStoriesRepository({
      rpc,
    } as unknown as SupabaseClient<Database>);
  }
  it.each(["40001", "40P01"])(
    "classifies PostgreSQL %s as retryable",
    async (code) => {
      await expect(
        repository({ error: { code, message: "conflict" } }).publishFrozen(
          1,
          null,
          "fixture",
          [],
          {},
        ),
      ).rejects.toBeInstanceOf(FrozenCompileRetryError);
    },
  );
  it("does not classify an authorization failure as retryable", async () => {
    await expect(
      repository({ error: { code: "42501", message: "denied" } }).publishFrozen(
        1,
        null,
        "fixture",
        [],
        {},
      ),
    ).rejects.toThrow("denied");
  });
  it("requires the database to return a compiled ID", async () => {
    expect(
      await repository({ data: "compiled-id", error: null }).publishFrozen(
        1,
        null,
        "fixture",
        [],
        {},
      ),
    ).toBe("compiled-id");
    await expect(
      repository({ data: null, error: null }).publishFrozen(
        1,
        null,
        "fixture",
        [],
        {},
      ),
    ).rejects.toThrow("no compiled story ID");
  });
});
