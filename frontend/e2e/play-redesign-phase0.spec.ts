import { test, expect, type Page } from "@playwright/test";
import { gameId, mockPlayApi } from "./fixtures/play-view";
import {
  corePlayView,
  socialPlayView,
  combatPlayView,
  fixtureLogs,
  fixtureSuggestions,
} from "../src/features/play/model/fixtures";

async function checkGeometry(page: Page) {
  const violations = await page.getByTestId("play-shell").evaluate((shell) => {
    const result: string[] = [];
    for (const element of shell.querySelectorAll<HTMLElement>("*")) {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (
        !bounds.width ||
        !bounds.height ||
        style.visibility === "hidden" ||
        element.closest(".sr-only")
      )
        continue;
      if (
        [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        ) &&
        parseFloat(style.fontSize) < 12
      )
        result.push(`Small text: ${element.textContent}`);
      if (
        element.matches("button, input, textarea, a") &&
        (bounds.width < 44 || bounds.height < 44)
      )
        result.push(
          `Small target: ${element.getAttribute("aria-label") ?? element.textContent} ${String(bounds.width)}×${String(bounds.height)}`,
        );
    }
    if (
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
    )
      result.push("Horizontal document overflow");
    return result;
  });
  expect(violations).toEqual([]);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`Phase 0B approved layout ${String(viewport.width)}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize(viewport);
    await mockPlayApi(
      page,
      "light",
      corePlayView,
      fixtureLogs,
      fixtureSuggestions.core,
    );
    await page.goto(`/play/${gameId}`);
    await expect(
      page.getByText("I lean on the bar and ask Kiera who the stranger is.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("The Gilded Stag", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Health", { exact: true })).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await checkGeometry(page);
    if (viewport.width === 390) {
      await expect(
        page.getByRole("button", { name: "Open Character" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open Here" }),
      ).toBeVisible();
      const input = await page.getByLabel("Your action").boundingBox();
      expect(input?.y).toBeGreaterThan(844 * 0.7);
    } else {
      const mode = viewport.width === 1100 ? "slim" : "open";
      await expect(
        page.getByRole("complementary", { name: "Character panel" }),
      ).toHaveAttribute("data-panel-state", mode);
      await expect(
        page.getByRole("complementary", { name: "Here panel" }),
      ).toHaveAttribute("data-panel-state", mode);
    }
    await page.screenshot({
      path: info.outputPath(`phase0b-${String(viewport.width)}.png`),
    });
    expect(errors).toEqual([]);
  });
}

test("mobile sheets trap focus, restore the trigger, and expose only declared content", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlayApi(page, "dark", corePlayView, fixtureLogs);
  await page.goto(`/play/${gameId}`);
  for (const surface of ["Character", "Here"]) {
    const trigger = page.getByRole("button", {
      name: `Open ${surface}`,
      exact: true,
    });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: surface, exact: true });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`phase0b-mobile-${surface.toLowerCase()}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  await page.getByLabel("Open action tray").click();
  await page.getByRole("button", { name: "Open Layout and HUD" }).click();
  await page
    .getByRole("group", { name: "Stamina", exact: true })
    .getByRole("button", { name: "Never" })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Open Character").click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Hide Stamina" }),
  ).toHaveCount(0);
});

test("keyboard panel controls cycle and focus restores the previous layout", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockPlayApi(page, "dark", corePlayView);
  await page.goto(`/play/${gameId}`);
  for (const mode of ["open", "slim", "hidden"]) {
    const toggle = page.getByRole("button", {
      name: `Cycle Character panel, currently ${mode}`,
    });
    await toggle.focus();
    await page.keyboard.press("Enter");
  }
  await page.getByLabel("Cycle Here panel, currently open").click();
  await page.getByLabel("Enter focus").click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("phase0b-focus-1440.png") });
  await page.getByLabel("Exit focus").click();
  await expect(
    page.getByRole("complementary", { name: "Character panel" }),
  ).toHaveAttribute("data-panel-state", "open");
  await expect(
    page.getByRole("complementary", { name: "Here panel" }),
  ).toHaveAttribute("data-panel-state", "slim");
  await page.getByLabel("Expand Here", { exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Here panel" }),
  ).toHaveAttribute("data-panel-state", "open");
});

