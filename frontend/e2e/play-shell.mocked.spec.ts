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
    await mockPlayApi(page);
    await page.goto(`/play/${gameId}`);
    await expect(page.getByText("The road opens before you.")).toBeVisible();
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
