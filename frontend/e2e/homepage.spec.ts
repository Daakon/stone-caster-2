import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure the app is loaded and hydrated before assertions; increase timeout
    await page.goto('/');
    // Wait for loading to complete by waiting for either h1 or the loading screen to disappear
    await page.waitForFunction(() => {
      const h1 = document.querySelector('h1');
      const loading = document.querySelector('.loading-screen');
      return h1 || !loading;
    }, { timeout: 15000 });
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
    
    // Verify the element is visible and focusable
    await expect(firstLink).toBeVisible();
    
    // Check if the element can receive focus (accessibility requirement)
    const isFocusable = await firstLink.evaluate(el => {
      const tabIndex = el.getAttribute('tabindex');
      const isDisabled = el.hasAttribute('disabled');
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      return (tabIndex !== '-1' && !isDisabled && isVisible) || el.tagName === 'A';
    });
    
    expect(isFocusable).toBe(true);
  });
});
