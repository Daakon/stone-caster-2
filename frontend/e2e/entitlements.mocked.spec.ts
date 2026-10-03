import { test, expect, type Page } from "@playwright/test";
import type {
  EntitlementView,
  TierPolicyView,
} from "../../shared/src/types/chimera-entitlements";
const owner = "c0000000-0000-4000-8000-000000000001";
const first = "a0000000-0000-4000-8000-000000000001",
  second = "a0000000-0000-4000-8000-000000000002",
  game = "b0000000-0000-4000-8000-000000000001";
const view: Extract<EntitlementView, { state: "ready" }> = {
  state: "ready",
  tier_key: "fixture",
  limits: { max_owned_stories: 1, max_saved_games: 1 },
  usage: { owned_stories: 2, saved_games: 1 },
  stories: [
    { id: first, label: "The Gilded Stag" },
    { id: second, label: "Ashen Road" },
  ],
  games: [{ id: game, label: "The Gilded Stag · Kiera" }],
  selected_story_ids: [first],
  selected_game_ids: [game],
  writable_story_ids: [first],
  writable_game_ids: [game],
};
async function mock(
  page: Page,
  {
    role = "member",
    pending = false,
  }: { role?: string; pending?: boolean } = {},
) {
  let active: EntitlementView = pending
    ? { state: "configuration_pending" }
    : structuredClone(view);
  let policies: TierPolicyView = {
    tiers: [{ tier_key: "fixture", max_owned_stories: 1, max_saved_games: 1 }],
    default_tier_key: null,
  };
  const writes: { path: string; body: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      method = request.method();
    let data: unknown = null;
    if (path === "/api/me")
      data = {
        user: { id: owner, email: "fixture@example.com", role, roleVersion: 1 },
        kind: "user",
        config: { enableChimeraUi: true },
      };
    else if (path === "/api/me/entitlements/active") {
      if (method === "PUT") {
        const choice = request.postDataJSON() as {
          story_ids: string[];
          game_ids: string[];
        };
        writes.push({ path, body: choice });
        active = {
          ...view,
          selected_story_ids: choice.story_ids,
          selected_game_ids: choice.game_ids,
          writable_story_ids: choice.story_ids.length
            ? choice.story_ids
            : [second],
          writable_game_ids: choice.game_ids.length ? choice.game_ids : [game],
        };
      }
      data = active;
    } else if (path === "/api/v2/chimera/stories/my-creations")
      data = view.stories.map((item) => ({
        id: item.id,
        display_name: item.label,
        world_id: "d0000000-0000-4000-8000-000000000001",
        world_display_name: "Vale of Mists",
        status: "bound",
        updated_at: "2026-10-02T12:00:00Z",
        configuration: {},
      }));
    else if (path === "/api/admin/tier-limits") {
      if (method === "PATCH") {
        const body = request.postDataJSON() as {
          tier_key: string;
          max_owned_stories: number;
          max_saved_games: number;
          make_default: boolean;
        };
        writes.push({ path, body });
        policies = {
          tiers: [
            {
              tier_key: body.tier_key,
              max_owned_stories: body.max_owned_stories,
              max_saved_games: body.max_saved_games,
            },
          ],
          default_tier_key: body.make_default
            ? body.tier_key
            : policies.default_tier_key,
        };
      }
      data = policies;
    } else if (path === `/api/admin/users/${owner}/tier`) {
      writes.push({ path, body: request.postDataJSON() as unknown });
      data = { assigned: true };
    } else if (path === "/api/request-access/status") data = { request: null };
    else if (path === "/api/wallet") data = { balance: 0 };
    await route.fulfill({
      status: data === null ? 404 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        data === null
          ? {
              ok: false,
              error: { code: "not_found", message: "Unmocked fixture route" },
            }
          : { ok: true, data },
      ),
    });
  });
  return writes;
}
async function geometry(page: Page, selector: string) {
  const issues = await page.locator(selector).evaluate((root) =>
    Array.from(root.querySelectorAll("button,input,select"))
      .filter((element) => {
        const style = getComputedStyle(element),
          box = element.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          (box.height < 44 ||
            (element instanceof HTMLInputElement &&
              element.type === "checkbox" &&
              box.width < 44))
        );
      })
      .map((element) => element.outerHTML),
  );
  expect(issues).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
for (const width of [390, 1100, 1440]) {
  test(`owner entitlement controls at ${String(width)}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const writes = await mock(page);
    await page.goto("/my-creations");
    await expect(
      page.getByRole("heading", { name: "My Creations" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Compose Story", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Edit Ashen Road" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Open Ashen Road" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Delete Ashen Road" }),
    ).toBeEnabled();
    await geometry(page, ".sc-creations");
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await page.screenshot({
      path: `../output/playwright/f0b-entitlements/creations-${String(width)}.png`,
      fullPage: true,
    });
    const trigger = page.getByRole("button", {
      name: "Choose active stories and saved games",
    });
    await trigger.click();
    await page
      .getByRole("checkbox", { name: /1\. The Gilded Stag Currently/ })
      .uncheck();
    await page.getByRole("checkbox", { name: /Ashen Road Currently/ }).check();
    await geometry(page, ".sc-picker-dialog");
    await page.screenshot({
      path: `../output/playwright/f0b-entitlements/picker-${String(width)}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save active choices" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([
      {
        path: "/api/me/entitlements/active",
        body: { story_ids: [second], game_ids: [game] },
      },
    ]);
    await expect(
      page.getByRole("button", { name: "Edit Ashen Road" }),
    ).toBeEnabled();
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}
for (const width of [390, 1100, 1440]) {
  test(`admin tier editor at ${String(width)}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes = await mock(page, { role: "admin" });
    await page.goto("/admin/tier-limits");
    await expect(
      page.getByRole("heading", { name: "Set tier limits" }),
    ).toBeVisible();
    await expect(page.getByLabel("Owned-story limit")).toHaveValue("");
    await page.getByRole("button", { name: "Edit fixture" }).click();
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await page.screenshot({
      path: `../output/playwright/f0b-entitlements/admin-${String(width)}.png`,
      fullPage: true,
    });
    await geometry(page, ".sc-tier-page");
    await page.getByLabel("Owned-story limit").fill("0");
    await page.getByRole("button", { name: "Save tier limits" }).click();
    await expect(page.getByText("Tier limits saved.")).toBeVisible();
    await page.getByLabel("Account ID").fill(owner);
    await page
      .getByRole("combobox", { name: /Configured tier/ })
      .selectOption("fixture");
    await page
      .getByRole("button", { name: "Assign tier", exact: true })
      .click();
    await expect(page.getByText("Account tier assigned.")).toBeVisible();
    expect(writes).toEqual([
      {
        path: "/api/admin/tier-limits",
        body: {
          tier_key: "fixture",
          max_owned_stories: 0,
          max_saved_games: 1,
          make_default: false,
        },
      },
      { path: `/api/admin/users/${owner}/tier`, body: { tier_key: "fixture" } },
    ]);
  });
}
test("pending configuration and non-admin guard fail closed", async ({
  page,
}) => {
  const writes = await mock(page, { pending: true });
  await page.goto("/my-creations");
  await expect(page.getByText("Account limits pending")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compose Story", exact: true }),
  ).toBeDisabled();
  await page.goto("/admin/tier-limits");
  await expect(page.getByText("Access Denied")).toBeVisible();
  await expect(page.getByLabel("Tier key")).toHaveCount(0);
  expect(writes).toEqual([]);
});
