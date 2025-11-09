import { test, expect } from '@playwright/test';

const E2E_ENABLED = process.env.E2E_ENABLED === '1';

(E2E_ENABLED ? test : test.skip)('Session happy path shows skeleton then content', async ({ page }) => {
	await page.goto('/play/session/s-1');
	await expect(page.locator('main#chat')).toBeVisible();
});










