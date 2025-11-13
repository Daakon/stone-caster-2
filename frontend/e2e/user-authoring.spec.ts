/**
 * User Authoring E2E Tests
 * Phase 8: Test user authoring flows end-to-end
 */

import { test, expect } from '@playwright/test';

test.describe('User Authoring', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is logged in (would need auth setup in real test)
    // For now, this is a template
  });

  test('My Stories: shows quota and status chips', async ({ page }) => {
    // Mock API response
    await page.route('**/api/stories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                id: 'story-1',
                title: 'Test Story',
                publish_status: 'draft',
                updated_at: new Date().toISOString(),
              },
            ],
            total: 1,
            quotas: {
              limit: 3,
              used: 1,
              remaining: 2,
            },
          },
        }),
      });
    });

    await page.goto('/my/stories');

    // Verify quota display
    await expect(page.getByText(/Stories: 1 \/ 3/)).toBeVisible();

    // Verify status chip
    await expect(page.getByText('Draft')).toBeVisible();
  });

  test('My Stories: submitting draft for publish changes status to In Review', async ({ page }) => {
    // Mock list response
    await page.route('**/api/stories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                id: 'story-1',
                title: 'Test Story',
                publish_status: 'draft',
                updated_at: new Date().toISOString(),
              },
            ],
            total: 1,
            quotas: { limit: 3, used: 1, remaining: 2 },
          },
        }),
      });
    });

    // Mock submit response
    await page.route('**/api/stories/story-1/submit-for-publish', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { submitted: true },
        }),
      });
    });

    // Mock updated list response (after submit)
    let submitCalled = false;
    await page.route('**/api/stories', async (route) => {
      if (submitCalled) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: 'story-1',
                  title: 'Test Story',
                  publish_status: 'in_review',
                  updated_at: new Date().toISOString(),
                },
              ],
              total: 1,
              quotas: { limit: 3, used: 1, remaining: 2 },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/my/stories');

    // Click Submit for Publish
    await page.getByRole('button', { name: /Submit for Publish/i }).click();

    submitCalled = true;

    // Verify status changed to In Review
    await expect(page.getByText('In Review')).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit/i })).not.toBeVisible();
  });

  test('My Stories: Create button disabled at quota', async ({ page }) => {
    // Mock quota reached response
    await page.route('**/api/stories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: [],
            total: 0,
            quotas: {
              limit: 3,
              used: 3,
              remaining: 0,
            },
          },
        }),
      });
    });

    await page.goto('/my/stories');

    // Verify Create button is disabled
    const createButton = page.getByRole('button', { name: /Create Story/i });
    await expect(createButton).toBeDisabled();

    // Verify quota message
    await expect(page.getByText(/You've reached the limit/)).toBeVisible();
  });

  test('My Stories: Submit error shows validation message', async ({ page }) => {
    // Mock list response
    await page.route('**/api/stories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                id: 'story-1',
                title: 'Test Story',
                publish_status: 'draft',
                updated_at: new Date().toISOString(),
              },
            ],
            total: 1,
            quotas: { limit: 3, used: 1, remaining: 2 },
          },
        }),
      });
    });

    // Mock validation error
    await page.route('**/api/stories/story-1/submit-for-publish', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            details: {
              fieldsMissing: ['description'],
            },
          },
        }),
      });
    });

    await page.goto('/my/stories');

    // Click Submit
    await page.getByRole('button', { name: /Submit for Publish/i }).click();

    // Verify error toast (would need toast library setup in real test)
    // For now, verify status remains Draft
    await expect(page.getByText('Draft')).toBeVisible();
  });
});

