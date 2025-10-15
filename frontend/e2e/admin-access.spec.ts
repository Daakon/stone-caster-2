import { test, expect } from '@playwright/test';

test.describe('Admin Access Control', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should not show admin links to non-admin users', async ({ page }) => {
    // Check that admin links are not visible in the main navigation
    await expect(page.locator('text=Admin')).not.toBeVisible();
    
    // Check that admin links are not in the mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('text=Admin')).not.toBeVisible();
  });

  test('should redirect non-admin users from admin routes', async ({ page }) => {
    // Try to access admin route directly
    await page.goto('/admin/prompts');
    
    // Should be redirected to dashboard or show access denied
    await expect(page).toHaveURL(/dashboard|auth/);
  });

  test('should show access denied for admin routes without authentication', async ({ page }) => {
    // Try to access admin route without being logged in
    await page.goto('/admin/prompts');
    
    // Should show access denied or redirect to login
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });

  test('should prevent admin API calls from non-admin users', async ({ page }) => {
    // Mock a non-admin user session
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'test-user',
          user_metadata: { role: 'user' }
        }
      }));
    });

    await page.goto('/admin/prompts');
    
    // Should show access denied
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });

  test('should allow admin access for prompt_admin users', async ({ page }) => {
    // Mock an admin user session
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'admin-user',
          user_metadata: { role: 'prompt_admin' }
        }
      }));
    });

    await page.goto('/admin/prompts');
    
    // Should show admin interface
    await expect(page.locator('text=StoneCaster Admin')).toBeVisible();
    await expect(page.locator('text=Prompt Management')).toBeVisible();
  });

  test('should show admin navigation for admin users', async ({ page }) => {
    // Mock an admin user session
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'admin-user',
          user_metadata: { role: 'prompt_admin' }
        }
      }));
    });

    await page.goto('/admin/prompts');
    
    // Should show admin navigation
    await expect(page.locator('text=Prompts')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
  });

  test('should handle admin role verification errors gracefully', async ({ page }) => {
    // Mock a session with no role
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'test-user',
          user_metadata: {}
        }
      }));
    });

    await page.goto('/admin/prompts');
    
    // Should show access denied
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });
});
