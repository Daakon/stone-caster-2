/**
 * Admin Media Approvals E2E Tests
 * Phase 3c: End-to-end tests for image approvals UI
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Media Approvals', () => {
  const mockPendingMedia = [
    {
      id: 'media-1',
      owner_user_id: 'user-123',
      kind: 'world',
      provider: 'cloudflare_images',
      provider_key: 'cf-123',
      visibility: 'private',
      status: 'ready',
      image_review_status: 'pending',
      width: 1920,
      height: 1080,
      sha256: null,
      created_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
    },
    {
      id: 'media-2',
      owner_user_id: 'user-456',
      kind: 'story',
      provider: 'cloudflare_images',
      provider_key: 'cf-456',
      visibility: 'private',
      status: 'ready',
      image_review_status: 'pending',
      width: 800,
      height: 600,
      sha256: null,
      created_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock admin user session
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'admin-user',
          user_metadata: { role: 'admin' }
        }
      }));
    });

    // Mock feature flag
    await page.addInitScript(() => {
      (window as any).__FF_ADMIN_MEDIA__ = true;
    });
  });

  test('should show pending images table', async ({ page }) => {
    // Mock GET /api/media/pending
    await page.route('**/api/media/pending*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: mockPendingMedia,
            nextCursor: undefined,
          },
        }),
      });
    });

    await page.goto('/admin/media/approvals');
    
    // Wait for table to load
    await page.waitForSelector('text=Image Approvals');
    
    // Verify table headers
    await expect(page.locator('text=Thumbnail')).toBeVisible();
    await expect(page.locator('text=Kind')).toBeVisible();
    await expect(page.locator('text=Owner')).toBeVisible();
    await expect(page.locator('text=Created')).toBeVisible();
    
    // Verify items are displayed
    await expect(page.locator('text=world')).toBeVisible();
    await expect(page.locator('text=story')).toBeVisible();
  });

  test('should approve a single image', async ({ page }) => {
    let approveCalled = false;
    
    // Mock GET /api/media/pending
    await page.route('**/api/media/pending*', async (route) => {
      const url = new URL(route.request().url());
      // After approve, return empty list
      if (approveCalled) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              items: [],
              nextCursor: undefined,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              items: [mockPendingMedia[0]],
              nextCursor: undefined,
            },
          }),
        });
      }
    });

    // Mock POST /api/media/:id/approve
    await page.route('**/api/media/media-1/approve', async (route) => {
      approveCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            media: {
              ...mockPendingMedia[0],
              image_review_status: 'approved',
            },
          },
        }),
      });
    });

    await page.goto('/admin/media/approvals');
    await page.waitForSelector('text=Approve');
    
    // Click approve button
    const approveButton = page.locator('button:has-text("Approve")').first();
    await approveButton.click();
    
    // Wait for row to disappear (optimistic update)
    await expect(page.locator('text=world')).not.toBeVisible({ timeout: 2000 });
    
    // Verify no error toast
    await expect(page.locator('text=Failed')).not.toBeVisible();
  });

  test('should bulk approve multiple images', async ({ page }) => {
    let bulkApproveCalled = false;
    
    // Mock GET /api/media/pending
    await page.route('**/api/media/pending*', async (route) => {
      if (bulkApproveCalled) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              items: [],
              nextCursor: undefined,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              items: mockPendingMedia,
              nextCursor: undefined,
            },
          }),
        });
      }
    });

    // Mock POST /api/media/approve-bulk
    await page.route('**/api/media/approve-bulk', async (route) => {
      bulkApproveCalled = true;
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            updated: body.ids,
            skipped: [],
          },
        }),
      });
    });

    await page.goto('/admin/media/approvals');
    await page.waitForSelector('text=Approve');
    
    // Select both rows
    const checkboxes = page.locator('input[type="checkbox"]').filter({ hasNotText: 'Select all' });
    await checkboxes.nth(1).check(); // First item checkbox
    await checkboxes.nth(2).check(); // Second item checkbox
    
    // Click bulk approve
    await page.click('button:has-text("Approve Selected")');
    
    // Wait for rows to disappear
    await expect(page.locator('text=world')).not.toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=story')).not.toBeVisible({ timeout: 2000 });
  });

  test('should rollback on API error', async ({ page }) => {
    // Mock GET /api/media/pending
    await page.route('**/api/media/pending*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: [mockPendingMedia[0]],
            nextCursor: undefined,
          },
        }),
      });
    });

    // Mock POST /api/media/:id/approve to fail
    await page.route('**/api/media/media-1/approve', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server error',
          },
        }),
      });
    });

    await page.goto('/admin/media/approvals');
    await page.waitForSelector('text=Approve');
    
    // Click approve
    await page.click('button:has-text("Approve")');
    
    // Row should remain visible (rollback)
    await expect(page.locator('text=world')).toBeVisible({ timeout: 3000 });
    
    // Error toast should appear
    await expect(page.locator('text=Failed')).toBeVisible();
  });

  test('should hide nav item when feature flag is off', async ({ page }) => {
    // Mock feature flag as false
    await page.addInitScript(() => {
      (window as any).__FF_ADMIN_MEDIA__ = false;
    });

    await page.goto('/admin');
    
    // Nav item should not be visible
    await expect(page.locator('text=Image Approvals')).not.toBeVisible();
  });

  test('should redirect non-admin users', async ({ page }) => {
    // Mock non-admin user
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        user: {
          id: 'regular-user',
          user_metadata: { role: 'user' }
        }
      }));
    });

    await page.goto('/admin/media/approvals');
    
    // Should show access denied or redirect
    await expect(
      page.locator('text=Access Denied').or(page.locator('text=You don\'t have permission'))
    ).toBeVisible({ timeout: 5000 });
  });
});


