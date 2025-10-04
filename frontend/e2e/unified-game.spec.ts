import { test, expect } from '@playwright/test';

test.describe('Unified Game Page - Layer M4', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mobile-First Design (375×812)', () => {
    test('should display unified game interface on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Mock API responses for game data
      await page.route('**/api/games/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'game-123',
              adventureId: 'adventure-123',
              adventureTitle: 'The Mystika Tutorial',
              adventureSlug: 'mystika-tutorial',
              characterId: 'character-123',
              worldSlug: 'mystika',
              turnCount: 0,
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'character-123',
              name: 'Test Hero',
              worldSlug: 'mystika',
              worldData: {
                class: 'mage',
                faction_alignment: 'arcane_order'
              },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/content/worlds', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                title: 'Mystika',
                slug: 'mystika',
                tags: ['magic', 'fantasy'],
                scenarios: ['The Awakening', 'First Spells'],
                displayRules: {
                  allowMagic: true,
                  allowTechnology: false,
                  difficultyLevel: 'medium',
                  combatSystem: 'd20'
                }
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/stones/wallet', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              balance: 15,
              currency: 'stones'
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to game page
      await page.goto('/play/game-123');
      await page.waitForLoadState('networkidle');

      // Check mobile header with hamburger menu
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('[aria-label="Toggle menu"]')).toBeVisible();
      
      // Check stone balance in header
      await expect(page.locator('text=15')).toBeVisible();

      // Check main game content
      await expect(page.locator('h1:has-text("The Mystika Tutorial")')).toBeVisible();
      await expect(page.locator('text=Playing as Test Hero in Mystika')).toBeVisible();
      await expect(page.locator('text=Turn 0')).toBeVisible();

      // Check story section
      await expect(page.locator('text=Story')).toBeVisible();

      // Check turn input
      await expect(page.locator('text=Your Action')).toBeVisible();
      await expect(page.locator('textarea[placeholder="What do you do?"]')).toBeVisible();

      // Check sidebar content (should be stacked on mobile)
      await expect(page.locator('text=Character')).toBeVisible();
      await expect(page.locator('text=Test Hero')).toBeVisible();
      await expect(page.locator('text=mage')).toBeVisible();
      await expect(page.locator('text=arcane_order')).toBeVisible();

      await expect(page.locator('text=World Rules')).toBeVisible();
      await expect(page.locator('text=Casting Stones')).toBeVisible();
      await expect(page.locator('text=15')).toBeVisible();
    });

    test('should handle turn submission and display results', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Mock API responses
      await page.route('**/api/games/*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'game-123',
                adventureId: 'adventure-123',
                adventureTitle: 'The Mystika Tutorial',
                adventureSlug: 'mystika-tutorial',
                characterId: 'character-123',
                worldSlug: 'mystika',
                turnCount: 0,
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

      await page.route('**/api/characters/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'character-123',
              name: 'Test Hero',
              worldSlug: 'mystika',
              worldData: { class: 'mage' },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/content/worlds', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                title: 'Mystika',
                slug: 'mystika',
                tags: ['magic', 'fantasy'],
                scenarios: ['The Awakening'],
                displayRules: { allowMagic: true }
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/stones/wallet', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { balance: 15, currency: 'stones' },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Mock turn submission
      await page.route('**/api/games/*/turn', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'turn-123',
              createdAt: '2024-01-01T00:01:00Z',
              emotion: 'neutral',
              narrative: 'You cast a simple spell and feel the magic flow through you.',
              choices: [
                { id: 'choice-1', label: 'Continue practicing' },
                { id: 'choice-2', label: 'Try a more complex spell' }
              ],
              stoneCost: 1,
              stoneBalance: 14,
              turnCount: 1,
              worldRuleDeltas: {},
              factionDeltas: {}
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to game page
      await page.goto('/play/game-123');
      await page.waitForLoadState('networkidle');

      // Submit a turn
      await page.fill('textarea[placeholder="What do you do?"]', 'I cast a simple spell');
      await page.click('button:has-text("Cast Stone")');

      // Wait for turn to process
      await page.waitForSelector('text=Processing...', { timeout: 5000 });
      await page.waitForSelector('text=You cast a simple spell and feel the magic flow through you.', { timeout: 10000 });

      // Check that turn count updated
      await expect(page.locator('text=Turn 1')).toBeVisible();

      // Check that stone balance updated
      await expect(page.locator('text=14')).toBeVisible();

      // Check that player action appears in history
      await expect(page.locator('text=I cast a simple spell')).toBeVisible();
    });

    test('should handle turn errors gracefully', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Mock API responses for initial load
      await page.route('**/api/games/*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'game-123',
                adventureId: 'adventure-123',
                adventureTitle: 'The Mystika Tutorial',
                adventureSlug: 'mystika-tutorial',
                characterId: 'character-123',
                worldSlug: 'mystika',
                turnCount: 0,
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

      await page.route('**/api/characters/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'character-123',
              name: 'Test Hero',
              worldSlug: 'mystika',
              worldData: { class: 'mage' },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/content/worlds', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                title: 'Mystika',
                slug: 'mystika',
                tags: ['magic', 'fantasy'],
                scenarios: ['The Awakening'],
                displayRules: { allowMagic: true }
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/stones/wallet', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { balance: 0, currency: 'stones' }, // No stones
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Mock turn submission failure
      await page.route('**/api/games/*/turn', async (route) => {
        await route.fulfill({
          status: 402,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'insufficient_stones',
              message: 'Insufficient casting stones to perform this action',
              http: 402
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to game page
      await page.goto('/play/game-123');
      await page.waitForLoadState('networkidle');

      // Submit a turn
      await page.fill('textarea[placeholder="What do you do?"]', 'I cast a spell');
      await page.click('button:has-text("Cast Stone")');

      // Wait for error to appear
      await page.waitForSelector('text=Insufficient Casting Stones', { timeout: 10000 });

      // Check error message
      await expect(page.locator('text=Insufficient Casting Stones')).toBeVisible();
      await expect(page.locator('text=You don\'t have enough stones to perform this action.')).toBeVisible();
      await expect(page.locator('button:has-text("Go to Wallet")')).toBeVisible();
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });
  });

  test.describe('Desktop Layout (≥1024px)', () => {
    test('should display unified game interface on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1024, height: 768 });

      // Mock API responses (same as mobile test)
      await page.route('**/api/games/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'game-123',
              adventureId: 'adventure-123',
              adventureTitle: 'The Mystika Tutorial',
              adventureSlug: 'mystika-tutorial',
              characterId: 'character-123',
              worldSlug: 'mystika',
              turnCount: 0,
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'character-123',
              name: 'Test Hero',
              worldSlug: 'mystika',
              worldData: { class: 'mage', faction_alignment: 'arcane_order' },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/content/worlds', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                title: 'Mystika',
                slug: 'mystika',
                tags: ['magic', 'fantasy'],
                scenarios: ['The Awakening'],
                displayRules: { allowMagic: true }
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/stones/wallet', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { balance: 15, currency: 'stones' },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to game page
      await page.goto('/play/game-123');
      await page.waitForLoadState('networkidle');

      // Check desktop layout - should have sidebar
      await expect(page.locator('aside')).toBeVisible(); // Desktop sidebar
      
      // Check main content area
      await expect(page.locator('h1:has-text("The Mystika Tutorial")')).toBeVisible();
      
      // Check grid layout (main content + sidebar)
      const mainContent = page.locator('.md\\:col-span-2');
      const sidebar = page.locator('.space-y-6');
      
      await expect(mainContent).toBeVisible();
      await expect(sidebar).toBeVisible();

      // Check that sidebar content is visible
      await expect(page.locator('text=Character')).toBeVisible();
      await expect(page.locator('text=World Rules')).toBeVisible();
      await expect(page.locator('text=Casting Stones')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and keyboard navigation', async ({ page }) => {
      // Mock API responses
      await page.route('**/api/games/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'game-123',
              adventureId: 'adventure-123',
              adventureTitle: 'The Mystika Tutorial',
              adventureSlug: 'mystika-tutorial',
              characterId: 'character-123',
              worldSlug: 'mystika',
              turnCount: 0,
              status: 'active',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'character-123',
              name: 'Test Hero',
              worldSlug: 'mystika',
              worldData: { class: 'mage' },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/content/worlds', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                title: 'Mystika',
                slug: 'mystika',
                tags: ['magic', 'fantasy'],
                scenarios: ['The Awakening'],
                displayRules: { allowMagic: true }
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/stones/wallet', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: { balance: 15, currency: 'stones' },
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to game page
      await page.goto('/play/game-123');
      await page.waitForLoadState('networkidle');

      // Check ARIA labels
      await expect(page.locator('[aria-label="Toggle menu"]')).toBeVisible();
      
      // Check form labels
      await expect(page.locator('label[for="action"]')).toBeVisible();
      await expect(page.locator('textarea[id="action"]')).toBeVisible();

      // Check button accessibility
      const submitButton = page.locator('button:has-text("Cast Stone")');
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toHaveAttribute('type', 'submit');

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to focus on the textarea
      await page.keyboard.type('Test action');
      await expect(page.locator('textarea[id="action"]')).toHaveValue('Test action');
    });
  });
});
