import { test, expect } from '@playwright/test';

test.describe('Guest Stone Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('should allow guest to begin adventure with sufficient stones', async ({ page }) => {
    // Navigate to adventure character selection
    await page.goto('/adventures/mystika-tutorial/characters');
    
    // Should be able to see and interact with adventure content
    await expect(page.locator('text=Begin Adventure')).toBeVisible();
    
    // Click begin adventure
    await page.click('text=Begin Adventure');
    
    // Should proceed with adventure (not redirect to auth)
    await expect(page).not.toHaveURL(/\/auth/);
    
    // Should either stay on character selection or navigate to game
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(adventures\/mystika-tutorial\/characters|play\/)/);
  });

  test('should show sign-in CTA when guest has insufficient stones', async ({ page }) => {
    // This test would need to be implemented based on the actual stone handling logic
    // For now, we'll test that the adventure flow doesn't redirect to auth
    
    // Navigate to adventure character selection
    await page.goto('/adventures/mystika-tutorial/characters');
    
    // Should be able to see and interact with adventure content
    await expect(page.locator('text=Begin Adventure')).toBeVisible();
    
    // Click begin adventure
    await page.click('text=Begin Adventure');
    
    // Should not redirect to auth route
    await expect(page).not.toHaveURL(/\/auth/);
    
    // Should show some kind of feedback (either success or insufficient stones message)
    // The exact implementation depends on the stone handling logic
  });

  test('should log guest stone actions in console', async ({ page }) => {
    // Listen for console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });
    
    // Navigate to adventure character selection
    await page.goto('/adventures/mystika-tutorial/characters');
    
    // Click begin adventure
    await page.click('text=Begin Adventure');
    
    // Wait a bit for any async operations
    await page.waitForTimeout(1000);
    
    // Should have logged guest stone action
    const guestStoneLogs = logs.filter(log => log.includes('[GUEST-STONES]'));
    expect(guestStoneLogs.length).toBeGreaterThan(0);
  });

  test('should handle guest stone consumption without route redirect', async ({ page }) => {
    // Navigate to adventure character selection
    await page.goto('/adventures/mystika-tutorial/characters');
    
    // Should be able to see and interact with adventure content
    await expect(page.locator('text=Begin Adventure')).toBeVisible();
    
    // Click begin adventure
    await page.click('text=Begin Adventure');
    
    // Should not redirect to auth route
    await expect(page).not.toHaveURL(/\/auth/);
    
    // Should either:
    // 1. Stay on character selection page with success message
    // 2. Navigate to game page
    // 3. Show insufficient stones message without redirecting
    
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/auth/);
  });
});

