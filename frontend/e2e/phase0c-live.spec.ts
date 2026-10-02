import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import { PlayViewSchema } from "../../shared/src/types/chimera-play-view";

// Reuse the backend's database driver for isolated local harness fixtures.
const { Client } = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("pg") as typeof import("pg");
const environmentSchema = z.object({
  API_BASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
});
let env: z.infer<typeof environmentSchema>;
let api: string;
let database: string;
let token: string;
let gameId: string;
let characterId: string;
let compiledId: string;
let worldId: string;
const entitlementTier = `phase0c-${randomUUID()}`;
let priorEntitlement: { tier_key: string; assigned_at: Date } | undefined;
let entitlementFixtureCreated = false;
const snapshotSchema = z
  .object({
    play_view: z.unknown(),
    mechanical_state: z.object({ entities: z.record(z.unknown()) }),
  })
  .passthrough();
const call = async (path: string, body?: unknown): Promise<unknown> => {
  const response = await fetch(new URL(path, api), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result: unknown = await response.json();
  expect(response.ok, JSON.stringify(result)).toBe(true);
  return z.object({ data: z.unknown() }).parse(result).data;
};
const readSnapshot = async () => {
  const snapshot = snapshotSchema.parse(
    await call(`/api/chimera/play/${gameId}`),
  );
  return { ...snapshot, play_view: PlayViewSchema.parse(snapshot.play_view) };
};

test.beforeAll(async () => {
  env = environmentSchema.parse(
    Object.fromEntries(
      readFileSync(
        new URL("../../.env.stonecaster-local", import.meta.url),
        "utf8",
      )
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [
          line.slice(0, line.indexOf("=")),
          line.slice(line.indexOf("=") + 1),
        ]),
    ),
  );
  api = env.API_BASE_URL;
  database = env.SUPABASE_URL;
  for (const endpoint of [api, database, env.DATABASE_URL])
    if (!["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname))
      throw Error("Phase 0C browser tests require the isolated local stack");

  const health: unknown = await (await fetch(new URL("/health", api))).json();
  expect(z.object({ mockAi: z.boolean() }).parse(health).mockAi).toBe(true);
  const response = await fetch(
    new URL("/auth/v1/token?grant_type=password", database),
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "admin@stonecaster.local",
        password: "stonecaster-dev",
      }),
    },
  );
  expect(response.ok).toBe(true);
  const authBody: unknown = await response.json();
  const auth = z
    .object({
      access_token: z.string(),
      user: z.object({ id: z.string().uuid() }),
    })
    .parse(authBody);
  token = auth.access_token;
  expect(auth.user.id).toBe("00000000-0000-4000-8000-00000000a001");
  // Character FKs still use the legacy world table; frozen compilation resolves
  // its catalog key independently. Keep these exact fixtures local.
  worldId = randomUUID();
  const fixtures = new Client({ connectionString: env.DATABASE_URL });
  await fixtures.connect();
  try {
    priorEntitlement = (
      await fixtures.query<{ tier_key: string; assigned_at: Date }>(
        "select tier_key,assigned_at from public.chimera_user_entitlements where user_id=$1",
        [auth.user.id],
      )
    ).rows[0];
    // Explicit local test limits cover the existing account plus this one session.
    // Restore the account exactly; never configure a product-wide default tier.
    await fixtures.query(
      "insert into public.chimera_tier_limits(tier_key,max_owned_stories,max_saved_games) select $1,(select count(*)+1 from public.chimera_stories where owner_user_id=$2 and owner_kind='player'),(select count(*)+1 from public.chimera_game_states where player_id=$2)",
      [entitlementTier, auth.user.id],
    );
    entitlementFixtureCreated = true;
    await fixtures.query(
      "insert into public.chimera_user_entitlements(user_id,tier_key) values($1,$2) on conflict(user_id) do update set tier_key=excluded.tier_key",
      [auth.user.id, entitlementTier],
    );
    await fixtures.query(
      "insert into public.chimera_worlds(id,key,definition,name,slug,owner_user_id) values($1,$2,$3,$4,$5,$6)",
      [
        worldId,
        `phase0c-${worldId}`,
        JSON.stringify({ test: true }),
        "Phase 0C fixture",
        `phase0c-${worldId}`,
        auth.user.id,
      ],
    );
    characterId = randomUUID();
    await fixtures.query(
      "insert into public.chimera_player_characters(id,user_id,name,state_snapshot,world_id) values($1,$2,$3,$4,$5)",
      [
        characterId,
        auth.user.id,
        "Phase 0C Tester",
        JSON.stringify({
          tier1_entity: { current_stamina: 73, root_force: 62 },
        }),
        worldId,
      ],
    );
  } finally {
    await fixtures.end();
  }
  compiledId = z.object({ id: z.string().uuid() }).parse(
    await call("/api/chimera/compile", {
      title: "Phase 0C verification",
      world: { kind: "world", owner_namespace: "first_party", key: "mystika" },
      rulesets: [
        "vitality-stamina-system",
        "needs-survival-basic",
        "world-cycle-time-bands",
        "d100-5-pillars",
      ].map((key) => ({
        kind: "ruleset",
        owner_namespace: "first_party",
        key,
      })),
      entities: [
        { kind: "entity", owner_namespace: "first_party", key: "kiera" },
      ],
    }),
  ).id;
  gameId = z.object({ id: z.string().uuid() }).parse(
    await call("/api/chimera/game/init", {
      storyId: compiledId,
      characterId,
      playerInput: { identity: { name: "Phase 0C Tester" } },
    }),
  ).id;
  const snapshot = await readSnapshot();
  const fields = snapshot.play_view.modules.flatMap((module) => module.fields);
  expect(fields.find((field) => field.id === "current_stamina")?.value).toBe(
    73,
  );
  expect(fields.find((field) => field.id === "satiety")?.value).toBe(80);
  expect(fields.find((field) => field.id === "root_force")?.value).toBe(62);
  expect(snapshot).not.toHaveProperty("compiled_system_prompt");
  expect(Object.keys(snapshot.mechanical_state.entities)).toEqual([
    characterId,
  ]);
});

