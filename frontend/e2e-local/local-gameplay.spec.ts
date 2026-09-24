import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * LIVE browser smoke test against the isolated local stack (no route mocking).
 *   Backend :3000 in MOCK (npm run local:dev) or REAL (npm run local:dev:real, OpenRouter/OpenAI) AI mode, Web :5183, Supabase :54421.
 *   Mock: commits the test_combat chip. Real: types a natural-language turn so the real Director + Narrator run.
 *   Run: npm run local:smoke:browser
 *
 * UI login -> load a real game -> commit a turn from the UI -> HARD REFRESH -> state + narration persisted.
 * The game itself is created through the API (same calls as scripts/stonecaster-smoke.mjs) to keep this spec focused on the browser.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env: Record<string, string> = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.stonecaster-local'), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const API = `http://localhost:${env.PORT}`;
const SB = env.SUPABASE_URL;
const WORLD_ID = 'b3de4b0a-a879-43cf-8256-2153a5ff97a9';
const EMAIL = 'player@stonecaster.local';
const PASSWORD = 'stonecaster-dev';

async function json(res: Response) { const t = await res.text(); try { return JSON.parse(t); } catch { return { raw: t }; } }

async function createGameViaApi(): Promise<{ gameId: string; characterId: string }> {
  const auth = await json(await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }));
  const token = auth.access_token as string;
  const call = async (method: string, url: string, body?: unknown) => {
    const r = await json(await fetch(`${API}${url}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined }));
    return r;
  };
  const story = await call('POST', '/api/v2/chimera/stories', { display_name: `Browser smoke ${Date.now()}`, world_id: WORLD_ID, ruleset_template_ids: [], entity_ids: [], genesis_config: {} });
  const storyId = (story.data ?? story).id as string;
  const compiled = await call('POST', `/api/chimera/compile/${storyId}`, {});
  const character = await call('POST', '/api/v2/chimera/player-characters', { name: 'Browser Tester', world_id: WORLD_ID, state_snapshot: { id: 'browser', type: 'PLAYER', properties: { name: 'Browser Tester' } } });
  const characterId = (character.data ?? character).id as string;
  const init = await call('POST', '/api/chimera/game/init', { storyId: compiled.compiledId, characterId, playerInput: { identity: { name: 'Browser Tester' } } });
  const gameId = (init.data ?? init).id as string;
  if (!gameId) throw new Error(`could not create game: ${JSON.stringify({ story, compiled, character, init }).slice(0, 600)}`);
  return { gameId, characterId };
}

async function staminaText(page: Page, isMobile: boolean) {
  const loc = isMobile ? page.getByTestId('mobile-stamina-value') : page.getByTestId('stamina-value');
  await expect(loc).toBeVisible();
  return (await loc.innerText()).trim();
}

test('login, play a turn, hard refresh: state and narration persist', async ({ page, isMobile }) => {
  test.setTimeout(420_000);
  const health = await json(await fetch(`${API}/health`));
  const mock = health.mockAi === true;

  const { gameId } = await createGameViaApi();

  // --- login through the real UI ---
  await page.goto('/auth/signin');
  await page.getByPlaceholder('Enter your email').fill(EMAIL);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).not.toMatch(/^\/auth\/sign(in|up)$/);

  // --- load the game ---
  await page.goto(`/play/${gameId}`);
  const input = page.getByPlaceholder('What do you want to do?');
  await expect(input).toBeVisible({ timeout: 20_000 });
  const before = await staminaText(page, isMobile);

  // --- commit a turn ---
  const turnResponse = page.waitForResponse((r) => r.url().includes(`/api/games/${gameId}/turn`) && r.request().method() === 'POST', { timeout: 300_000 });
  if (mock) {
    // single click drafts, double click commits
    const chip = page.getByTestId('suggestion-chip').filter({ hasText: 'test_combat' });
    await expect(chip).toBeVisible({ timeout: 20_000 });
    await chip.dblclick();
  } else {
    await input.fill('I take a slow look around and listen for anything nearby.');
    await input.press('Enter');
  }
  const resp = await turnResponse;
  const respText = await resp.text().catch(() => '');
  // External blocker (provider credits / free-tier rate limit), not an app defect
  test.skip(!mock && [402, 429, 500].includes(resp.status()) && /insufficient_quota|insufficient credits|requires more credits|rate limit|429/i.test(respText), `BLOCKED: model provider quota/rate limit (HTTP ${resp.status()})`);
  expect(resp.status(), respText).toBe(200);
  await expect(page.getByTestId('turn-pending')).toHaveCount(0, { timeout: 300_000 });
  // the scripted combat turn spends stamina; a real free-form look-around may legitimately not
  if (mock) await expect.poll(() => staminaText(page, isMobile), { timeout: 15_000 }).not.toBe(before);
  const afterTurn = await staminaText(page, isMobile);

  // --- HARD REFRESH ---
  await page.reload();
  await expect(input).toBeVisible({ timeout: 20_000 });
  expect(await staminaText(page, isMobile)).toBe(afterTurn);

  // narration of the committed turn is still on screen after reload
  const rows = await json(await fetch(`${SB}/rest/v1/chimera_turns?game_state_id=eq.${gameId}&turn_index=eq.1&select=narrator_output`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  }));
  const narration: string = rows[0]?.narrator_output?.narration ?? '';
  expect(narration.length).toBeGreaterThan(10);
  // stored narration is markdown (**lead sentence**); the UI renders it, so compare on plain text
  const plain = narration.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  await expect(page.locator('body')).toContainText(plain.slice(0, 40), { timeout: 15_000 });
});
