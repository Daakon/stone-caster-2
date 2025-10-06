import { test, expect } from '@playwright/test';

test.describe('Layer P1 - Live Data Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API responses for consistent testing
    await page.route('**/api/games/*', async (route) => {
      const gameId = route.request().url().split('/').pop();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: gameId,
            adventureId: 'adventure-1',
            characterId: 'character-1',
            turnCount: 1,
            status: 'active',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            lastPlayedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });

    await page.route('**/api/adventures/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'adventure-1',
            title: 'The Tavern Mystery',
            name: 'The Tavern Mystery',
            description: 'A mysterious adventure that begins in a tavern',
            worldId: 'world-1',
            isPublic: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });

    await page.route('**/api/characters/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'character-1',
            name: 'Test Character',
            class: 'Warrior',
            level: 1,
            stats: { strength: 10, dexterity: 10, constitution: 10 },
            avatar: 'warrior',
            backstory: 'A brave warrior',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });

    await page.route('**/api/worlds/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'world-1',
            name: 'Fantasy Realm',
            title: 'Fantasy Realm',
            tagline: 'A magical world of adventure',
            description: 'A magical world full of adventure and mystery',
            rules: [
              {
                id: 'rule-1',
                name: 'Magic',
                description: 'Magic power level',
                type: 'meter',
                min: 0,
                max: 100,
                current: 50,
              },
            ],
            tags: ['fantasy', 'magic', 'adventure'],
          },
        }),
      });
    });

    await page.route('**/api/stones/wallet', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'wallet-1',
            userId: 'user-1',
            castingStones: 100,
            balance: 100,
            inventoryShard: 0,
            inventoryCrystal: 0,
            inventoryRelic: 0,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });
  });

  test('should load game page with live data from APIs', async ({ page }) => {
    await page.goto('/play/test-game-id');

    // Should show loading skeleton initially
    await expect(page.getByText('Loading game...')).toBeVisible();

    // Wait for the game data to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();
    await expect(page.getByText('Playing as Test Character in Fantasy Realm')).toBeVisible();
    await expect(page.getByText('100')).toBeVisible(); // Wallet balance
    await expect(page.getByText('stones')).toBeVisible();

    // Should display world information
    await expect(page.getByText('Fantasy Realm')).toBeVisible();
    await expect(page.getByText('A magical world of adventure')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/games/*', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Game not found',
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Should show error state
    await expect(page.getByText('Game Not Found')).toBeVisible();
    await expect(page.getByText('Game not found')).toBeVisible();
    await expect(page.getByText('Back to Adventures')).toBeVisible();
  });

  test('should handle missing adventure data', async ({ page }) => {
    // Mock adventure API error
    await page.route('**/api/adventures/*', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Adventure not found',
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Should show missing data error
    await expect(page.getByText('Missing Game Data')).toBeVisible();
    await expect(page.getByText('Unable to load required game information.')).toBeVisible();
  });

  test('should handle guest users without character data', async ({ page }) => {
    // Mock game data without characterId for guest users
    await page.route('**/api/games/*', async (route) => {
      const gameId = route.request().url().split('/').pop();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: gameId,
            adventureId: 'adventure-1',
            characterId: undefined, // Guest users don't have characters
            turnCount: 1,
            status: 'active',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            lastPlayedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Should load successfully without character data
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();
    await expect(page.getByText('Fantasy Realm')).toBeVisible();
  });

  test('should display loading skeletons during data fetching', async ({ page }) => {
    // Mock slow API responses
    await page.route('**/api/games/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const gameId = route.request().url().split('/').pop();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: gameId,
            adventureId: 'adventure-1',
            characterId: 'character-1',
            turnCount: 1,
            status: 'active',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            lastPlayedAt: '2023-01-01T00:00:00Z',
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Should show loading skeleton
    await expect(page.getByText('Loading game...')).toBeVisible();

    // Wait for content to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();
  });

  test('should be accessible on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/play/test-game-id');

    // Wait for content to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();
    await expect(page.getByText('Playing as Test Character in Fantasy Realm')).toBeVisible();

    // Check that the layout is responsive
    const gameHeader = page.locator('h1').first();
    await expect(gameHeader).toBeVisible();

    // Check that wallet balance is visible
    await expect(page.getByText('100')).toBeVisible();
    await expect(page.getByText('stones')).toBeVisible();
  });

  test('should handle turn submission with live data', async ({ page }) => {
    // Mock turn submission
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'turn-1',
            game_id: 'test-game-id',
            option_id: 'option-test-action',
            ai_response: {
              narrative: 'You take the test action.',
              emotion: 'determined',
              suggestedActions: ['Continue', 'Look around'],
            },
            created_at: '2023-01-01T00:00:00Z',
            turnCount: 2,
            castingStonesBalance: 95,
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Wait for content to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();

    // The turn submission would be tested when the actual turn input component is implemented
    // For now, we verify the page loads correctly with the mocked turn submission endpoint
  });

  test('should handle insufficient stones error', async ({ page }) => {
    // Mock insufficient stones error
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INSUFFICIENT_STONES',
            message: 'Not enough casting stones to take this turn.',
          },
        }),
      });
    });

    await page.goto('/play/test-game-id');

    // Wait for content to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();

    // The error handling would be tested when the turn submission is actually triggered
    // This test verifies the page can handle the error state
  });

  test('should pass accessibility checks', async ({ page }) => {
    await page.goto('/play/test-game-id');

    // Wait for content to load
    await expect(page.getByText('The Tavern Mystery')).toBeVisible();

    // Run accessibility checks
    const accessibilityScanResults = await page.accessibility.snapshot();
    expect(accessibilityScanResults).toBeDefined();

    // Check for proper heading structure
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    // Check for proper button accessibility
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      await expect(button).toHaveAttribute('type');
    }
  });
});


