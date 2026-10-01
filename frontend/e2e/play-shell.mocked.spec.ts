import { test, expect } from "@playwright/test";
import { gameId, mockPlayApi } from "./fixtures/play-view";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1100, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`mocked play shell ${String(viewport.width)}x${String(viewport.height)}`, async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.setViewportSize(viewport);
    await mockPlayApi(
      page,
      viewport.width === 390
        ? "light"
        : viewport.width === 1100
          ? "system"
          : null,
    );
    await page.goto(`/play/${gameId}`);
    await expect(page.getByText("The road opens before you.")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("button", { name: "Toggle theme" }),
    ).toHaveCount(0);
    const typography = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).fontFamily);
    expect(typography).toContain("DM Sans");
    const translucentColours = await page.evaluate(() => {
      const sample = document.createElement("div");
      sample.className = "bg-stone-900/50 border-stone-800/50";
      sample.style.display = "none";
      document.body.append(sample);
      const actual = {
        background: getComputedStyle(sample).backgroundColor,
        border: getComputedStyle(sample).borderTopColor,
      };
      sample.style.backgroundColor =
        "color-mix(in srgb, var(--sc-bg-card) 50%, transparent)";
      sample.style.borderColor =
        "color-mix(in srgb, var(--sc-bg-raised) 50%, transparent)";
      const expected = {
        background: getComputedStyle(sample).backgroundColor,
        border: getComputedStyle(sample).borderTopColor,
      };
      sample.remove();
      return { actual, expected };
    });
    expect(translucentColours.actual).toEqual(translucentColours.expected);
    await page.evaluate(() => document.fonts.ready.then(() => {}));
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
    expect(consoleErrors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`play-${String(viewport.width)}.png`),
      fullPage: true,
    });
  });
}
