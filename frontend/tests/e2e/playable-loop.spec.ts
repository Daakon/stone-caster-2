/**
 * Phase 8: E2E test for playable loop
 * 
 * Tests the full flow: create game → send turns → paginate → resume
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TEST_TX_ENABLED = process.env.TEST_TX_ENABLED === 'true';

test.describe('Playable Loop E2E', () => {
  let gameId: string;
  let idempotencyKey: string;

  test.beforeAll(async ({ request }) => {
    // Generate idempotency key for game creation
    idempotencyKey = crypto.randomUUID();
  });

  test('Scenario: Full playable loop (create → send turns → paginate → resume)', async ({ page, request }) => {
    // Skip if test transaction not enabled
    test.skip(!TEST_TX_ENABLED, 'TEST_TX_ENABLED must be true for this test');

    // Step 1: Create game (idempotent)
    const createResponse = await request.post(`${API_BASE}/api/games`, {
      data: {
        entry_point_id: 'test-entry-point-playable', // Should exist in seeds
        world_id: '00000000-0000-0000-0000-000000000001', // Test world
        entry_start_slug: 'test-entry-start-playable',
        ruleset_slug: 'default',
      },
      headers: {
        'Idempotency-Key': idempotencyKey,
        'X-Test-Rollback': '1', // Use test transaction
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    expect(createData.ok).toBe(true);
    expect(createData.data.game_id).toBeDefined();
    gameId = createData.data.game_id;

    // Verify first turn exists (narrator turn)
    expect(createData.data.first_turn).toBeDefined();
    expect(createData.data.first_turn.turn_number).toBe(1);
    expect(createData.data.first_turn.role).toBe('narrator');

    // Step 2: Navigate to game page
    await page.goto(`/game/${gameId}`);

    // Wait for turns to load
    await page.waitForSelector('[role="list"]', { timeout: 10000 });

    // Step 3: Send 3-5 turns
    const messages = [
      'I look around to assess my surroundings.',
      'I approach the nearest landmark carefully.',
      'I check my inventory for useful items.',
      'I try to communicate with any nearby creatures.',
      'I decide on my next move based on what I observed.',
    ];

    for (let i = 0; i < 3; i++) {
      const message = messages[i];
      const messageIdempotencyKey = crypto.randomUUID();

      // Find the textarea
      const textarea = page.locator('textarea[id="action"]');
      await expect(textarea).toBeVisible();
      await textarea.fill(message);

      // Submit (Enter key or button)
      await textarea.press('Enter');

      // Wait for response (narrator turn should appear)
      await page.waitForTimeout(2000); // Wait for API call

      // Verify turns are in ascending order
      const turnNumbers = await page.locator('[role="listitem"]').allTextContents();
      const turnNumbersSorted = [...turnNumbers].sort();
      expect(turnNumbers).toEqual(turnNumbersSorted);
    }

    // Step 4: Verify turn numbers are ascending
    const allTurns = await page.locator('[role="listitem"]').count();
    expect(allTurns).toBeGreaterThan(3); // At least player + narrator turns

    // Extract turn numbers from badges
    const turnBadges = await page.locator('text=/Turn \\d+/').allTextContents();
    const turnNumbers = turnBadges.map(text => {
      const match = text.match(/Turn (\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }).filter(n => n > 0);

    // Verify ascending order
    for (let i = 1; i < turnNumbers.length; i++) {
      expect(turnNumbers[i]).toBeGreaterThan(turnNumbers[i - 1]);
    }

    // Step 5: Verify narrator turns exist
    const narratorTurns = await page.locator('text=narrator').count();
    expect(narratorTurns).toBeGreaterThan(0);

    // Step 6: Verify policies never drop protected scopes (core, ruleset, world)
    // Check first narrator turn for meta
    const firstNarratorCard = page.locator('[role="listitem"]').first();
    const policyText = await firstNarratorCard.textContent();
    
    // Should not contain "core dropped" or "ruleset dropped" or "world dropped"
    expect(policyText).not.toContain('core dropped');
    expect(policyText).not.toContain('ruleset dropped');
    expect(policyText).not.toContain('world dropped');

    // Step 7: Test pagination (if there are many turns)
    const loadMoreButton = page.locator('button:has-text("Load More")');
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();
      await page.waitForTimeout(1000);
      
      // Verify more turns loaded
      const turnsAfterLoad = await page.locator('[role="listitem"]').count();
      expect(turnsAfterLoad).toBeGreaterThan(allTurns);
    }

    // Step 8: Test resume (reload page)
    await page.reload();
    await page.waitForSelector('[role="list"]', { timeout: 10000 });

    // Verify turns are still present
    const resumedTurns = await page.locator('[role="listitem"]').count();
    expect(resumedTurns).toBeGreaterThan(0);

    // Verify composer is enabled
    const textarea = page.locator('textarea[id="action"]');
    await expect(textarea).toBeEnabled();
    
    // Send one more turn after resume
    await textarea.fill('I continue my adventure.');
    await textarea.press('Enter');
    await page.waitForTimeout(2000);

    // Verify new turn appears
    const finalTurnCount = await page.locator('[role="listitem"]').count();
    expect(finalTurnCount).toBeGreaterThan(resumedTurns);
  });

  test('Scenario: Rate limiting works', async ({ page, request }) => {
    test.skip(!TEST_TX_ENABLED, 'TEST_TX_ENABLED must be true for this test');
    test.skip(!gameId, 'Game must be created first');

    // Send multiple requests rapidly (should hit rate limit)
    const rapidRequests = Array.from({ length: 10 }).map(() =>
      request.post(`${API_BASE}/api/games/${gameId}/send-turn`, {
        data: { message: 'Rapid test message' },
        headers: {
          'X-Test-Rollback': '1',
        },
      })
    );

    const responses = await Promise.all(rapidRequests);
    const rateLimitedCount = responses.filter(r => r.status() === 429).length;

    // At least some requests should be rate limited
    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});

