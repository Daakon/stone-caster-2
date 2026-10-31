import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import catalogRouter from "../src/routes/catalog.js";
import { supabaseAdmin } from "../src/services/supabase.js";
import * as clients from "../src/db/supabase-client.js";
import * as caches from "../src/services/content/content-cache.service.js";

vi.mock("../src/services/supabase.js", () => ({
  supabase: {},
  supabaseAdmin: { from: vi.fn() },
}));
afterEach(() => {
  vi.restoreAllMocks();
});

describe("catalog NPC slug compatibility", () => {
  const app = express().use("/api/catalog", catalogRouter);
  it("preserves authored slugs through the anonymous reader instead of service-role body queries", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const owner = "00000000-0000-4000-8000-000000000002";
    const world = "00000000-0000-4000-8000-000000000003";
    const row = {
      id,
      key: "stable-key",
      content_key: "stable-key",
      slug: "cael",
      owner_kind: "player",
      owner_namespace: owner,
      owner_user_id: owner,
      entity_type: "NPC",
      release_state: "published",
      visibility: "public",
      world_id: world,
      display_name: "Cael",
      primary_image_url: null,
      raw_data: { description_short: "A loyal guide." },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const overrideTypes = vi
      .fn()
      .mockResolvedValue({ data: { items: [row], total: 1 }, error: null });
    const abortSignal = vi.fn().mockReturnValue({ overrideTypes });
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    const requestClient = vi
      .spyOn(clients, "getChimeraSupabaseClient")
      .mockReturnValue({ rpc } as unknown as SupabaseClient);
    const cache = new caches.ContentCacheService({
      page: () =>
        Promise.resolve({
          shared: {
            generation: "0",
            head_seq: "0",
            retained_after_seq: "0",
            changes: [],
          },
          owners: [],
        }),
    });
    vi.spyOn(caches, "getContentCache").mockReturnValue(cache);

    const response = await request(app).get("/api/catalog/npcs");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      items: [
        {
          id,
          slug: "cael",
          name: "Cael",
          worldId: world,
          description: "A loyal guide.",
          status: null,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(
      requestClient.mock.calls.every((call) => call[0] === undefined),
    ).toBe(true);
    expect(rpc).toHaveBeenCalledWith("chimera_public_npc_page", {
      p_search: null,
      p_world: null,
      p_world_key: null,
      p_active_only: false,
      p_limit: 20,
      p_offset: 0,
    });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
