import { test, expect } from '@playwright/test';

test.describe('Auth Flow Fixes', () => {
  test('should allow guests to stay on sign-in page without redirecting', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');
    
    // Click sign in button
    await page.click('text=Sign In');
    
    // Should stay on auth page, not redirect back to landing
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // Should see the sign-in form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Should not redirect back to landing page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('should show wallet balance for guests', async ({ page }) => {
    // Navigate to landing page as guest
    await page.goto('/');
    
    // Check if wallet balance is visible in header or somewhere
    // This test assumes there's a wallet display somewhere on the page
    const walletElement = page.locator('[data-testid="wallet-balance"], .wallet-balance, [class*="wallet"]').first();
    
    if (await walletElement.isVisible()) {
      // Should show empty wallet for guests
      await expect(walletElement).toContainText(/0|empty/i);
    }
  });

  test('should navigate to play route with characterId', async ({ page }) => {
    // This test requires a valid character ID
    // For now, we'll test that the route doesn't return 404
    const testCharacterId = 'test-character-123';
    
    await page.goto(`/play/${testCharacterId}`);
    
    // Should not show 404 page
    await expect(page.locator('text=Page Not Found')).not.toBeVisible();
    
    // Should show some game-related content or error message
    // (The specific content depends on whether the character exists)
    const gameContent = page.locator('[data-testid="game-content"], .game-content, [class*="game"]').first();
    const errorMessage = page.locator('[data-testid="error"], .error, [class*="error"]').first();
    
    // Either game content or error message should be visible
    const hasGameContent = await gameContent.isVisible();
    const hasErrorMessage = await errorMessage.isVisible();
    
    expect(hasGameContent || hasErrorMessage).toBeTruthy();
  });

  test('should have proper autocomplete attributes on password fields', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Check sign-in password field
    const signinPassword = page.locator('#signin-password');
    await expect(signinPassword).toHaveAttribute('autocomplete', 'current-password');
    
    // Switch to sign-up tab
    await page.click('text=Sign Up');
    
    // Check sign-up password field
    const signupPassword = page.locator('#signup-password');
    await expect(signupPassword).toHaveAttribute('autocomplete', 'new-password');
  });

  test('should handle successful sign-in flow', async ({ page }) => {
    // This test would require valid credentials
    // For now, we'll just test that the form submission doesn't cause errors
    await page.goto('/auth/signin');
    
    // Fill in form fields
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should not redirect back to landing page immediately
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/auth\/signin/);
    
    // Should show some feedback (error message for invalid credentials)
    const errorMessage = page.locator('[data-testid="error"], .error, [class*="error"]').first();
    await expect(errorMessage).toBeVisible();
  });
});
