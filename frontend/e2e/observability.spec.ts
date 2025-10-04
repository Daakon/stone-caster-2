import { test, expect } from '@playwright/test';

test.describe('Layer M5: Observability & Telemetry', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display traceId in error banners', async ({ page }) => {
    // Mock an API error response with traceId
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INSUFFICIENT_STONES',
            message: 'Not enough stones to complete this action',
          },
          meta: {
            traceId: '123e4567-e89b-12d3-a456-426614174000',
          },
        }),
      });
    });

    // Navigate to a game page (assuming we have a game)
    await page.goto('/game/test-game-id');

    // Try to submit a turn that will fail
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Check that error banner appears with traceId
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    await expect(page.locator('text=Trace ID:')).toBeVisible();
    await expect(page.locator('text=123e4567-e89b-12d3-a456-426614174000')).toBeVisible();
  });

  test('should allow copying traceId from error banner', async ({ page }) => {
    // Mock an API error response with traceId
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
          meta: {
            traceId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Try to submit a turn that will fail
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Check that error banner appears
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();

    // Click the copy button
    await page.click('[data-testid="copy-trace-id"]');

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe('987fcdeb-51a2-43d7-8f9e-123456789abc');
  });

  test('should show actionable error messages with proper CTAs', async ({ page }) => {
    // Mock insufficient stones error
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INSUFFICIENT_STONES',
            message: 'Not enough stones to complete this action',
          },
          meta: {
            traceId: '123e4567-e89b-12d3-a456-426614174000',
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Try to submit a turn
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Check that error banner shows actionable message
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    await expect(page.locator('text=Go to Wallet')).toBeVisible();
    await expect(page.locator('text=Try Again')).toBeVisible();
  });

  test('should handle telemetry configuration endpoint', async ({ page }) => {
    // Mock telemetry config response
    await page.route('**/api/telemetry/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            enabled: true,
            sampleRate: 1.0,
            features: {
              telemetry_enabled: true,
            },
            environment: 'test',
          },
        }),
      });
    });

    // Navigate to telemetry config endpoint
    const response = await page.request.get('/api/telemetry/config');
    const data = await response.json();

    expect(response.status()).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.enabled).toBe(true);
    expect(data.data.sampleRate).toBe(1.0);
  });

  test('should record telemetry events during gameplay', async ({ page }) => {
    // Track telemetry requests
    const telemetryRequests: any[] = [];
    
    await page.route('**/api/telemetry/gameplay', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      telemetryRequests.push(postData);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          eventId: 'event-123',
        }),
      });
    });

    // Mock successful game operations
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'turn-123',
            narrative: 'Test narrative',
            choices: [],
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Wait for game to load and record game_loaded event
    await page.waitForSelector('[data-testid="game-loaded"]');
    
    // Submit a turn to trigger telemetry events
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Wait for turn to complete
    await page.waitForSelector('[data-testid="turn-completed"]');

    // Check that telemetry events were recorded
    expect(telemetryRequests.length).toBeGreaterThan(0);
    
    // Verify specific events were recorded
    const eventNames = telemetryRequests.map(req => req.name);
    expect(eventNames).toContain('game_loaded');
    expect(eventNames).toContain('turn_started');
    expect(eventNames).toContain('turn_completed');
  });

  test('should handle telemetry failures gracefully', async ({ page }) => {
    // Mock telemetry endpoint to fail
    await page.route('**/api/telemetry/gameplay', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Telemetry service unavailable',
          },
        }),
      });
    });

    // Mock successful game operations
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'turn-123',
            narrative: 'Test narrative',
            choices: [],
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Submit a turn - should still work despite telemetry failure
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Verify turn still completes successfully
    await expect(page.locator('[data-testid="turn-completed"]')).toBeVisible();
  });

  test('should be accessible on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Mock an error response
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INSUFFICIENT_STONES',
            message: 'Not enough stones to complete this action',
          },
          meta: {
            traceId: '123e4567-e89b-12d3-a456-426614174000',
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Try to submit a turn
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Check that error banner is visible and accessible on mobile
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    
    // Check that buttons are touch-friendly (44px minimum)
    const buttons = page.locator('[data-testid="error-banner"] button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('should maintain accessibility compliance', async ({ page }) => {
    // Mock an error response
    await page.route('**/api/games/*/turn', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
          meta: {
            traceId: '123e4567-e89b-12d3-a456-426614174000',
          },
        }),
      });
    });

    // Navigate to a game page
    await page.goto('/game/test-game-id');

    // Trigger error
    await page.fill('[data-testid="turn-input"]', 'Test action');
    await page.click('[data-testid="submit-turn"]');

    // Wait for error banner
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();

    // Run accessibility audit
    const accessibilityScanResults = await page.accessibility.snapshot();
    
    // Check that error banner has proper role
    const errorBanner = accessibilityScanResults.children?.find(
      child => child.role === 'alert'
    );
    expect(errorBanner).toBeDefined();

    // Check that buttons have proper labels
    const buttons = accessibilityScanResults.children?.filter(
      child => child.role === 'button'
    );
    expect(buttons?.length).toBeGreaterThan(0);
    
    buttons?.forEach(button => {
      expect(button.name).toBeTruthy();
    });
  });
});
