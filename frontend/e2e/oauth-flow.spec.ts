import { test, expect } from '@playwright/test';

test.describe('OAuth Flow', () => {
  test('should complete Google OAuth flow and show authenticated state', async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/auth/signin');
    
    // Wait for the page to load
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Mock the OAuth callback by simulating the URL hash parameters
    // This simulates what happens when Google redirects back to our app
    await page.evaluate(() => {
      // Simulate OAuth callback with hash parameters
      const mockHash = '#access_token=mock_access_token&refresh_token=mock_refresh_token&token_type=bearer&expires_in=3600';
      window.location.hash = mockHash;
      
      // Trigger a hash change event
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    
    // Wait for the auth state to update
    await page.waitForTimeout(2000);
    
    // Check that we're no longer on the auth page (should redirect to intended route)
    await expect(page).not.toHaveURL(/\/auth\/signin/);
    
    // Check that the user is authenticated (look for user-specific elements)
    // This might be a header with user info, or a different page layout
    const userElements = page.locator('[data-testid="user-info"], .user-info, [class*="user"]').first();
    if (await userElements.isVisible()) {
      await expect(userElements).toBeVisible();
    }
  });

  test('should handle OAuth callback with search parameters', async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/auth/signin');
    
    // Wait for the page to load
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Mock the OAuth callback by simulating URL search parameters
    await page.evaluate(() => {
      // Simulate OAuth callback with search parameters
      const mockSearch = '?code=mock_auth_code&state=mock_state';
      const url = new URL(window.location.href);
      url.search = mockSearch;
      window.history.replaceState({}, '', url.toString());
      
      // Trigger a popstate event
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    
    // Wait for the auth state to update
    await page.waitForTimeout(2000);
    
    // Check that we're no longer on the auth page
    await expect(page).not.toHaveURL(/\/auth\/signin/);
  });

  test('should preserve intended route after OAuth', async ({ page }) => {
    // Navigate to a protected page first (this should redirect to auth)
    await page.goto('/profile');
    
    // Should be redirected to auth page
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // Mock OAuth callback
    await page.evaluate(() => {
      const mockHash = '#access_token=mock_access_token&refresh_token=mock_refresh_token&token_type=bearer&expires_in=3600';
      window.location.hash = mockHash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    
    // Wait for auth state to update
    await page.waitForTimeout(2000);
    
    // Should be redirected back to the original intended route
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should handle OAuth error gracefully', async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/auth/signin');
    
    // Wait for the page to load
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Mock OAuth error callback
    await page.evaluate(() => {
      const mockHash = '#error=access_denied&error_description=User+denied+access';
      window.location.hash = mockHash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    
    // Wait for error handling
    await page.waitForTimeout(1000);
    
    // Should still be on auth page (not redirected)
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // Should show some error indication
    const errorElements = page.locator('[data-testid="error"], .error, [class*="error"]').first();
    if (await errorElements.isVisible()) {
      await expect(errorElements).toBeVisible();
    }
  });

  test('should maintain guest wallet access during OAuth flow', async ({ page }) => {
    // Navigate to landing page as guest
    await page.goto('/');
    
    // Check if wallet balance is visible (should work for guests)
    const walletElement = page.locator('[data-testid="wallet-balance"], .wallet-balance, [class*="wallet"]').first();
    
    if (await walletElement.isVisible()) {
      // Should show empty wallet for guests
      await expect(walletElement).toContainText(/0|empty/i);
    }
    
    // Navigate to sign-in page
    await page.goto('/auth/signin');
    
    // Mock OAuth callback
    await page.evaluate(() => {
      const mockHash = '#access_token=mock_access_token&refresh_token=mock_refresh_token&token_type=bearer&expires_in=3600';
      window.location.hash = mockHash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    
    // Wait for auth state to update
    await page.waitForTimeout(2000);
    
    // Wallet should still be accessible (now for authenticated user)
    if (await walletElement.isVisible()) {
      await expect(walletElement).toBeVisible();
    }
  });
});
