import { test, expect, type Page } from '@playwright/test';

/**
 * Mock Actions — live-contract e2e for the play screen.
 *
 * Contract under test (the real wiring of /play/:gameStateId):
 *   - Load:   GET  /api/chimera/play/:id  → { ok, data: GameState }
 *   - Submit: POST /api/games/:id/turn    → { ok, data: { turn, delta, new_logs } }
 *   - Deltas are ADDITIVE (current_stamina: -15 → 100 becomes 85)
 *   - Chips: single-click drafts into the input, double-click commits (Draft & Commit spec)
 */

const GAME_ID = 'a0000000-0000-4000-8000-000000000001';
const PLAYER_ID = 'b0000000-0000-4000-8000-000000000002';
const GUARD_ID = 'c0000000-0000-4000-8000-000000000003';

const gameStateFixture = () => ({
    id: GAME_ID,
    story_id: 'd0000000-0000-4000-8000-000000000004',
    player_id: PLAYER_ID,
    mechanical_state: {
        index: { player_id: PLAYER_ID },
        entities: {
            [PLAYER_ID]: {
                id: PLAYER_ID,
                type: 'PLAYER',
                properties: { name: 'Daakon', hp: 100, maxHp: 100, current_stamina: 100, satiety: 100 }
            },
            [GUARD_ID]: {
                id: GUARD_ID,
                type: 'NPC',
                properties: { name: 'Garret', hp: 50, maxHp: 50 }
            }
        }
    },
    narrative_focus: {
        dialogue_history: [
            { id: 'h1', role: 'narrator', content: 'The tavern hums with quiet conversation.', timestamp: new Date().toISOString() }
        ],
        scene_context: { location: 'The Tavern', time: 'Night', atmosphere: 'Cozy' }
    },
    scene_registry: { active_scene_id: 'tavern', entity_locations: {}, node_states: {} },
    action_queue: ['test_combat', 'test_social'],
    compiled_system_prompt: '',
    updated_at: new Date().toISOString()
});

const turnSuccessBody = () => ({
    ok: true,
    data: {
        turn: { id: 'turn-1', turn_index: 1 },
        delta: {
            entities: {
                [PLAYER_ID]: { properties: { current_stamina: -15 } },
                [GUARD_ID]: { properties: { hp: -20 } }
            },
            action_queue: ['test_social', 'test_travel']
        },
        new_logs: [
            { id: 'l1', role: 'player', content: 'test_combat', timestamp: new Date().toISOString() },
            { id: 'l2', role: 'system', content: 'Garret [Hp: -20] | Daakon [Stamina: -15]', timestamp: new Date().toISOString() },
            { id: 'l3', role: 'narrator', content: 'You lash out and the guard staggers back.', timestamp: new Date().toISOString() }
        ]
    }
});

async function mockLoadState(page: Page) {
    // The app blocks all routes on the session check (App.tsx AppContent)
    await page.route('**/api/me', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                data: { user: null, kind: 'guest', config: { enableChimeraUi: true } }
            })
        });
    });

    // EarlyAccessRoute redirects to '/' unless the access request is approved
    // (the auth service emits a truthy guest user, so the check always runs)
    await page.route('**/api/request-access/status', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                data: {
                    request: {
                        id: 'req-1', email: 'player@example.com', user_id: null, note: null,
                        status: 'approved', reason: null, approved_by: null, approved_at: null,
                        denied_by: null, denied_at: null, meta: {},
                        created_at: '2026-01-01', updated_at: '2026-01-01'
                    }
                }
            })
        });
    });

    await page.route(`**/api/chimera/play/${GAME_ID}`, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true, data: gameStateFixture() })
        });
    });
}

/** Stamina readout differs by form factor: sidebar panel vs mobile strip */
function staminaLocator(page: Page, isMobile: boolean) {
    return isMobile
        ? page.getByTestId('mobile-stamina-value')
        : page.getByTestId('stamina-value');
}

