import { test, expect } from '@playwright/test';

test.describe('Start Adventure Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test.describe('Three Path Selection', () => {
    test('should show three clear paths for starting an adventure', async ({ page }) => {
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

      // Should show three path options
      await expect(page.locator('text=How would you like to start?')).toBeVisible();
      await expect(page.locator('text=Quick Start')).toBeVisible();
      await expect(page.locator('text=My Characters')).toBeVisible();
      await expect(page.locator('text=Create New')).toBeVisible();
    });

    test('should navigate to premade character selection', async ({ page }) => {
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

      // Click Quick Start path
      await page.click('text=Quick Start');

      // Should show premade character selection
      await expect(page.locator('text=Choose a Quick Start Character')).toBeVisible();
      await expect(page.locator('text=Arcane Scholar')).toBeVisible();
    });

    test('should navigate to existing character selection', async ({ page }) => {
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
      });

      // Navigate to adventure detail
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Click My Characters path
      await page.click('text=My Characters');

      // Should show existing character selection
      await expect(page.locator('text=Choose Your Character')).toBeVisible();
      await expect(page.locator('text=My Hero')).toBeVisible();
    });

    test('should navigate to create new character', async ({ page }) => {
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

      // Click Create New path
      await page.click('text=Create New');

      // Should show create new character option
      await expect(page.locator('text=Create New Character')).toBeVisible();
      await expect(page.locator('text=Start Creating')).toBeVisible();
    });
  });

  test.describe('Premade Character Flow', () => {
    test('should start adventure with premade character', async ({ page }) => {
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

      await page.route('**/api/characters', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'character-123',
                name: 'Arcane Scholar',
                race: 'Human',
                class: 'Mage',
                level: 1,
                experience: 0,
                attributes: {
                  strength: 10,
                  dexterity: 10,
                  constitution: 10,
                  intelligence: 12,
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
              },
              meta: { traceId: 'trace-123' }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: [],
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

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
                characterName: 'Arcane Scholar',
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

      // Select Quick Start path
      await page.click('text=Quick Start');

      // Select premade character
      await page.click('text=Arcane Scholar');

      // Start adventure
      await page.click('text=Start with Arcane Scholar');

      // Should navigate to game
      await expect(page).toHaveURL(/.*play.*game-123/);
    });
  });

  test.describe('Existing Character Flow', () => {
    test('should start adventure with existing character', async ({ page }) => {
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

      // Start adventure
      await page.click('text=Start with My Hero');

      // Should navigate to game
      await expect(page).toHaveURL(/.*play.*game-123/);
    });
  });

  test.describe('Resume Behavior', () => {
    test('should show resume option when character is already active', async ({ page }) => {
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
                  activeGameId: 'existing-game-123',
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z'
                }
              ],
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

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
              existingGameId: 'existing-game-123',
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

      // Start adventure
      await page.click('text=Start with My Hero');

      // Should show error banner with resume option
      await expect(page.locator('text=This character is already in an active adventure. Would you like to resume that game instead?')).toBeVisible();
      await expect(page.locator('text=Resume Game')).toBeVisible();
    });

    test('should resume existing game when resume button is clicked', async ({ page }) => {
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
                  activeGameId: 'existing-game-123',
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z'
                }
              ],
              meta: { traceId: 'trace-123' }
            })
          });
        }
      });

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
              existingGameId: 'existing-game-123',
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

      // Start adventure
      await page.click('text=Start with My Hero');

      // Click resume button
      await page.click('text=Resume Game');

      // Should navigate to existing game
      await expect(page).toHaveURL(/.*play.*existing-game-123/);
    });
  });

  test.describe('Error Handling', () => {
    test('should show friendly error messages', async ({ page }) => {
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

      // Start adventure
      await page.click('text=Start with My Hero');

      // Should show friendly error message
      await expect(page.locator('text=That adventure or character wasn\'t found. Please try selecting from the list above.')).toBeVisible();
    });
  });

  test.describe('Guest vs Authenticated Parity', () => {
    test('should work the same for guest and authenticated users', async ({ page }) => {
      // Mock API responses for guest user
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

      // Navigate to adventure detail as guest
      await page.click('text=Adventures');
      await page.click('text=The Mystika Tutorial');
      await page.click('text=Start Adventure');

      // Should show same three path options
      await expect(page.locator('text=How would you like to start?')).toBeVisible();
      await expect(page.locator('text=Quick Start')).toBeVisible();
      await expect(page.locator('text=My Characters')).toBeVisible();
      await expect(page.locator('text=Create New')).toBeVisible();
    });
  });
});
