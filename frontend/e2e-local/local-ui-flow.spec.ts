function requireStackPrerequisite(
  unavailable = true,
  reason = "Stack fixtures are required for this scenario",
): void {
  expect(unavailable, reason).toBe(false);
}

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * LIVE, fully UI-driven flow against the isolated local stack (no route mocking). Works in BOTH AI modes:
 *   npm run local:dev        (mock)  ->  npm run local:smoke:browser
 *   npm run local:dev:real   (real: OpenRouter/OpenAI per LLM_PROVIDER)  ->  npm run local:smoke:browser
 * login -> stories -> Start Story -> pick character -> game loads -> typed turn -> persisted in DB -> hard refresh -> resume.
 * Only the test character is seeded through the API (so the picker has a known card); everything else is the real UI.
 */
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const env: Record<string, string> = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env.stonecaster-local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const API = `http://localhost:${env.PORT}`;
const SB = env.SUPABASE_URL;
const WORLD_ID = "b3de4b0a-a879-43cf-8256-2153a5ff97a9"; // mystika (seeded)
const EMAIL = "player@stonecaster.local";
const PASSWORD = "stonecaster-dev";

async function json(res: Response) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}
const svc = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
};

async function seedStoryAndCharacter(
  charName: string,
): Promise<{ storyId: string; storyName: string }> {
  const auth = await json(
    await fetch(`${SB}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
  const call = async (url: string, body: unknown) =>
    json(
      await fetch(`${API}${url}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.access_token}`,
        },
        body: JSON.stringify(body),
      }),
    );
  const storyName = `UI flow ${Date.now()}`;
  const story = await call("/api/v2/chimera/stories", {
    display_name: storyName,
    world_id: WORLD_ID,
    ruleset_template_ids: [],
    entity_ids: [],
    genesis_config: {},
  });
  const storyId = (story.data ?? story).id as string;
  await call(`/api/chimera/compile/${storyId}`, {});
  await call("/api/v2/chimera/player-characters", {
    name: charName,
    world_id: WORLD_ID,
    state_snapshot: { tier1_entity: { name: charName } },
  });
  if (!storyId)
    throw new Error(
      `could not create story: ${JSON.stringify(story).slice(0, 400)}`,
    );
  return { storyId, storyName };
}

async function login(page: Page) {
  const failures: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/profile/link-guest") && r.status() >= 400)
      failures.push(`link-guest ${r.status()}`);
  });
  await page.goto("/auth/signin");
  await page.getByPlaceholder("Enter your email").fill(EMAIL);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
    .not.toMatch(/^\/auth\/sign(in|up)$/);
  return failures;
}

test("UI: login, start story, play a turn, persist, hard refresh", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const health = await json(await fetch(`${API}/health`));
  const mock = health.mockAi === true;
  const charName = `Flow Tester ${Date.now()}`;
  const { storyId } = await seedStoryAndCharacter(charName);

  const linkFailures = await login(page);

  // stories -> detail -> Start Story
  await page.goto("/stories");
  await page
    .locator(`a[href="/stories/${storyId}"], [data-story-id="${storyId}"]`)
    .first()
    .click()
    .catch(async () => {
      await page.goto(`/stories/${storyId}`);
    });
  await page.getByRole("button", { name: "Start Story" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/play/start/${storyId}`));

  // pick the character -> game/init -> /play/:id
  const init = page.waitForResponse(
    (r) =>
      r.url().includes("/api/chimera/game/init") &&
      r.request().method() === "POST",
    { timeout: 120_000 },
  );
  await page.getByText(charName).first().click();
  expect([200, 201]).toContain((await init).status());
  await expect(page).toHaveURL(/\/play\/[0-9a-f-]{36}/, { timeout: 20_000 });
  const gameId = page.url().match(/\/play\/([0-9a-f-]{36})/)![1];

  // game state loaded
  const input = page.getByPlaceholder("What do you want to do?");
  await expect(input).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(charName).first()).toBeVisible(); // name projected from the character into the game state
  await expect(
    page
      .locator(
        '[data-testid="stamina-value"]:visible, [data-testid="mobile-stamina-value"]:visible',
      )
      .first(),
  ).toHaveText("100");

  // one typed turn (mock narrator keys off the chip names; real AI gets natural language)
  const text = mock
    ? "test_combat"
    : "I take a slow look around and listen for anything nearby.";
  const turnResp = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/games/${gameId}/turn`) &&
      r.request().method() === "POST",
    { timeout: 300_000 },
  );
  await input.fill(text);
  await input.press("Enter");
  const resp = await turnResp;
  const respText = await resp.text().catch(() => "");
  // External blocker, not an app defect: report it distinctly instead of failing.
  requireStackPrerequisite(
    !mock &&
      [402, 429, 500].includes(resp.status()) &&
      /insufficient_quota|insufficient credits|requires more credits|rate limit|429/i.test(
        respText,
      ),
    `BLOCKED: model provider quota/rate limit (HTTP ${resp.status()}); everything up to the turn passed`,
  );
  expect(resp.status(), respText).toBe(200);
  await expect(page.getByTestId("turn-pending")).toHaveCount(0, {
    timeout: 300_000,
  });

  // persisted server-side
  await expect
    .poll(
      async () => {
        const rows = await json(
          await fetch(
            `${SB}/rest/v1/chimera_turns?game_state_id=eq.${gameId}&turn_index=eq.1&select=narrator_output`,
            { headers: svc },
          ),
        );
        return (rows[0]?.narrator_output?.narration ?? "").length;
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(10);
  const rows = await json(
    await fetch(
      `${SB}/rest/v1/chimera_turns?game_state_id=eq.${gameId}&turn_index=eq.1&select=narrator_output`,
      { headers: svc },
    ),
  );
  const narration: string = rows[0].narrator_output.narration;
  console.log(
    `[${mock ? "mock" : "real"} AI] narration: ${narration.slice(0, 160).replace(/\s+/g, " ")}`,
  );

  // hard refresh -> resume with narration still on screen
  await page.reload();
  await expect(input).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("body")).toContainText(narration.slice(0, 40), {
    timeout: 20_000,
  });

  expect(linkFailures, "link-guest must not fail after sign-in").toEqual([]);
});
