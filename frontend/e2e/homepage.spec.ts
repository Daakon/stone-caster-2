import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure the app is loaded and hydrated before assertions; increase timeout
    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('should display the main heading', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /stonecaster/i });
    await expect(heading).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const heading = page.getByRole('heading', { name: /stonecaster/i });
    await expect(heading).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const firstLink = page.locator('a').first();
    await expect(firstLink).toBeFocused();
  });
});