test.afterAll(async () => {
  for (const [table, key, id] of [
    ["ai_audit_logs", "game_id", gameId],
    ["chimera_turns", "game_state_id", gameId],
    ["chimera_game_states", "id", gameId],
    ["chimera_player_characters", "id", characterId],
    ["chimera_compiled_content_refs", "compiled_story_id", compiledId],
    ["chimera_compiled_stories", "id", compiledId],
    ["chimera_worlds", "id", worldId],
  ])
    if (id) {
      const response = await fetch(
        new URL(`/rest/v1/${String(table)}?${String(key)}=eq.${id}`, database),
        {
          method: "DELETE",
          headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        },
      );
      expect(response.ok, `Local fixture cleanup: ${String(table)}`).toBe(true);
    }
  if (entitlementFixtureCreated) {
    const fixtures = new Client({ connectionString: env.DATABASE_URL });
    await fixtures.connect();
    try {
      const owner = "00000000-0000-4000-8000-00000000a001";
      if (priorEntitlement)
        await fixtures.query(
          "update public.chimera_user_entitlements set tier_key=$1,assigned_at=$2 where user_id=$3 and tier_key=$4",
          [
            priorEntitlement.tier_key,
            priorEntitlement.assigned_at,
            owner,
            entitlementTier,
          ],
        );
      else
        await fixtures.query(
          "delete from public.chimera_user_entitlements where user_id=$1 and tier_key=$2",
          [owner, entitlementTier],
        );
      await fixtures.query(
        "delete from public.chimera_tier_limits where tier_key=$1",
        [entitlementTier],
      );
    } finally {
      await fixtures.end();
    }
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`real hash-pinned session at ${String(viewport.width)} @stack`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/auth/signin");
    await page
      .getByPlaceholder("Enter your email")
      .fill("admin@stonecaster.local");
    await page.getByPlaceholder("Enter your password").fill("stonecaster-dev");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .not.toMatch(/^\/auth\/sign(in|up)$/);
    await page.goto(`/play/${gameId}`);
    await expect(page.getByPlaceholder("What do you do?")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name:
          viewport.width === 390 ? "The Beginning" : "Phase 0C verification",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Health", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`phase0c-${String(viewport.width)}.png`),
    });
    if (viewport.width === 390) {
      await page
        .getByRole("button", { name: "Open Character", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("progressbar", { name: "Stamina", exact: true }),
      ).toHaveAttribute("aria-valuetext", "73 of 100");
      await page.screenshot({
        path: info.outputPath("phase0c-mobile-character.png"),
      });
    }
    if (viewport.width === 1440) {
      await page.getByPlaceholder("What do you do?").fill("test_social");
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/games/${gameId}/turn`) &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Send action", exact: true })
        .click();
      expect((await response).ok()).toBe(true);
      await expect
        .poll(async () => (await readSnapshot()).play_view.committed_turn)
        .toBe(1);
      await page.reload();
      await expect(page.getByPlaceholder("What do you do?")).toBeVisible();
      const snapshot = await readSnapshot();
      expect(snapshot.play_view.committed_turn).toBe(1);
      const stamina = snapshot.play_view.modules
        .flatMap((module) => module.fields)
        .find((field) => field.id === "current_stamina")?.value;
      await expect(
        page.getByRole("progressbar", { name: "Stamina", exact: true }),
      ).toHaveAttribute("aria-valuetext", `${String(stamina)} of 100`);
      await expect(page.getByText("62", { exact: true })).toBeVisible();
    }
  });
}