for (const [name, view] of [
  ["social", socialPlayView],
  ["combat", combatPlayView],
] as const) {
  test(`ruleset mix ${name} never invents unsupported modules`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockPlayApi(page, "dark", view);
    await page.goto(`/play/${gameId}`);
    await expect(page.getByText("The road opens before you.")).toBeVisible();
    await expect(page.getByText("Health", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Satiety", { exact: true })).toHaveCount(0);
    if (name === "social") {
      await expect(page.getByText("Stamina", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("A visiting poet", { exact: true }),
      ).toBeVisible();
    } else
      await expect(
        page
          .getByRole("complementary", { name: "Character panel" })
          .getByText("Wounded", { exact: true }),
      ).toBeVisible();
    await checkGeometry(page);
  });
}

test("existing turn transport sends once, locks while pending and preserves the draft on failure", async ({
  page,
}) => {
  await mockPlayApi(page, "dark", corePlayView);
  let submitted = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/games/${gameId}/turn`, async (route) => {
    submitted++;
    await pending;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { code: "TURN_FAILED", message: "Try your action again." },
      }),
    });
  });
  await page.goto(`/play/${gameId}`);
  await page.getByLabel("Your action").fill("Wait by the door");
  await page.getByLabel("Your action").press("Enter");
  await expect(page.getByLabel("Your action")).toBeDisabled();
  await expect(page.getByTestId("turn-pending")).toHaveText(
    "Wait by the doorThe story unfolds…",
  );
  release?.();
  await expect(
    page.getByRole("alert").filter({ hasText: "Try your action again." }),
  ).toBeVisible();
  await expect(page.getByLabel("Your action")).toHaveValue("Wait by the door");
  expect(submitted).toBe(1);
});

test("fixture gallery is viewport sized and reduced motion keeps animations static", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPlayApi(page);
  await page.goto("/_test_gallery?play=core");
  await expect(
    page.getByText("I lean on the bar and ask Kiera who the stranger is."),
  ).toBeVisible();
  await checkGeometry(page);
  await page.getByLabel("Open Character").click();
  const animation = await page
    .getByRole("dialog")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toBe("none");
});

test("a committed turn refreshes declared HUD values and on-change cards respect reduced motion", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockPlayApi(
    page,
    "dark",
    corePlayView,
    fixtureLogs,
    fixtureSuggestions.core,
  );
  let view = corePlayView;
  await page.route(`**/api/chimera/play/${gameId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: gameId,
          play_view: view,
          mechanical_state: {},
          narrative_focus: { dialogue_history: fixtureLogs },
          action_queue: fixtureSuggestions.core,
        },
      }),
    });
  });
  await page.route(`**/api/games/${gameId}/turn`, async (route) => {
    view = {
      ...corePlayView,
      committed_turn: 15,
      modules: corePlayView.modules.map((module) =>
        module.id === "stamina" && module.kind === "vitals"
          ? {
              ...module,
              fields: module.fields.map((field) => ({ ...field, value: 80 })),
            }
          : module,
      ),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { delta: {}, new_logs: [] } }),
    });
  });
  await page.goto(`/play/${gameId}`);
  await page
    .getByRole("button", { name: "Layout and HUD", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Stamina", exact: true })
    .getByRole("button", { name: "On change" })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Enter focus").click();
  await page.getByLabel("Your action").fill("Wait");
  await page.getByLabel("Send action").click();
  const card = page
    .getByRole("status")
    .filter({ hasText: "Changed this turn" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("80");
  await expect(page.getByLabel("Your action")).toHaveValue("");
  expect(
    await card.evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.screenshot({
    path: info.outputPath("phase0b-focus-on-change.png"),
  });
});
