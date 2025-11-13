/**
 * Admin Media Upload E2E Tests
 * Phase 3a: End-to-end tests for image upload flow
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Media Upload', () => {
  test.beforeEach(async ({ page }) => {
    // Assume admin authentication is handled by route guard
    // In real tests, you'd set up auth state here
  });

  test('should upload and finalize image successfully', async ({ page }) => {
    // Navigate to admin world edit page
    await page.goto('/admin/worlds/test-world-id/edit');

    // Wait for Images section to be visible (requires FF_ADMIN_MEDIA=true)
    await page.waitForSelector('text=Images (Admin)', { timeout: 5000 });

    // Mock network requests
    await page.route('**/api/media/uploads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            uploadURL: 'https://upload.imagedelivery.net/test-upload',
            media: {
              id: 'media-test-123',
              provider_key: 'cf-test-456',
              status: 'pending',
            },
          },
        }),
      });
    });

    await page.route('https://upload.imagedelivery.net/test-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          result: {
            id: 'cf-test-456',
            filename: 'test.jpg',
            uploaded: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/media/media-test-123/finalize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            media: {
              id: 'media-test-123',
              provider_key: 'cf-test-456',
              status: 'ready',
              width: 1920,
              height: 1080,
              image_review_status: 'pending',
            },
          },
        }),
      });
    });

    // Click upload button
    await page.click('text=Upload image');

    // Create a test file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    // Wait for preview to appear
    await page.waitForSelector('text=Preview', { timeout: 10000 });
    await page.waitForSelector('img[alt="Uploaded image preview"]', { timeout: 10000 });

    // Verify dimensions are shown
    await expect(page.locator('text=1920 × 1080')).toBeVisible();
  });

  test('should show error on Cloudflare upload failure', async ({ page }) => {
    await page.goto('/admin/worlds/test-world-id/edit');
    await page.waitForSelector('text=Images (Admin)', { timeout: 5000 });

    await page.route('**/api/media/uploads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            uploadURL: 'https://upload.imagedelivery.net/test-upload',
            media: { id: 'media-test-123', provider_key: 'cf-test-456' },
          },
        }),
      });
    });

    await page.route('https://upload.imagedelivery.net/test-upload', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errors: [{ message: 'Invalid image format' }],
        }),
      });
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    // Wait for error message
    await page.waitForSelector('text=/Invalid image format|Cloudflare upload failed/', { timeout: 10000 });
    await expect(page.locator('text=Retry')).toBeVisible();
  });

  test('should show error on finalize failure', async ({ page }) => {
    await page.goto('/admin/worlds/test-world-id/edit');
    await page.waitForSelector('text=Images (Admin)', { timeout: 5000 });

    await page.route('**/api/media/uploads', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            uploadURL: 'https://upload.imagedelivery.net/test-upload',
            media: { id: 'media-test-123', provider_key: 'cf-test-456' },
          },
        }),
      });
    });

    await page.route('https://upload.imagedelivery.net/test-upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/media/media-test-123/finalize', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { message: 'Cloudflare API error' },
        }),
      });
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image data'),
    });

    // Wait for error message
    await page.waitForSelector('text=/Finalize failed|Cloudflare API error/', { timeout: 10000 });
  });
});