test.describe('Mock Actions Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.context().clearCookies();
        await mockLoadState(page);
    });

    test('double-click chip commits a turn: pending indicator, system log, additive vitals', async ({ page, isMobile }) => {
        await page.route(`**/api/games/${GAME_ID}/turn`, async (route) => {
            // Delay so the pending indicator is observable
            await new Promise((r) => setTimeout(r, 500));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(turnSuccessBody())
            });
        });

        await page.goto(`/play/${GAME_ID}`);

        // Location renders in the header on md+ only
        if (!isMobile) {
            await expect(page.locator('text=The Tavern').first()).toBeVisible();
        }

        const chip = page.getByTestId('suggestion-chip').filter({ hasText: 'test_combat' });
        await expect(chip).toBeVisible();

        const stamina = staminaLocator(page, isMobile);
        await expect(stamina).toHaveText('100');

        await chip.dblclick();

        // In-feed pending indicator while the server thinks
        await expect(page.getByTestId('turn-pending')).toBeVisible();

        // Turn resolves: system log + narrator prose render
        await expect(page.locator('text=Garret [Hp: -20]')).toBeVisible();
        await expect(page.locator('text=You lash out and the guard staggers back.')).toBeVisible();
        await expect(page.getByTestId('turn-pending')).toHaveCount(0);

        // Delta applied additively: 100 - 15 = 85
        await expect(stamina).toHaveText('85');

        // Chips refresh from delta.action_queue
        await expect(page.getByTestId('suggestion-chip').filter({ hasText: 'test_travel' })).toBeVisible();
    });

    test('single-click drafts into the input, Enter commits', async ({ page }) => {
        await page.route(`**/api/games/${GAME_ID}/turn`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(turnSuccessBody())
            });
        });

        await page.goto(`/play/${GAME_ID}`);

        const chip = page.getByTestId('suggestion-chip').filter({ hasText: 'test_combat' });
        await chip.click();

        // Draft & Commit: single click only populates the input (editable)
        const input = page.locator('textarea');
        await expect(input).toHaveValue('test_combat');

        await input.press('Enter');

        await expect(page.locator('text=You lash out and the guard staggers back.')).toBeVisible();
    });

    test('failed turn shows an error toast with Retry and preserves the draft', async ({ page }) => {
        let attempt = 0;
        await page.route(`**/api/games/${GAME_ID}/turn`, async (route) => {
            attempt += 1;
            if (attempt === 1) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        ok: false,
                        error: { code: 'INTERNAL_ERROR', message: 'Failed to process turn. Please try again.' }
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(turnSuccessBody())
                });
            }
        });

        await page.goto(`/play/${GAME_ID}`);

        const input = page.locator('textarea');
        await input.fill('attack the guard');
        await input.press('Enter');

        // Error surfaces as a toast with a Retry action
        await expect(page.locator('text=Failed to process turn. Please try again.')).toBeVisible();

        // Draft preserved so the player doesn't retype
        await expect(input).toHaveValue('attack the guard');

        // Retry succeeds
        await page.getByRole('button', { name: 'Retry' }).click();
        await expect(page.locator('text=You lash out and the guard staggers back.')).toBeVisible();
    });

    test('mobile vitals bar is visible and updates with the turn', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Mobile-only: the vitals strip replaces the hidden sidebars');

        await page.route(`**/api/games/${GAME_ID}/turn`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(turnSuccessBody())
            });
        });

        await page.goto(`/play/${GAME_ID}`);

        await expect(page.getByTestId('mobile-vitals')).toBeVisible();
        await expect(page.getByTestId('mobile-stamina-value')).toHaveText('100');

        const chip = page.getByTestId('suggestion-chip').filter({ hasText: 'test_combat' });
        await chip.dblclick();

        await expect(page.getByTestId('mobile-stamina-value')).toHaveText('85');
    });
});
