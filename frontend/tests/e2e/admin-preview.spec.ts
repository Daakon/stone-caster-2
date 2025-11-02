/**
 * E2E tests for Admin Entry Point Preview
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Entry Point Preview', () => {
  test.beforeEach(async ({ page }) => {
    // Assume admin login is handled via fixtures or auth setup
    // Navigate to preview page for a test entry point
    await page.goto('/admin/entry-points/test-entry-point-id/preview');
  });

  test('should load preview page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Entry Point Preview');
  });

  test('happy path: default → adjust budget → NPC trims', async ({ page }) => {
    // Wait for initial load
    await expect(page.locator('[data-testid="meta-bar"]')).toBeVisible();

    // Get initial NPC count
    const initialNpcAfter = await page.locator('[data-testid="npc-after"]').textContent();

    // Adjust budget slider to a lower value
    const budgetSlider = page.locator('#budget-slider');
    await budgetSlider.fill('4000'); // 50% of default

    // Wait for debounced update
    await page.waitForTimeout(500);

    // Verify NPC count decreased
    const newNpcAfter = await page.locator('[data-testid="npc-after"]').textContent();
    expect(Number(newNpcAfter)).toBeLessThan(Number(initialNpcAfter));

    // Verify token usage updated
    const tokenPct = await page.locator('[data-testid="token-pct"]').textContent();
    expect(tokenPct).toMatch(/\d+%/);
  });

  test('should toggle includeNPCs', async ({ page }) => {
    // Enable QA to see NPC count
    const qaToggle = page.locator('#qa-toggle');
    await qaToggle.click();

    // Get initial NPC count
    const initialNpcCount = await page.locator('[data-testid="pieces-table"]')
      .locator('text=/NPC/').count();

    // Toggle includeNPCs off
    const includeNpcsToggle = page.locator('#include-npcs');
    await includeNpcsToggle.click();

    // Wait for update
    await page.waitForTimeout(500);

    // Verify NPC count is 0
    const npcAfter = await page.locator('[data-testid="npc-after"]').textContent();
    expect(npcAfter).toBe('0');

    // Verify no NPC pieces in table
    const npcRows = await page.locator('[data-testid="pieces-table"]')
      .locator('text=npc').count();
    expect(npcRows).toBe(0);
  });

  test('should export JSON', async ({ page }) => {
    // Click export button
    const exportButton = page.locator('button:has-text("Export JSON")');
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/entry-point-preview.*\.json$/);

    // Verify JSON is valid
    const path = await download.path();
    const fs = await import('fs');
    const content = fs.readFileSync(path, 'utf-8');
    const json = JSON.parse(content);
    expect(json.preview).toBeDefined();
    expect(json.preview.prompt).toBeDefined();
    expect(json.preview.pieces).toBeInstanceOf(Array);
  });

  test('should announce state changes via aria-live', async ({ page }) => {
    // Monitor aria-live region
    const liveRegion = page.locator('[role="status"]');

    // Adjust budget to trigger trim
    const budgetSlider = page.locator('#budget-slider');
    await budgetSlider.fill('4000');
    await page.waitForTimeout(500);

    // Verify announcement (format: "NPCs trimmed from X to Y")
    const announcement = await liveRegion.textContent();
    expect(announcement).toMatch(/NPCs trimmed from \d+ to \d+/);
  });

  test('should display QA report when enabled', async ({ page }) => {
    // Enable QA toggle
    const qaToggle = page.locator('#qa-toggle');
    await qaToggle.click();

    // Wait for QA section to appear
    await expect(page.locator('text=QA Report')).toBeVisible();

    // Verify filterable chips
    await expect(page.locator('button:has-text("All Severities")')).toBeVisible();
    await expect(page.locator('button:has-text("error")')).toBeVisible();
    await expect(page.locator('button:has-text("warn")')).toBeVisible();
  });

  test('should copy prompt', async ({ page }) => {
    // Click copy button
    const copyButton = page.locator('button:has-text("Copy")');
    
    // Mock clipboard
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    await copyButton.click();

    // Verify toast notification
    await expect(page.locator('text=Prompt copied to clipboard')).toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through controls
    await page.keyboard.press('Tab');
    await expect(page.locator('#budget-slider')).toBeFocused();

    // Continue tabbing
    await page.keyboard.press('Tab');
    await expect(page.locator('#warn-pct')).toBeFocused();

    // Verify all interactive elements receive focus
    const focusableElements = [
      '#budget-slider',
      '#warn-pct',
      '#npc-limit',
      '#include-npcs',
      '#qa-toggle',
    ];

    for (const selector of focusableElements) {
      await page.keyboard.press('Tab');
      await expect(page.locator(selector)).toBeFocused();
    }
  });
});

