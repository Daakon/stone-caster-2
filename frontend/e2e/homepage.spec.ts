import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');
    
    const heading = page.getByRole('heading', { name: /stonecaster/i });
    await expect(heading).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');
    
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();
  });

  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const heading = page.getByRole('heading', { name: /stonecaster/i });
    await expect(heading).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const firstLink = page.locator('a').first();
    await expect(firstLink).toBeFocused();
  });
});
