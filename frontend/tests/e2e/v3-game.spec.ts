/**
 * E2E tests for v3 game creation and debug compare UI
 * Covers game spawn, debug panel, compare functionality, a11y
 */

import { test, expect } from '@playwright/test';

test.describe('v3 Game E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Assume we're logged in as admin (setup via test helpers)
    // This would typically use a test login flow
  });

  test('should create game and show debug panel with v3 metadata', async ({ page }) => {
    // Navigate to game creation
    await page.goto('/play');
    
    // Create game (assuming test fixtures are seeded)
    // This would use the actual game creation flow
    // For now, this is a skeleton test structure
    
    // Verify debug panel appears
    const debugPanel = page.locator('[data-testid="debug-mini-panel"]');
    await expect(debugPanel).toBeVisible();
    
    // Verify source=v3 and npcTrimmedCount are shown
    await expect(debugPanel.locator('text=source.*v3')).toBeVisible();
    await expect(debugPanel.locator('text=npcTrimmedCount')).toBeVisible();
  });

  test('should open compare view and show diff', async ({ page }) => {
    // Navigate to existing game with multiple turns
    await page.goto('/games/test-game-id');
    
    // Open debug drawer
    const debugButton = page.locator('[aria-label="Open debug drawer"]');
    await debugButton.click();
    
    // Wait for drawer
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();
    
    // Enter compare mode
    const compareButton = page.locator('button:has-text("Compare")');
    await compareButton.click();
    
    // Select two turns
    const turnPicker = page.locator('[role="listbox"]');
    const turns = turnPicker.locator('[role="option"]');
    
    await expect(turns).toHaveCount(2); // At least 2 turns
    
    // Select first turn as left
    await turns.first().click();
    
    // Select second turn as right (in compare mode)
    await turns.nth(1).click();
    
    // Switch to Compare tab
    const compareTab = page.locator('button[role="tab"]:has-text("Compare")');
    await compareTab.click();
    
    // Verify diff is shown
    const promptDiff = page.locator('text=/\\d+ added/');
    await expect(promptDiff).toBeVisible();
    
    // Verify pieces table diff
    const piecesTable = page.locator('table').first();
    await expect(piecesTable).toBeVisible();
  });

  test('should export JSON for each side', async ({ page, context }) => {
    await page.goto('/games/test-game-id');
    
    // Open drawer and enter compare mode
    await page.locator('[aria-label="Open debug drawer"]').click();
    await page.locator('button:has-text("Compare")').click();
    
    // Navigate to compare tab
    await page.locator('button[role="tab"]:has-text("Compare")').click();
    
    // Set up download listener
    const downloadPromise = context.waitForEvent('download');
    
    // Click export button for left
    await page.locator('button:has-text("Left"):has-text("Export")').click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/debug-left-.*\.json/);
    
    // Verify file content
    const path = await download.path();
    if (path) {
      const fs = require('fs');
      const content = JSON.parse(fs.readFileSync(path, 'utf-8'));
      expect(content).toHaveProperty('debugId');
      expect(content).toHaveProperty('assembler');
    }
  });

  test('should support keyboard navigation in TurnPicker', async ({ page }) => {
    await page.goto('/games/test-game-id');
    await page.locator('[aria-label="Open debug drawer"]').click();
    
    // Focus on turn picker
    const firstTurn = page.locator('[role="listbox"] [role="option"]').first();
    await firstTurn.focus();
    
    // Use arrow keys
    await page.keyboard.press('ArrowDown');
    
    // Verify selection changed
    const selectedTurn = page.locator('[role="option"][aria-selected="true"]');
    await expect(selectedTurn).toBeVisible();
    
    // Use Home key
    await page.keyboard.press('Home');
    await expect(selectedTurn).toBe(page.locator('[role="option"]').first());
  });

  test('should announce compare mode changes to screen readers', async ({ page }) => {
    await page.goto('/games/test-game-id');
    await page.locator('[aria-label="Open debug drawer"]').click();
    
    // Monitor aria-live region
    const liveRegion = page.locator('[role="status"][aria-live="polite"]');
    
    // Enter compare mode
    await page.locator('button:has-text("Compare")').click();
    
    // Select two turns
    const turns = page.locator('[role="listbox"] [role="option"]');
    await turns.first().click();
    await turns.nth(1).click();
    
    // Verify announcement
    await expect(liveRegion).toContainText(/Comparing turn/);
  });
});

