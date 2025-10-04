import { test, expect } from '@playwright/test';

test.describe('Character Selection Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test.describe('Mobile-First Design', () => {
    test('should work properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Mock API responses
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
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/premades*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'premade-1',
                worldSlug: 'mystika',
                archetypeKey: 'mage',
                displayName: 'Arcane Scholar',
                summary: 'A wise mage with deep knowledge of ancient magic',
                baseTraits: { race: 'Human', class: 'Mage' },
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Should show three path options in mobile-friendly layout
      await expect(page.locator('text=How would you like to start?')).toBeVisible();
      await expect(page.locator('text=Quick Start')).toBeVisible();
      await expect(page.locator('text=My Characters')).toBeVisible();
      await expect(page.locator('text=Create New')).toBeVisible();

      // Path cards should be stacked vertically on mobile
      const pathCards = page.locator('[data-testid="path-card"]');
      if (await pathCards.count() > 0) {
        const firstCard = pathCards.first();
        const secondCard = pathCards.nth(1);
        
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();
        
        // Cards should be stacked (second card below first)
        expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible with keyboard navigation', async ({ page }) => {
      // Mock API responses
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
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/premades*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'premade-1',
                worldSlug: 'mystika',
                archetypeKey: 'mage',
                displayName: 'Arcane Scholar',
                summary: 'A wise mage with deep knowledge of ancient magic',
                baseTraits: { race: 'Human', class: 'Mage' },
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Should be able to navigate with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to select with Enter
      await page.keyboard.press('Enter');

      // Should navigate to character selection
      await expect(page.locator('text=Choose a Quick Start Character')).toBeVisible();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      // Mock API responses
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
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/premades*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'premade-1',
                worldSlug: 'mystika',
                archetypeKey: 'mage',
                displayName: 'Arcane Scholar',
                summary: 'A wise mage with deep knowledge of ancient magic',
                baseTraits: { race: 'Human', class: 'Mage' },
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Check for proper heading structure
      await expect(page.locator('h1')).toContainText('Start Your Adventure');
      await expect(page.locator('h2')).toContainText('How would you like to start?');

      // Check for proper button roles
      const quickStartButton = page.locator('text=Quick Start').first();
      await expect(quickStartButton).toHaveAttribute('role', 'button');
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state while fetching characters', async ({ page }) => {
      // Mock API responses with delay
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
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Delay the premade characters response
      await page.route('**/api/premades*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [
              {
                id: 'premade-1',
                worldSlug: 'mystika',
                archetypeKey: 'mage',
                displayName: 'Arcane Scholar',
                summary: 'A wise mage with deep knowledge of ancient magic',
                baseTraits: { race: 'Human', class: 'Mage' },
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
              }
            ],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: [],
            meta: { traceId: 'trace-123' }
          })
        });
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Click Quick Start path
      await page.click('text=Quick Start');

      // Should show loading state
      await expect(page.locator('text=Loading characters...')).toBeVisible();
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();

      // Should eventually show characters
      await expect(page.locator('text=Arcane Scholar')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Error Recovery', () => {
    test('should allow retry after error', async ({ page }) => {
      // Mock API responses
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
            meta: { traceId: 'trace-123' }
          })
        });
      });

      await page.route('**/api/characters*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: [
                {
                  id: 'character-1',
                  name: 'My Hero',
                  race: 'Elf',
                  class: 'Ranger',
                  level: 1,
                  experience: 0,
                  attributes: {
                    strength: 10,
                    dexterity: 12,
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
                  updatedAt: '2024-01-01T00:00:00Z'
                }
              ],
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

      // First request fails, second succeeds
      let requestCount = 0;
      await page.route('**/api/games', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error'
              },
              meta: { traceId: 'trace-123' }
            })
          });
        } else {
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
                characterId: 'character-1',
                characterName: 'My Hero',
                worldSlug: 'mystika',
                worldName: 'Mystika',
                turnCount: 0,
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                lastPlayedAt: '2024-01-01T00:00:00Z',
              },
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Select My Characters path
      await page.click('text=My Characters');

      // Select existing character
      await page.click('text=My Hero');

      // Start adventure (should fail)
      await page.click('text=Start with My Hero');

      // Should show error with retry option
      await expect(page.locator('text=Something went wrong on our end. We\'re working to fix it!')).toBeVisible();
      await expect(page.locator('text=Try Again')).toBeVisible();

      // Click retry
      await page.click('text=Try Again');

      // Should eventually succeed
      await expect(page).toHaveURL(/.*play.*game-123/, { timeout: 5000 });
    });
  });
});
