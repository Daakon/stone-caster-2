import { test, expect } from '@playwright/test';

test.describe('Start Story Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API responses
    await page.route('**/catalog/stories/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          title: 'Test Story',
          short_desc: 'A test story description',
          hero_image_url: 'https://example.com/hero.jpg',
          world_id: 'world-1',
          kind: 'adventure',
          status: 'active',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        }),
      });
    });

    await page.route('**/me/characters', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'char-1',
            name: 'Test Character',
            portrait_seed: 'seed1',
            portrait_url: 'https://example.com/portrait1.jpg',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/auth/guest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'guest-token-123' }),
      });
    });

    await page.route('**/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'session-1',
          story_id: '1',
          character_id: 'char-1',
          status: 'active',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        }),
      });
    });
  });

  test('complete guest flow with existing character', async ({ page }) => {
    // Track analytics events
    const analyticsEvents: any[] = [];
    await page.exposeFunction('trackAnalytics', (event: string, props: any) => {
      analyticsEvents.push({ event, props });
    });

    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Wait for story to load
    await expect(page.getByText('Test Story')).toBeVisible();
    await expect(page.getByText('A test story description')).toBeVisible();

    // Click Continue to go to auth gate
    await page.getByText('Continue').click();

    // Should show auth gate
    await expect(page.getByText('How would you like to continue?')).toBeVisible();
    await expect(page.getByText('Continue as Guest')).toBeVisible();

    // Click Continue as Guest
    await page.getByText('Continue as Guest').click();

    // Should show character picker
    await expect(page.getByText('Choose Your Character')).toBeVisible();
    await expect(page.getByText('Test Character')).toBeVisible();
    await expect(page.getByText('Create New Character')).toBeVisible();

    // Select existing character
    await page.getByText('Test Character').click();

    // Should show confirmation step
    await expect(page.getByText('Ready to Begin?')).toBeVisible();
    await expect(page.getByText('Begin Story')).toBeVisible();

    // Click Begin Story
    await page.getByText('Begin Story').click();

    // Should redirect to session page
    await expect(page).toHaveURL(/\/play\/session\/session-1/);
  });

  test('complete guest flow with new character', async ({ page }) => {
    // Mock character creation
    await page.route('**/me/characters', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'char-2',
            name: 'New Character',
            portrait_seed: 'new-seed',
            portrait_url: 'https://example.com/portrait2.jpg',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Go through auth gate
    await page.getByText('Continue').click();
    await page.getByText('Continue as Guest').click();

    // Should show character picker with no existing characters
    await expect(page.getByText('Choose Your Character')).toBeVisible();
    await expect(page.getByText('Create New Character')).toBeVisible();

    // Click Create New Character
    await page.getByText('Create New Character').click();

    // Should show character creation modal
    await expect(page.getByText('Create New Character')).toBeVisible();
    await expect(page.getByLabelText('Character Name')).toBeVisible();

    // Fill in character details
    await page.getByLabelText('Character Name').fill('New Character');
    await page.getByLabelText('Portrait Seed (optional)').fill('new-seed');

    // Submit character creation
    await page.getByText('Create Character').click();

    // Should show confirmation step with new character
    await expect(page.getByText('Ready to Begin?')).toBeVisible();
    await expect(page.getByText('New Character')).toBeVisible();

    // Click Begin Story
    await page.getByText('Begin Story').click();

    // Should redirect to session page
    await expect(page).toHaveURL(/\/play\/session\/session-1/);
  });

  test('handles story not found error', async ({ page }) => {
    // Mock story not found
    await page.route('**/catalog/stories/999', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Story not found' }),
      });
    });

    // Navigate to non-existent story
    await page.goto('/play/start?story=999');

    // Should show error state
    await expect(page.getByText('Story not found')).toBeVisible();
    await expect(page.getByText('Return to Stories')).toBeVisible();
  });

  test('handles session creation error with retry', async ({ page }) => {
    let sessionCallCount = 0;
    await page.route('**/sessions', async (route) => {
      sessionCallCount++;
      if (sessionCallCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      } else {
        // Retry succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'session-1',
            story_id: '1',
            character_id: 'char-1',
            status: 'active',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          }),
        });
      }
    });

    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Go through the flow
    await page.getByText('Continue').click();
    await page.getByText('Continue as Guest').click();
    await page.getByText('Test Character').click();
    await page.getByText('Begin Story').click();

    // Should show error
    await expect(page.getByText('Failed to start story')).toBeVisible();
    await expect(page.getByText('Try Again')).toBeVisible();

    // Click retry
    await page.getByText('Try Again').click();

    // Should succeed and redirect
    await expect(page).toHaveURL(/\/play\/session\/session-1/);
  });

  test('validates character creation form', async ({ page }) => {
    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Go through auth gate
    await page.getByText('Continue').click();
    await page.getByText('Continue as Guest').click();

    // Click Create New Character
    await page.getByText('Create New Character').click();

    // Try to submit without name
    await page.getByText('Create Character').click();
    await expect(page.getByText('Character name is required')).toBeVisible();

    // Try with name too long
    await page.getByLabelText('Character Name').fill('a'.repeat(51));
    await page.getByText('Create Character').click();
    await expect(page.getByText('Name must be 50 characters or less')).toBeVisible();

    // Try with portrait seed too long
    await page.getByLabelText('Character Name').fill('Valid Name');
    await page.getByLabelText('Portrait Seed (optional)').fill('a'.repeat(101));
    await page.getByText('Create Character').click();
    await expect(page.getByText('Portrait seed must be 100 characters or less')).toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Tab through the page
    await page.keyboard.press('Tab');
    await expect(page.getByText('Continue')).toBeFocused();

    // Press Enter to continue
    await page.keyboard.press('Enter');
    await expect(page.getByText('How would you like to continue?')).toBeVisible();

    // Tab to guest option
    await page.keyboard.press('Tab');
    await expect(page.getByText('Continue as Guest')).toBeFocused();

    // Press Enter to select guest
    await page.keyboard.press('Enter');
    await expect(page.getByText('Choose Your Character')).toBeVisible();

    // Tab to character
    await page.keyboard.press('Tab');
    await expect(page.getByText('Test Character')).toBeFocused();

    // Press Enter to select character
    await page.keyboard.press('Enter');
    await expect(page.getByText('Ready to Begin?')).toBeVisible();

    // Tab to begin button
    await page.keyboard.press('Tab');
    await expect(page.getByText('Begin Story')).toBeFocused();
  });

  test('mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Navigate to start story page
    await page.goto('/play/start?story=1');

    // Check that content is visible and properly sized
    await expect(page.getByText('Test Story')).toBeVisible();
    await expect(page.getByText('A test story description')).toBeVisible();
    await expect(page.getByText('Continue')).toBeVisible();

    // Go through the flow
    await page.getByText('Continue').click();
    await page.getByText('Continue as Guest').click();

    // Check character picker is mobile-friendly
    await expect(page.getByText('Choose Your Character')).toBeVisible();
    await expect(page.getByText('Test Character')).toBeVisible();
  });
});










