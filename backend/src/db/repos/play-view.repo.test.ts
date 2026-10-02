import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { Database } from "../supabase-client.js";
import { StoriesRepository } from "./stories.repo.js";
import { PlayViewRepository } from "./play-view.repo.js";
import { getChimeraSupabaseClient } from "../supabase-client.js";

vi.mock("../supabase-client.js", () => ({ getChimeraSupabaseClient: vi.fn() }));
const query = () => {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
};
describe("owned play reads", () => {
  it("scopes every session query by both game and owner, without selecting the prompt", async () => {
    const chain = query();
    const client = { from: vi.fn().mockReturnValue(chain) };
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    const repository = new PlayViewRepository(
      client as unknown as SupabaseClient<Database>,
    );
    expect(await repository.loadOwnedSession("game", "owner")).toBeNull();
    expect(chain.eq.mock.calls).toEqual([
      ["id", "game"],
      ["player_id", "owner"],
    ]);
    expect(chain.select).toHaveBeenCalledWith(
      expect.not.stringContaining("compiled_system_prompt"),
    );
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "private database error" },
    });
    await expect(repository.loadOwnedSession("game", "owner")).rejects.toThrow(
      "Failed to load owned play session",
    );
  });
  it("uses the request-scoped client and exact compiled ID", async () => {
    const client = {} as SupabaseClient<Database>;
    vi.mocked(getChimeraSupabaseClient).mockReturnValue(client);
    const request = {} as Request;
    const repository = PlayViewRepository.forRequest(request);
    expect(getChimeraSupabaseClient).toHaveBeenCalledWith(request);
    const load = vi
      .spyOn(StoriesRepository.prototype, "getCompiledStoryById")
      .mockResolvedValue(null);
    expect(await repository.loadPinnedCompile("pinned")).toBeNull();
    expect(load).toHaveBeenCalledWith("pinned");
    load.mockRestore();
  });
  it("parses the stored pins and snapshot without manufacturing a prompt", async () => {
    const chain = query();
    const gameId = "00000000-0000-4000-8000-000000000001";
    const owner = "00000000-0000-4000-8000-000000000002";
    chain.maybeSingle.mockResolvedValue({
      error: null,
      data: {
        id: gameId,
        player_id: owner,
        compiled_story_id: "00000000-0000-4000-8000-000000000003",
        player_character_id: "00000000-0000-4000-8000-000000000004",
        state_initialization_version: 1,
        mechanical_state: {},
        narrative_focus: {},
        scene_registry: {},
        action_queue: [],
      },
    });
    const repository = new PlayViewRepository({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient<Database>);
    const state = await repository.loadOwnedSession(gameId, owner);
    expect(state?.id).toBe(gameId);
    expect(state?.state_initialization_version).toBe(1);
    expect(state?.compiled_system_prompt).toBeUndefined();
    chain.maybeSingle.mockResolvedValue({
      error: null,
      data: { id: gameId, player_id: owner },
    });
    await expect(repository.loadOwnedSession(gameId, owner)).rejects.toThrow();
  });
});
