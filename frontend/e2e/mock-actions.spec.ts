import { test, expect } from '@playwright/test';

test.describe('Mock Actions Verification', () => {
    test.beforeEach(async ({ page }) => {
        // Clear any existing auth state
        await page.context().clearCookies();
        await page.goto('/');
    });

    test('should update vitals visually when test_combat is executed', async ({ page }) => {
        // Mock API responses for guest flow
        await page.route('**/api/games', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: true,
                        data: {
                            id: 'game-mock-1',
                            worldName: 'Mystika',
                            status: 'active',
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        // Mock game fetch - must include the mock actions in available_actions to render the buttons
        await page.route('**/api/games/game-mock-1', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        id: 'game-mock-1',
                        status: 'active',
                        currentScene: {
                            id: 'tavern',
                            title: 'The Tavern',
                            description: 'A cozy tavern.',
                            options: [
                                { id: 'test_combat', text: 'test_combat', type: 'action' },
                                { id: 'test_social', text: 'test_social', type: 'action' },
                            ],
                        },
                        tier1_mechanical: {
                            index: { player_id: 'player-1' },
                            entities: {
                                'player-1': {
                                    id: 'player-1',
                                    type: 'PLAYER',
                                    properties: { 
                                        name: 'Daakon', 
                                        hp: 100, 
                                        maxHp: 100, 
                                        current_stamina: 100, 
                                        stamina: 100 
                                    }
                                }
                            }
                        },
                        history: [],
                    },
                }),
            });
        });

        // Mock the mock action turn resolution
        await page.route('**/api/games/game-mock-1/turn', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        turn: {
                            id: 'turn-mock-1',
                            ai_response: { narrative: 'You attack the target.' },
                            created_at: new Date().toISOString(),
                        },
                        delta: {
                            tier1_mechanical: {
                                entities: {
                                    'player-1': {
                                        properties: {
                                            hp: -20, // Relative drop
                                            current_stamina: -15 // Relative drop
                                        }
                                    }
                                }
                            }
                        },
                        new_logs: [
                            { role: 'system', content: 'Target [Hp: -20]' }
                        ]
                    },
                }),
            });
        });

        // Navigate directly to play screen to bypass auth/adventure setup
        await page.goto('/play/game-mock-1');

        // Verify initial vitals
        await expect(page.locator('text=The Tavern')).toBeVisible();
        
        // Wait for the mock action suggestions to render
        await expect(page.locator('text=test_combat')).toBeVisible();

        // Get the inner text of the Stamina element block to ensure it's at 100
        // We look for the stamina value element in the VitalsPanel
        const staminaDiv = page.locator('div:has(> svg.lucide-zap) + span');
        await expect(staminaDiv).toHaveText('100');

        // Execute the mock combat action
        await page.click('text=test_combat');

        // Assert that the system logs rendered properly
        await expect(page.locator('text=Target [Hp: -20]')).toBeVisible();

        // Check if the delta was applied additively (100 - 15 = 85)
        await expect(staminaDiv).toHaveText('85');
    });
});
