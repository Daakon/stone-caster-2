import { test, expect } from '@playwright/test';

test.describe('Layer P0 Guest Play Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('should complete guest spawn->turn loop through /play/:gameId', async ({ page }) => {
    // Mock API responses for guest flow
    await page.route('**/api/games', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'game-123',
              adventureId: 'adventure-456',
              adventureTitle: 'The Mystika Tutorial',
              adventureDescription: 'Learn the basics of magic',
              characterId: undefined,
              characterName: 'Guest Hero',
              worldSlug: 'mystika',
              worldName: 'Mystika',
              turnCount: 0,
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              lastPlayedAt: '2024-01-01T00:00:00Z',
            },
            meta: {
              traceId: 'test-trace-123',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/games/game-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'game-123',
            adventureId: 'adventure-456',
            adventureTitle: 'The Mystika Tutorial',
            adventureDescription: 'Learn the basics of magic',
            characterId: undefined,
            characterName: 'Guest Hero',
            worldSlug: 'mystika',
            worldName: 'Mystika',
            turnCount: 0,
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            lastPlayedAt: '2024-01-01T00:00:00Z',
            currentScene: {
              id: 'tavern',
              title: 'The Tavern',
              description: 'A cozy tavern where adventurers gather.',
              options: [
                {
                  id: 'option-1',
                  text: 'Ask the bartender about rumors',
                  type: 'action',
                },
                {
                  id: 'option-2',
                  text: 'Order a drink',
                  type: 'action',
                },
              ],
            },
            history: [],
          },
          meta: {
            traceId: 'test-trace-123',
          },
        }),
      });
    });

    await page.route('**/api/games/game-123/turn', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'turn-123',
            game_id: 'game-123',
            option_id: 'option-1',
            ai_response: {
              narrative: 'The bartender leans in and whispers about strange happenings in the forest.',
              emotion: 'mysterious',
              suggestedActions: ['Investigate the forest', 'Ask for more details'],
            },
            created_at: '2024-01-01T00:00:00Z',
          },
          meta: {
            traceId: 'test-trace-123',
          },
        }),
      });
    });

    // Navigate to adventure character selection
    await page.goto('/adventures/mystika-tutorial/characters');
    
    // Should be able to see and interact with adventure content
    await expect(page.locator('text=Begin Adventure')).toBeVisible();
    
    // Click begin adventure to spawn game
    await page.click('text=Begin Adventure');
    
    // Should navigate to game page
    await expect(page).toHaveURL(/\/play\/game-123/);
    
    // Should see game content
    await expect(page.locator('text=The Tavern')).toBeVisible();
    await expect(page.locator('text=A cozy tavern where adventurers gather.')).toBeVisible();
    
    // Should see available options
    await expect(page.locator('text=Ask the bartender about rumors')).toBeVisible();
    await expect(page.locator('text=Order a drink')).toBeVisible();
    
    // Click on an option to submit a turn
    await page.click('text=Ask the bartender about rumors');
    
    // Should see the AI response
    await expect(page.locator('text=The bartender leans in and whispers about strange happenings in the forest.')).toBeVisible();
    
    // Should not redirect to auth
    await expect(page).not.toHaveURL(/\/auth/);
    
    // Should still be on the game page
    await expect(page).toHaveURL(/\/play\/game-123/);
  });

  test('should handle insufficient stones error gracefully', async ({ page }) => {
    // Mock insufficient stones response
    await page.route('**/api/games/game-123/turn', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'INSUFFICIENT_STONES',
          message: 'Insufficient casting stones. Have 0, need 2',
          meta: {
            traceId: 'test-trace-123',
          },
        }),
      });
    });

    // Navigate directly to game page (simulating existing game)
    await page.goto('/play/game-123');
    
    // Should see game content
    await expect(page.locator('text=The Tavern')).toBeVisible();
    
    // Click on an option
    await page.click('text=Ask the bartender about rumors');
    
    // Should show insufficient stones error
    await expect(page.locator('text=Insufficient casting stones')).toBeVisible();
    
    // Should not redirect to auth
    await expect(page).not.toHaveURL(/\/auth/);
    
    // Should still be on the game page
    await expect(page).toHaveURL(/\/play\/game-123/);
  });

  test('should maintain guest session across page refreshes', async ({ page }) => {
    // Set a guest cookie
    await page.context().addCookies([
      {
        name: 'guestId',
        value: 'guest-cookie-123',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
    ]);

    // Mock game fetch
    await page.route('**/api/games/game-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'game-123',
            adventureId: 'adventure-456',
            adventureTitle: 'The Mystika Tutorial',
            characterId: undefined,
            characterName: 'Guest Hero',
            worldSlug: 'mystika',
            worldName: 'Mystika',
            turnCount: 0,
            status: 'active',
            currentScene: {
              id: 'tavern',
              title: 'The Tavern',
              description: 'A cozy tavern where adventurers gather.',
              options: [
                {
                  id: 'option-1',
                  text: 'Ask the bartender about rumors',
                  type: 'action',
                },
              ],
            },
            history: [],
          },
          meta: {
            traceId: 'test-trace-123',
          },
        }),
      });
    });

    // Navigate to game page
    await page.goto('/play/game-123');
    
    // Should see game content
    await expect(page.locator('text=The Tavern')).toBeVisible();
    
    // Refresh the page
    await page.reload();
    
    // Should still see game content (guest session maintained)
    await expect(page.locator('text=The Tavern')).toBeVisible();
    
    // Should not redirect to auth
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Mock game fetch
    await page.route('**/api/games/game-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'game-123',
            adventureId: 'adventure-456',
            adventureTitle: 'The Mystika Tutorial',
            characterId: undefined,
            characterName: 'Guest Hero',
            worldSlug: 'mystika',
            worldName: 'Mystika',
            turnCount: 0,
            status: 'active',
            currentScene: {
              id: 'tavern',
              title: 'The Tavern',
              description: 'A cozy tavern where adventurers gather.',
              options: [
                {
                  id: 'option-1',
                  text: 'Ask the bartender about rumors',
                  type: 'action',
                },
              ],
            },
            history: [],
          },
          meta: {
            traceId: 'test-trace-123',
          },
        }),
      });
    });

    // Navigate to game page
    await page.goto('/play/game-123');
    
    // Should see game content on mobile
    await expect(page.locator('text=The Tavern')).toBeVisible();
    
    // Should be able to interact with options
    await expect(page.locator('text=Ask the bartender about rumors')).toBeVisible();
    
    // Should not redirect to auth
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
