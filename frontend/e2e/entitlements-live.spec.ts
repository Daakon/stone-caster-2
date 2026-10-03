import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { z } from "zod";
import { EntitlementViewSchema } from "../../shared/src/types/chimera-entitlements";
const { Client } = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("pg") as typeof import("pg");
const tier = `f0b-ui-${randomUUID()}`,
  email = `${tier}@example.test`,
  password = "stonecaster-dev";
async function login(page: Page, email: string) {
  await page.goto("/auth/signin");
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .not.toMatch(/^\/auth\/sign(in|up)$/);
}
test("live admin configuration, assignment, owner priority and downgrade @stack", async ({
  page,
  browser,
}) => {
  const env = z
    .object({
      API_BASE_URL: z.string().url(),
      SUPABASE_URL: z.string().url(),
      DATABASE_URL: z.string().url(),
      SUPABASE_ANON_KEY: z.string(),
      SUPABASE_SERVICE_KEY: z.string(),
    })
    .parse(
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
  for (const endpoint of [env.API_BASE_URL, env.SUPABASE_URL, env.DATABASE_URL])
    if (!["localhost", "127.0.0.1"].includes(new URL(endpoint).hostname))
      throw Error("Loopback stack required for entitlement fixtures");
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  let userId: string | undefined;
  const storyIds: string[] = [];
  const service = {
    apikey: env.SUPABASE_SERVICE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "content-type": "application/json",
  };
  const context = await browser.newContext({
    baseURL: "http://localhost:5183",
    viewport: { width: 390, height: 844 },
  });
  try {
    const userResponse = await fetch(
      new URL("/auth/v1/admin/users", env.SUPABASE_URL),
      {
        method: "POST",
        headers: service,
        body: JSON.stringify({ email, password, email_confirm: true }),
      },
    );
    expect(userResponse.ok).toBe(true);
    const user = z
      .object({ id: z.string().uuid() })
      .parse(await userResponse.json());
    userId = user.id;
    await login(page, "admin@stonecaster.local");
    await page.goto("/admin/tier-limits");
    await page.getByLabel("Tier key").fill(tier);
    await page.getByLabel("Owned-story limit").fill("2");
    await page.getByLabel("Saved-game limit").fill("0");
    await page.getByRole("button", { name: "Save tier limits" }).click();
    await expect(page.getByText("Tier limits saved.")).toBeVisible();
    await page.getByLabel("Account ID").fill(user.id);
    await page
      .getByRole("combobox", { name: /Configured tier/ })
      .selectOption(tier);
    await page
      .getByRole("button", { name: "Assign tier", exact: true })
      .click();
    await expect(page.getByText("Account tier assigned.")).toBeVisible();
    const tokenResponse = await fetch(
      new URL("/auth/v1/token?grant_type=password", env.SUPABASE_URL),
      {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );
    expect(tokenResponse.ok).toBe(true);
    const auth = z
      .object({ access_token: z.string() })
      .parse(await tokenResponse.json());
    const api = async (path: string, body?: unknown) => {
      const response = await fetch(new URL(path, env.API_BASE_URL), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${auth.access_token}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(response.ok).toBe(true);
      return z.object({ data: z.unknown() }).parse(await response.json()).data;
    };
    for (const name of ["First live fixture", "Second live fixture"])
      storyIds.push(
        z
          .object({ id: z.string().uuid() })
          .parse(await api("/api/v2/chimera/stories", { display_name: name }))
          .id,
      );
    const owner = await context.newPage();
    await login(owner, email);
    await owner.goto("/my-creations");
    await expect(
      owner.getByRole("button", { name: "Compose Story", exact: true }),
    ).toBeDisabled();
    await owner
      .getByRole("button", { name: "Choose active stories and saved games" })
      .click();
    await owner.getByRole("checkbox", { name: /First live fixture/ }).check();
    await owner.getByRole("checkbox", { name: /Second live fixture/ }).check();
    await owner.getByRole("button", { name: "Save active choices" }).click();
    await expect(owner.getByRole("dialog")).toHaveCount(0);
    const chosen = EntitlementViewSchema.parse(
      await api("/api/me/entitlements/active"),
    );
    expect(chosen.state).toBe("ready");
    if (chosen.state !== "ready") throw Error("Expected configured account");
    expect(chosen.selected_story_ids).toEqual(storyIds);
    expect(chosen.selected_game_ids).toEqual([]);
    await page
      .getByRole("button", { name: `Edit ${tier}`, exact: true })
      .click();
    await page.getByLabel("Owned-story limit").fill("1");
    await page.getByRole("button", { name: "Save tier limits" }).click();
    await expect(page.getByText("Tier limits saved.")).toBeVisible();
    await owner.reload();
    await expect(
      owner.getByRole("button", { name: "Edit Second live fixture" }),
    ).toBeDisabled();
    await expect(
      owner.getByRole("button", { name: "Open Second live fixture" }),
    ).toBeEnabled();
    await owner
      .getByRole("button", { name: "Choose active stories and saved games" })
      .click();
    await expect(
      owner.getByRole("button", { name: "Save active choices" }),
    ).toBeDisabled();
    await owner.getByRole("checkbox", { name: /First live fixture/ }).uncheck();
    await owner.getByRole("button", { name: "Save active choices" }).click();
    await expect(owner.getByRole("dialog")).toHaveCount(0);
    await expect(
      owner.getByRole("button", { name: "Edit Second live fixture" }),
    ).toBeEnabled();
    const updated = EntitlementViewSchema.parse(
      await api("/api/me/entitlements/active"),
    );
    expect(updated.state).toBe("ready");
    if (updated.state !== "ready") throw Error("Expected ready account");
    expect(updated.selected_story_ids).toEqual([storyIds[1]]);
    expect(updated.writable_story_ids).toEqual([storyIds[1]]);
  } finally {
    await context.close();
    try {
      await db.query(
        "delete from public.chimera_stories where id=any($1::uuid[]) and owner_user_id=$2",
        [storyIds, userId],
      );
      if (userId) {
        const response = await fetch(
          new URL(`/auth/v1/admin/users/${userId}`, env.SUPABASE_URL),
          { method: "DELETE", headers: service },
        );
        expect(response.ok).toBe(true);
      }
      await db.query(
        "delete from public.chimera_tier_limits where tier_key=$1",
        [tier],
      );
    } finally {
      await db.end();
    }
  }
});
