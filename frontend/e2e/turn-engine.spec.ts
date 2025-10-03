import { test, expect } from '@playwright/test';

test.describe('Turn Engine - Layer M3', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Guest User Turn Flow', () => {
    test('should allow guest to take turns with starter stones', async ({ page }) => {
      // Create a character as guest
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Test Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      
      // Wait for character creation
      await expect(page.locator('[data-testid="character-card"]')).toBeVisible();
      
      // Start a game
      await page.click('[data-testid="start-game-btn"]');
      await page.waitForSelector('[data-testid="game-board"]');
      
      // Check initial stone balance
      const initialBalance = await page.textContent('[data-testid="casting-stones-balance"]');
      expect(initialBalance).toContain('15'); // Guest starter stones
      
      // Take first turn
      await page.click('[data-testid="choice-option-1"]');
      await page.waitForSelector('[data-testid="turn-result"]');
      
      // Verify turn result
      await expect(page.locator('[data-testid="turn-narrative"]')).toBeVisible();
      await expect(page.locator('[data-testid="turn-choices"]')).toBeVisible();
      
      // Check stone balance decreased
      const newBalance = await page.textContent('[data-testid="casting-stones-balance"]');
      expect(parseInt(newBalance!)).toBeLessThan(15);
      
      // Take second turn
      await page.click('[data-testid="choice-option-1"]');
      await page.waitForSelector('[data-testid="turn-result"]');
      
      // Verify turn count increased
      const turnCount = await page.textContent('[data-testid="turn-count"]');
      expect(turnCount).toContain('2');
    });

    test('should handle insufficient stones error', async ({ page }) => {
      // Create character and start game
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Poor Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      await page.click('[data-testid="start-game-btn"]');
      
      // Mock insufficient stones scenario
      await page.route('**/api/games/*/turn', async route => {
        await route.fulfill({
          status: 402,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'INSUFFICIENT_STONES',
              message: 'Insufficient casting stones. Have 0, need 2'
            },
            meta: {
              traceId: 'test-trace-id'
            }
          })
        });
      });
      
      // Try to take turn
      await page.click('[data-testid="choice-option-1"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient casting stones');
    });
  });

  test.describe('Authenticated User Turn Flow', () => {
    test('should allow authenticated user to take turns', async ({ page }) => {
      // Sign in
      await page.click('[data-testid="sign-in-btn"]');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.click('[data-testid="magic-link-btn"]');
      
      // Wait for authentication
      await page.waitForSelector('[data-testid="user-menu"]');
      
      // Create character
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Auth Hero');
      await page.selectOption('[data-testid="character-race"]', 'elf');
      await page.selectOption('[data-testid="character-class"]', 'mage');
      await page.click('[data-testid="create-character-submit"]');
      
      // Start game
      await page.click('[data-testid="start-game-btn"]');
      await page.waitForSelector('[data-testid="game-board"]');
      
      // Take multiple turns
      for (let i = 1; i <= 3; i++) {
        await page.click('[data-testid="choice-option-1"]');
        await page.waitForSelector('[data-testid="turn-result"]');
        
        // Verify turn count
        const turnCount = await page.textContent('[data-testid="turn-count"]');
        expect(turnCount).toContain(i.toString());
      }
    });
  });

  test.describe('Idempotency', () => {
    test('should handle duplicate turn requests gracefully', async ({ page }) => {
      // Create character and start game
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Idempotent Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      await page.click('[data-testid="start-game-btn"]');
      
      // Mock duplicate request scenario
      let requestCount = 0;
      await page.route('**/api/games/*/turn', async route => {
        requestCount++;
        if (requestCount === 1) {
          // First request succeeds
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'turn-123',
                gameId: 'game-123',
                turnCount: 1,
                narrative: 'You take the first path...',
                emotion: 'neutral',
                choices: [
                  { id: 'choice-1', label: 'Continue', description: 'Keep going' }
                ],
                castingStonesBalance: 13,
                createdAt: '2024-01-01T00:00:00Z'
              },
              meta: {
                traceId: 'test-trace-id'
              }
            })
          });
        } else {
          // Subsequent requests return same response (idempotency)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'turn-123',
                gameId: 'game-123',
                turnCount: 1,
                narrative: 'You take the first path...',
                emotion: 'neutral',
                choices: [
                  { id: 'choice-1', label: 'Continue', description: 'Keep going' }
                ],
                castingStonesBalance: 13,
                createdAt: '2024-01-01T00:00:00Z'
              },
              meta: {
                traceId: 'test-trace-id'
              }
            })
          });
        }
      });
      
      // Click choice multiple times rapidly
      await page.click('[data-testid="choice-option-1"]');
      await page.click('[data-testid="choice-option-1"]');
      await page.click('[data-testid="choice-option-1"]');
      
      // Wait for result
      await page.waitForSelector('[data-testid="turn-result"]');
      
      // Verify only one turn was processed
      const turnCount = await page.textContent('[data-testid="turn-count"]');
      expect(turnCount).toContain('1');
      
      // Verify stone balance only decreased once
      const balance = await page.textContent('[data-testid="casting-stones-balance"]');
      expect(balance).toContain('13'); // 15 - 2 = 13
    });
  });

  test.describe('Error Handling', () => {
    test('should handle AI timeout gracefully', async ({ page }) => {
      // Create character and start game
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Timeout Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      await page.click('[data-testid="start-game-btn"]');
      
      // Mock AI timeout
      await page.route('**/api/games/*/turn', async route => {
        await route.fulfill({
          status: 504,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'UPSTREAM_TIMEOUT',
              message: 'AI service timeout'
            },
            meta: {
              traceId: 'test-trace-id'
            }
          })
        });
      });
      
      // Try to take turn
      await page.click('[data-testid="choice-option-1"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('AI service timeout');
    });

    test('should handle AI validation error gracefully', async ({ page }) => {
      // Create character and start game
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'Validation Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      await page.click('[data-testid="start-game-btn"]');
      
      // Mock AI validation error
      await page.route('**/api/games/*/turn', async route => {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'AI response validation failed'
            },
            meta: {
              traceId: 'test-trace-id'
            }
          })
        });
      });
      
      // Try to take turn
      await page.click('[data-testid="choice-option-1"]');
      
      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('AI response validation failed');
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible for turn interactions', async ({ page }) => {
      // Create character and start game
      await page.click('[data-testid="create-character-btn"]');
      await page.fill('[data-testid="character-name"]', 'A11y Hero');
      await page.selectOption('[data-testid="character-race"]', 'human');
      await page.selectOption('[data-testid="character-class"]', 'warrior');
      await page.click('[data-testid="create-character-submit"]');
      await page.click('[data-testid="start-game-btn"]');
      
      // Check accessibility of choice buttons
      const choiceButtons = page.locator('[data-testid^="choice-option-"]');
      const count = await choiceButtons.count();
      
      for (let i = 0; i < count; i++) {
        const button = choiceButtons.nth(i);
        await expect(button).toHaveAttribute('aria-label');
        await expect(button).toHaveAttribute('role', 'button');
      }
      
      // Check accessibility of turn result
      await page.click('[data-testid="choice-option-1"]');
      await page.waitForSelector('[data-testid="turn-result"]');
      
      await expect(page.locator('[data-testid="turn-narrative"]')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('[data-testid="turn-choices"]')).toHaveAttribute('role', 'list');
    });
  });
});
