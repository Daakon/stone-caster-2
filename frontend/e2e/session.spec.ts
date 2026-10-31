import { test, expect } from "@playwright/test";

const E2E_ENABLED = process.env.E2E_ENABLED === "1";

test("Session happy path shows skeleton then content @stack", async ({
  page,
}) => {
  expect(E2E_ENABLED, "This stack spec requires E2E_ENABLED=1.").toBe(true);
  await page.goto("/play/session/s-1");
  await expect(page.locator("main#chat")).toBeVisible();
});
