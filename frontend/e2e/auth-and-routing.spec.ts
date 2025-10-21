import { test, expect } from '@playwright/test';

test.describe('Authentication and Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.goto('/');
  });

  test.describe('Unified Sign-In Entry', () => {
    test('should navigate to /auth/signin from header sign in button', async ({ page }) => {
      // Click the sign in button in the header
      await page.click('text=Sign In');
      
      // Should navigate to /auth/signin
      await expect(page).toHaveURL('/auth/signin');
    });

    test('should redirect /auth to /auth/signin', async ({ page }) => {
      // Navigate directly to /auth
      await page.goto('/auth');
      
      // Should redirect to /auth/signin
      await expect(page).toHaveURL('/auth/signin');
    });

    test('should stay on /auth/signin as guest without bouncing to home', async ({ page }) => {
      // Navigate to /auth/signin
      await page.goto('/auth/signin');
      
      // Wait a bit to ensure no redirect happens
      await page.waitForTimeout(1000);
      
      // Should still be on /auth/signin
      await expect(page).toHaveURL('/auth/signin');
    });

    test('should navigate to /auth/signin from landing page sign in button', async ({ page }) => {
      // Click the sign in button on the landing page
      await page.click('text=Sign In');
      
      // Should navigate to /auth/signin
      await expect(page).toHaveURL('/auth/signin');
    });

    test('should navigate to /auth/signup from landing page sign up button', async ({ page }) => {
      // Click the sign up button on the landing page
      await page.click('text=Sign Up Free');
      
      // Should navigate to /auth/signup
      await expect(page).toHaveURL('/auth/signup');
    });
  });

  test.describe('Guest Adventure Flow', () => {
    test('should allow guest to navigate to adventure character selection', async ({ page }) => {
      // Navigate directly to adventure character selection
      await page.goto('/adventures/mystika-tutorial/characters');
      
      // Should load the page without redirecting to auth
      await expect(page).toHaveURL('/adventures/mystika-tutorial/characters');
      
      // Should see the character selection content
      await expect(page.locator('text=Character Selection')).toBeVisible();
    });

    test('should allow guest to start adventure from character selection', async ({ page }) => {
      // Navigate to adventure character selection
      await page.goto('/adventures/mystika-tutorial/characters');
      
      // Should be able to see and interact with adventure content
      await expect(page.locator('text=Begin Adventure')).toBeVisible();
      
      // Should not redirect to auth when clicking begin adventure
      await page.click('text=Begin Adventure');
      
      // Should stay on the same page or navigate to game, not to auth
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('should allow guest to navigate to adventure detail page', async ({ page }) => {
      // Navigate to adventure detail page
      await page.goto('/adventures/mystika-tutorial');
      
      // Should load the page without redirecting to auth
      await expect(page).toHaveURL('/adventures/mystika-tutorial');
      
      // Should see adventure content
      await expect(page.locator('text=Mystika Tutorial')).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect guest from /wallet to /auth/signin', async ({ page }) => {
      // Navigate to protected route
      await page.goto('/wallet');
      
      // Should redirect to sign in page
      await expect(page).toHaveURL('/auth/signin');
      
      // Should preserve the intended route
      const url = page.url();
      expect(url).toContain('returnTo=');
    });

    test('should redirect guest from /profile to /auth/signin', async ({ page }) => {
      // Navigate to protected route
      await page.goto('/profile');
      
      // Should redirect to sign in page
      await expect(page).toHaveURL('/auth/signin');
      
      // Should preserve the intended route
      const url = page.url();
      expect(url).toContain('returnTo=');
    });

    test('should redirect guest from /payments to /auth/signin', async ({ page }) => {
      // Navigate to protected route
      await page.goto('/payments');
      
      // Should redirect to sign in page
      await expect(page).toHaveURL('/auth/signin');
      
      // Should preserve the intended route
      const url = page.url();
      expect(url).toContain('returnTo=');
    });
  });

  test.describe('Navigation Visibility', () => {
    test('should hide wallet and profile links for guest users', async ({ page }) => {
      // Navigate to any page
      await page.goto('/');
      
      // Wallet and Profile should not be visible in navigation
      await expect(page.locator('text=Wallet')).not.toBeVisible();
      await expect(page.locator('text=Profile')).not.toBeVisible();
      
      // Sign In should be visible
      await expect(page.locator('text=Sign In')).toBeVisible();
    });

    test('should show sign in button for guest users', async ({ page }) => {
      // Navigate to any page
      await page.goto('/');
      
      // Sign In button should be visible
      await expect(page.locator('text=Sign In')).toBeVisible();
    });
  });

  test.describe('Hard Refresh Behavior', () => {
    test('should maintain guest state after hard refresh on adventure route', async ({ page }) => {
      // Navigate to adventure route
      await page.goto('/adventures/mystika-tutorial/characters');
      
      // Hard refresh
      await page.reload();
      
      // Should still be on the same route
      await expect(page).toHaveURL('/adventures/mystika-tutorial/characters');
      
      // Should not redirect to auth
      await expect(page).not.toHaveURL(/\/auth/);
    });

    test('should maintain guest state after hard refresh on landing page', async ({ page }) => {
      // Navigate to landing page
      await page.goto('/');
      
      // Hard refresh
      await page.reload();
      
      // Should still be on landing page
      await expect(page).toHaveURL('/');
      
      // Should not redirect to auth
      await expect(page).not.toHaveURL(/\/auth/);
    });
  });

  test.describe('Mobile Viewport', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('should work correctly on mobile viewport', async ({ page }) => {
      // Navigate to landing page
      await page.goto('/');
      
      // Should see mobile navigation
      await expect(page.locator('[aria-label="Toggle menu"]')).toBeVisible();
      
      // Click mobile menu
      await page.click('[aria-label="Toggle menu"]');
      
      // Should see mobile menu with sign in option
      await expect(page.locator('text=Sign In')).toBeVisible();
      
      // Click sign in
      await page.click('text=Sign In');
      
      // Should navigate to /auth/signin
      await expect(page).toHaveURL('/auth/signin');
    });

    test('should allow guest adventure flow on mobile', async ({ page }) => {
      // Navigate to adventure character selection
      await page.goto('/adventures/mystika-tutorial/characters');
      
      // Should load the page without redirecting to auth
      await expect(page).toHaveURL('/adventures/mystika-tutorial/characters');
      
      // Should see the character selection content
      await expect(page.locator('text=Character Selection')).toBeVisible();
    });
  });
});
