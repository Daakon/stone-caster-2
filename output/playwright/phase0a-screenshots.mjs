import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const gameState = {
  id: 'phase0a-visual-check',
  mechanical_state: {
    index: { player_id: 'player-1' },
    entities: {
      'player-1': { id: 'player-1', type: 'PLAYER', properties: { name: 'Traveler', current_stamina: 74, satiety: 62, physical_condition: 'Rested' } },
      'npc-1': { id: 'npc-1', type: 'NPC', properties: { name: 'Innkeeper' } },
    },
  },
  narrative_focus: {
    scene_context: { name: 'A Quiet Road', location: 'The Wayhouse', time: 'Evening', atmosphere: 'Rain at the windows' },
    description: 'The rain settles over the wayhouse. You step inside, where a lantern lights the room and the innkeeper looks up from the counter.',
    dialogue_history: [
      { role: 'narrator', text: 'The rain settles over the wayhouse. You step inside, where a lantern lights the room and the innkeeper looks up from the counter.' },
      { role: 'player', text: 'I ask for a place to rest.' },
      { role: 'narrator', text: 'The innkeeper nods toward the hearth. “There is a chair by the fire, if you would like to warm yourself first.”' },
    ],
  },
  scene_registry: { active_scene_id: 'wayhouse', entity_locations: { 'player-1': 'wayhouse', 'npc-1': 'wayhouse' } },
};

for (const width of process.argv[3] ? [Number(process.argv[3])] : [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (process.argv[2] === 'light') {
    await page.addInitScript(() => localStorage.setItem('stonecaster-ui-theme', 'light'));
  }
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('CONSOLE ERROR:', message.text()); });
  await page.route(url => new URL(url).pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/me'
      ? { user: { id: 'visual-reviewer', email: 'reviewer@example.test', role: 'admin', roleVersion: 1 }, kind: 'user', config: { enableChimeraUi: true } }
      : path === '/api/chimera/play/phase0a-visual-check'
        ? gameState
        : path.includes('access-requests')
          ? { request: null }
          : { balance: 100, transactions: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  await page.goto('http://localhost:5173/play/phase0a-visual-check', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const phase = process.argv[2] || 'before';
  const path = `output/playwright/phase0a-${phase}-${width}.png`;
  await page.screenshot({ path });
  console.log(`${width}: ${page.url()} | ${await page.title()} | ${await page.locator('body').innerText().then(x => x.slice(0, 180))} | ${path}`);
  await context.close();
}
await browser.close();
