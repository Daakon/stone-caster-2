import { test, expect } from '@playwright/test';

test.describe('PlayerV3 Character Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to character creation page
    await page.goto('/adventures/mystika/create-character-v3');
  });

  test('should complete full character creation flow', async ({ page }) => {
    // Step 1: Identity
    await expect(page.getByRole('heading', { name: 'Character Identity' })).toBeVisible();
    
    await page.fill('input[id="name"]', 'Test Character');
    await page.fill('input[id="role"]', 'Scholar');
    await page.selectOption('select[id="race"]', 'Human');
    
    // Select essence
    await page.check('input[id="essence-Life"]');
    await page.check('input[id="essence-Order"]');
    
    await page.fill('input[id="age"]', 'Young');
    await page.fill('input[id="build"]', 'Lean');
    await page.fill('input[id="eyes"]', 'Piercing blue');
    
    await page.click('button:has-text("Next")');
    
    // Step 2: Traits
    await expect(page.getByRole('heading', { name: 'Character Traits' })).toBeVisible();
    
    // Select 2-4 traits
    await page.check('input[id="trait-empathetic"]');
    await page.check('input[id="trait-curious"]');
    await page.check('input[id="trait-tactical"]');
    
    await page.click('button:has-text("Next")');
    
    // Step 3: Skills
    await expect(page.getByRole('heading', { name: 'Skill Allocation' })).toBeVisible();
    
    // Adjust some skills
    await page.click('button[aria-label="Increase Lore"]');
    await page.click('button[aria-label="Increase Lore"]');
    await page.click('button[aria-label="Decrease Combat"]');
    await page.click('button[aria-label="Decrease Combat"]');
    
    await page.click('button:has-text("Next")');
    
    // Step 4: Inventory
    await expect(page.getByRole('heading', { name: 'Starting Equipment' })).toBeVisible();
    
    // Select a kit
    await page.check('input[value="scholar_kit"]');
    
    await page.click('button:has-text("Next")');
    
    // Step 5: Summary
    await expect(page.getByRole('heading', { name: 'Character Summary' })).toBeVisible();
    
    // Verify character data is displayed
    await expect(page.getByText('Test Character')).toBeVisible();
    await expect(page.getByText('Scholar')).toBeVisible();
    await expect(page.getByText('Human')).toBeVisible();
    
    // Create character
    await page.click('button:has-text("Create Character")');
    
    // Should navigate away or show success
    await expect(page).toHaveURL(/characters/);
  });

  test('should validate required fields', async ({ page }) => {
    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")');
    
    // Should show validation errors
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Role is required')).toBeVisible();
  });

  test('should validate skill budget', async ({ page }) => {
    // Fill identity step
    await page.fill('input[id="name"]', 'Test Character');
    await page.fill('input[id="role"]', 'Scholar');
    await page.selectOption('select[id="race"]', 'Human');
    await page.check('input[id="essence-Life"]');
    await page.fill('input[id="age"]', 'Young');
    await page.fill('input[id="build"]', 'Lean');
    await page.fill('input[id="eyes"]', 'Blue');
    await page.click('button:has-text("Next")');
    
    // Fill traits step
    await page.check('input[id="trait-empathetic"]');
    await page.check('input[id="trait-curious"]');
    await page.click('button:has-text("Next")');
    
    // Try to proceed with unbalanced skills
    await page.click('button:has-text("Next")');
    
    // Should show skill budget error
    await expect(page.getByText(/points remaining/)).toBeVisible();
  });

  test('should show eligible kits based on skills', async ({ page }) => {
    // Complete identity and traits steps
    await page.fill('input[id="name"]', 'Test Character');
    await page.fill('input[id="role"]', 'Scholar');
    await page.selectOption('select[id="race"]', 'Human');
    await page.check('input[id="essence-Life"]');
    await page.fill('input[id="age"]', 'Young');
    await page.fill('input[id="build"]', 'Lean');
    await page.fill('input[id="eyes"]', 'Blue');
    await page.click('button:has-text("Next")');
    
    await page.check('input[id="trait-empathetic"]');
    await page.check('input[id="trait-curious"]');
    await page.click('button:has-text("Next")');
    
    // Set skills to unlock specific kits
    // Increase lore to unlock scholar kit
    for (let i = 0; i < 10; i++) {
      await page.click('button[aria-label="Increase Lore"]');
    }
    
    await page.click('button:has-text("Next")');
    
    // Should show scholar kit as eligible
    await expect(page.getByText('Scholar Kit')).toBeVisible();
  });
});


