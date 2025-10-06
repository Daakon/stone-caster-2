import { test, expect } from '@playwright/test';

test.describe('Games E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test.describe('Guest User Flow', () => {
    test('should spawn a game as guest user', async ({ page }) => {
      // Mock API responses
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'game-123',
                adventureId: 'adventure-123',
                adventureTitle: 'The Mystika Tutorial',
                adventureDescription: 'Learn the basics of magic',
                characterId: 'character-123',
                characterName: 'Test Hero',
                worldSlug: 'mystika',
                worldName: 'Mystika',
                turnCount: 0,
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                lastPlayedAt: '2024-01-01T00:00:00Z',
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: [],
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Mock character creation
      await page.route('**/api/characters', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'character-123',
                name: 'Test Hero',
                race: 'Human',
                class: 'Mage',
                level: 1,
                experience: 0,
                attributes: {
                  strength: 10,
                  dexterity: 10,
                  constitution: 10,
                  intelligence: 10,
                  wisdom: 10,
                  charisma: 10,
                },
                skills: [],
                inventory: [],
                currentHealth: 10,
                maxHealth: 10,
                worldSlug: 'mystika',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Mock adventures endpoint
      await page.route('**/api/adventures', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'adventure-123',
                slug: 'mystika-tutorial',
                title: 'The Mystika Tutorial',
                description: 'Learn the basics of magic',
                worldSlug: 'mystika',
                worldName: 'Mystika',
                tags: ['tutorial', 'beginner', 'magic'],
                scenarios: ['The Awakening', 'First Spells', 'The Test']
              }
            ],
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Wait for adventures to load
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should navigate to character creation or game spawn
      await expect(page).toHaveURL(/.*adventure.*mystika-tutorial/);

      // If character creation is required, fill it out
      if (await page.locator('input[name="name"]').isVisible()) {
        await page.fill('input[name="name"]', 'Test Hero');
        await page.selectOption('select[name="race"]', 'Human');
        await page.selectOption('select[name="class"]', 'Mage');
        await page.click('button[type="submit"]');
      }

      // Should spawn the game
      await expect(page).toHaveURL(/.*game.*game-123/);

      // Verify game view is displayed
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();
      await expect(page.locator('text=Test Hero')).toBeVisible();
      await expect(page.locator('text=Mystika')).toBeVisible();
    });

    test('should handle single-active constraint', async ({ page }) => {
      // Mock API responses for conflict scenario
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'CONFLICT',
                message: 'Character is already active in another game'
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should show error message
      await expect(page.locator('text=Character is already active in another game')).toBeVisible();
    });
  });

  test.describe('Authenticated User Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication
      await page.route('**/api/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              user: {
                id: 'user-123',
                email: 'test@example.com'
              },
              kind: 'user'
            },
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });
    });

    test('should spawn a game as authenticated user', async ({ page }) => {
      // Mock API responses
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'game-123',
                adventureId: 'adventure-123',
                adventureTitle: 'The Mystika Tutorial',
                adventureDescription: 'Learn the basics of magic',
                characterId: 'character-123',
                characterName: 'Test Hero',
                worldSlug: 'mystika',
                worldName: 'Mystika',
                turnCount: 0,
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                lastPlayedAt: '2024-01-01T00:00:00Z',
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: [
                {
                  id: 'game-123',
                  adventureTitle: 'The Mystika Tutorial',
                  characterName: 'Test Hero',
                  worldName: 'Mystika',
                  turnCount: 0,
                  status: 'active',
                  lastPlayedAt: '2024-01-01T00:00:00Z',
                }
              ],
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Mock character creation
      await page.route('**/api/characters', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'character-123',
                name: 'Test Hero',
                race: 'Human',
                class: 'Mage',
                level: 1,
                experience: 0,
                attributes: {
                  strength: 10,
                  dexterity: 10,
                  constitution: 10,
                  intelligence: 10,
                  wisdom: 10,
                  charisma: 10,
                },
                skills: [],
                inventory: [],
                currentHealth: 10,
                maxHealth: 10,
                worldSlug: 'mystika',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Mock adventures endpoint
      await page.route('**/api/adventures', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'adventure-123',
                slug: 'mystika-tutorial',
                title: 'The Mystika Tutorial',
                description: 'Learn the basics of magic',
                worldSlug: 'mystika',
                worldName: 'Mystika',
                tags: ['tutorial', 'beginner', 'magic'],
                scenarios: ['The Awakening', 'First Spells', 'The Test']
              }
            ],
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Wait for adventures to load
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should navigate to character creation or game spawn
      await expect(page).toHaveURL(/.*adventure.*mystika-tutorial/);

      // If character creation is required, fill it out
      if (await page.locator('input[name="name"]').isVisible()) {
        await page.fill('input[name="name"]', 'Test Hero');
        await page.selectOption('select[name="race"]', 'Human');
        await page.selectOption('select[name="class"]', 'Mage');
        await page.click('button[type="submit"]');
      }

      // Should spawn the game
      await expect(page).toHaveURL(/.*game.*game-123/);

      // Verify game view is displayed
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();
      await expect(page.locator('text=Test Hero')).toBeVisible();
      await expect(page.locator('text=Mystika')).toBeVisible();
    });

    test('should list user games', async ({ page }) => {
      // Mock games list endpoint
      await page.route('**/api/games', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'game-123',
                adventureTitle: 'The Mystika Tutorial',
                characterName: 'Test Hero',
                worldName: 'Mystika',
                turnCount: 5,
                status: 'active',
                lastPlayedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: 'game-456',
                adventureTitle: 'Forest of Whispers',
                characterName: 'Another Hero',
                worldName: 'Mystika',
                turnCount: 10,
                status: 'completed',
                lastPlayedAt: '2024-01-02T00:00:00Z',
              }
            ],
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });

      // Navigate to games page
      await page.click('text=My Adventures');
      await expect(page).toHaveURL(/.*my-adventures/);

      // Verify games are listed
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();
      await expect(page.locator('text=Forest of Whispers')).toBeVisible();
      await expect(page.locator('text=Test Hero')).toBeVisible();
      await expect(page.locator('text=Another Hero')).toBeVisible();
    });

    test('should continue existing game', async ({ page }) => {
      // Mock game fetch endpoint
      await page.route('**/api/games/game-123', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'game-123',
              adventureId: 'adventure-123',
              adventureTitle: 'The Mystika Tutorial',
              adventureDescription: 'Learn the basics of magic',
              characterId: 'character-123',
              characterName: 'Test Hero',
              worldSlug: 'mystika',
              worldName: 'Mystika',
              turnCount: 5,
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              lastPlayedAt: '2024-01-01T00:00:00Z',
            },
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });

      // Mock games list endpoint
      await page.route('**/api/games', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'game-123',
                adventureTitle: 'The Mystika Tutorial',
                characterName: 'Test Hero',
                worldName: 'Mystika',
                turnCount: 5,
                status: 'active',
                lastPlayedAt: '2024-01-01T00:00:00Z',
              }
            ],
            meta: {
              traceId: 'trace-123'
            }
          })
        });
      });

      // Navigate to games page
      await page.click('text=My Adventures');
      await expect(page).toHaveURL(/.*my-adventures/);

      // Click on existing game
      await page.click('text=The Mystika Tutorial');

      // Should navigate to game view
      await expect(page).toHaveURL(/.*game.*game-123/);

      // Verify game view is displayed
      await expect(page.locator('text=The Mystika Tutorial')).toBeVisible();
      await expect(page.locator('text=Test Hero')).toBeVisible();
      await expect(page.locator('text=Mystika')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle adventure not found', async ({ page }) => {
      // Mock API responses for not found scenario
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Adventure not found'
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should show error message
      await expect(page.locator('text=Adventure not found')).toBeVisible();
    });

    test('should handle character not found', async ({ page }) => {
      // Mock API responses for character not found scenario
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'NOT_FOUND',
                message: 'Character not found'
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should show error message
      await expect(page.locator('text=Character not found')).toBeVisible();
    });

    test('should handle world mismatch', async ({ page }) => {
      // Mock API responses for world mismatch scenario
      await page.route('**/api/games', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'VALIDATION_FAILED',
                message: 'Character and adventure must be from the same world'
              },
              meta: {
                traceId: 'trace-123'
              }
            })
          });
        }
      });

      // Navigate to adventures page
      await page.click('text=Adventures');
      await expect(page).toHaveURL(/.*adventures/);

      // Click on an adventure
      await page.click('text=The Mystika Tutorial');

      // Should show error message
      await expect(page.locator('text=Character and adventure must be from the same world')).toBeVisible();
    });
  });
});

