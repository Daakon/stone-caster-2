#!/usr/bin/env node
/**
 * StoneCaster local gameplay smoke test (API level, against the RUNNING local app).
 *
 *   npm run local:smoke          # backend must be running with ENABLE_MOCK_AI=true  (npm run local:dev)
 *   npm run local:smoke:real     # backend must be running with ENABLE_MOCK_AI=false (npm run local:dev:real) — real model calls
 *                                # (OpenRouter/OpenAI per LLM_PROVIDER / *_LLM_PROVIDER; OpenRouter openrouter/free costs nothing)
 *
 * Flow: login -> create story -> compile -> create character -> init game -> load -> turn(s) -> persistence
 *       (DB inspected directly with the local service key) -> reload with a fresh session ("refresh").
 * Each turn must show Director intent -> Engine delta -> Narrator output persisted in chimera_turns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...dotenv.parse(fs.readFileSync(path.join(root, '.env.stonecaster-local'))), ...process.env };
const wantReal = process.argv.includes('--real');
const API = `http://localhost:${env.PORT || 3000}`;
const SB = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_KEY;
const WORLD_ID = 'b3de4b0a-a879-43cf-8256-2153a5ff97a9'; // mystika (seeded)
const RULESET_KEYS = ['cinematic-combat-lite', 'vitality-stamina-system', 'd100-5-pillars', 'world-cycle-time-bands', 'needs-survival-basic', 'npc-personalities', 'npc-relationships']; // story active_ruleset_ids (compile input)

const results = [];
let failed = false;
let blocked = null; // set when the model provider rejects the call for account reasons (not an app bug)
const ok = (name, detail = '') => { results.push(['PASS', name, detail]); console.log(`\x1b[32mPASS\x1b[0m  ${name}${detail ? `\x1b[2m  — ${detail}\x1b[0m` : ''}`); };
const bad = (name, detail = '') => { failed = true; results.push(['FAIL', name, detail]); console.log(`\x1b[31mFAIL\x1b[0m  ${name}${detail ? `  — ${detail}` : ''}`); };
async function step(name, fn) {
  try { const r = await fn(); ok(name, typeof r === 'string' ? r : ''); return r; }
  catch (e) {
    if (String(e.message).startsWith('PROVIDER_QUOTA')) { blocked = e.message; results.push(['BLOCKED', name, e.message]); console.log(`[33mBLOCKED[0m  ${name}  — ${e.message}`); }
    else bad(name, String(e.message).slice(0, 700));
    throw e;
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

async function api(method, p, { token, body, timeout = 120000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${API}${p}`, {
      method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text };
  } finally { clearTimeout(t); }
}
const data = (r) => r.json?.data ?? r.json;
const expectOk = (r, what) => must(r.status >= 200 && r.status < 300 && r.json?.success !== false && r.json?.ok !== false, `${what}: HTTP ${r.status} ${r.text.slice(0, 500)}`);

async function login(email) {
  const res = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'stonecaster-dev' }) });
  const j = await res.json(); must(j.access_token, `login failed: ${JSON.stringify(j).slice(0, 200)}`); return j;
}
const svc = async (table, query) => { const r = await fetch(`${SB}/rest/v1/${table}?${query}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }); return r.json(); };

async function runTurn(token, gameId, input, label) {
  const before = (await svc('chimera_game_states', `id=eq.${gameId}&select=updated_at,mechanical_state`))[0];
  const t0 = Date.now();
  const r = await api('POST', `/api/games/${gameId}/turn`, { token, body: { input } });
  if ((r.status === 429 || r.status === 402 || r.status === 500) && /insufficient_quota|credit_balance|insufficient credits|requires more credits|rate limit|429|402/i.test(r.text)) {
    throw new Error(`PROVIDER_QUOTA: the model provider rejected the call for account/rate reasons (HTTP ${r.status}: ${r.text.slice(0, 240)}). Not an app bug: add credits or retry later, then re-run npm run local:smoke:real`);
  }
  expectOk(r, `${label} turn`);
  const d = data(r);
  must(d?.turn, `${label}: response missing turn`);
  const after = (await svc('chimera_game_states', `id=eq.${gameId}&select=updated_at,mechanical_state`))[0];
  must(after.updated_at !== before.updated_at, `${label}: game state not persisted (updated_at unchanged)`);
  return { d, before, after, ms: Date.now() - t0 };
}

const summary = () => {
  const p = results.filter((r) => r[0] === 'PASS').length; const f = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n${f ? '\x1b[31m' : blocked ? '\x1b[33m' : '\x1b[32m'}${p} passed, ${f} failed${blocked ? ', 1 BLOCKED (model provider quota/rate limit)' : ''}\x1b[0m  (${wantReal ? 'REAL AI' : 'MOCK AI'} mode)`);
  process.exit(failed ? 1 : blocked ? 2 : 0);
};

try {
  await step('backend up and AI mode matches request', async () => {
    const h = await (await fetch(`${API}/health`)).json();
    must(h.mockAi === !wantReal, `backend mockAi=${h.mockAi} but smoke requested ${wantReal ? 'REAL' : 'MOCK'} — restart with npm run local:dev${wantReal ? ':real' : ''}`);
    return `mockAi=${h.mockAi}${h.llm ? ' ' + Object.entries(h.llm).map(([role, c]) => `${role}=${c.provider}${c.provider === 'mock' ? '' : ':' + c.model}`).join(' ') : ''}`;
  });

  let session;
  await step('login (player@stonecaster.local)', async () => { session = await login('player@stonecaster.local'); return `user ${session.user.id}`; });
  const token = session.access_token;

  await step('authenticated /api/me', async () => { const r = await api('GET', '/api/me', { token }); expectOk(r, '/api/me'); return `role=${JSON.stringify(data(r)).slice(0, 120)}`; });

  const rulesets = await svc('chimera_ruleset_templates', `key=in.(${RULESET_KEYS.join(',')})&select=id,key`);
  let storyId;
  await step('create story (user-scoped, RLS)', async () => {
    const r = await api('POST', '/api/v2/chimera/stories', { token, body: { display_name: `Smoke ${new Date().toISOString()}`, world_id: WORLD_ID, ruleset_template_ids: rulesets.map((x) => x.id), entity_ids: [], genesis_config: {} } });
    expectOk(r, 'create story'); storyId = data(r)?.id; must(storyId, 'no story id'); return `story ${storyId}`;
  });

  let compiledId;
  await step('compile story (world + rulesets)', async () => {
    const r = await api('POST', `/api/chimera/compile/${storyId}`, { token, body: {}, timeout: 180000 });
    must(r.status === 200 && r.json?.success !== false, `compile: HTTP ${r.status} ${r.text.slice(0, 500)}`);
    compiledId = r.json?.compiledId ?? data(r)?.compiledId; must(compiledId, `no compiledId in ${r.text.slice(0, 200)}`); return `compiled ${compiledId}`;
  });

  let characterId;
  await step('create player character', async () => {
    const r = await api('POST', '/api/v2/chimera/player-characters', { token, body: { name: 'Smoke Tester', world_id: WORLD_ID, state_snapshot: { id: 'smoke', type: 'PLAYER', properties: { name: 'Smoke Tester', hp: 100, maxHp: 100, current_stamina: 100 } } } });
    expectOk(r, 'create character'); characterId = data(r)?.id; must(characterId, 'no character id'); return `character ${characterId}`;
  });

  let gameId;
  await step('initialize game (game/init)', async () => {
    const r = await api('POST', '/api/chimera/game/init', { token, body: { storyId: compiledId, characterId, playerInput: { identity: { name: 'Smoke Tester' } } } });
    expectOk(r, 'game init'); gameId = data(r)?.id; must(gameId, 'no game id'); return `game ${gameId}`;
  });

  await step('load game (play/:id)', async () => {
    const r = await api('GET', `/api/chimera/play/${gameId}`, { token }); expectOk(r, 'load');
    const d = data(r); must(d.mechanical_state && d.narrative_focus, 'missing state shards'); return `entities=${Object.keys(d.mechanical_state.entities || {}).length}`;
  });

  const turns = wantReal
    ? [['test_combat', 'scripted scenario (deterministic even with real AI)'], ['I greet the stranger warmly and ask what brings them to the square.', 'REAL Director + Narrator']]
    : [['test_combat', 'mock combat'], ['test_social', 'mock social']];
  let firstTurn;
  let doneTurns = 0;
  for (const [input, label] of turns) {
    try { await step(`turn: "${input.slice(0, 40)}" (${label})`, async () => {
      const t = await runTurn(token, gameId, input, label);
      firstTurn ??= t;
      must(Array.isArray(t.d.new_logs) && t.d.new_logs.length > 0, 'no narrator logs returned');
      return `${t.ms}ms, logs=${t.d.new_logs.length}, delta keys=${Object.keys(t.d.delta || {}).join(',') || '(none)'}`;
    }); doneTurns += 1; } catch (e) { if (blocked) break; throw e; }
  }

  await step('persistence: chimera_turns has Director -> Engine -> Narrator per turn', async () => {
    const rows = (await svc('chimera_turns', `game_state_id=eq.${gameId}&select=turn_index,player_input,director_intent,mechanical_delta,narrator_output&order=turn_index`)).filter((r) => r.turn_index > 0); // 0 = seeded "Game Start"
    must(rows.length === doneTurns, `expected ${doneTurns} player turn rows, found ${rows.length}`);
    for (const r of rows) {
      must(r.director_intent && Object.keys(r.director_intent).length, `turn ${r.turn_index}: empty director_intent`);
      must(r.mechanical_delta && typeof r.mechanical_delta === 'object', `turn ${r.turn_index}: no mechanical_delta object`);
      must(r.narrator_output?.narration, `turn ${r.turn_index}: empty narrator_output.narration`);
    }
    return `${rows.length} turn rows: director_intent + mechanical_delta + narrator_output.narration`;
  });

  await step('engine: additive delta equals persisted state change', async () => {
    const [combat] = await svc('chimera_turns', `game_state_id=eq.${gameId}&turn_index=eq.1&select=mechanical_delta`);
    const props = combat?.mechanical_delta?.entities?.[characterId]?.properties;
    must(props && typeof props.current_stamina === 'number', `combat turn produced no stamina delta: ${JSON.stringify(combat?.mechanical_delta)}`);
    const [gs] = await svc('chimera_game_states', `id=eq.${gameId}&select=mechanical_state`);
    const startStamina = firstTurn.before.mechanical_state.entities[characterId].properties.current_stamina ?? 100; // unset before the first turn => engine default (full = 100)
    const nowStamina = gs.mechanical_state.entities[characterId].properties.current_stamina;
    must(nowStamina === startStamina + props.current_stamina, `stamina ${startStamina} + delta ${props.current_stamina} != persisted ${nowStamina}`);
    return `current_stamina ${startStamina} ${props.current_stamina} -> ${nowStamina}`;
  });

  await step('refresh: fresh login + reload shows persisted history', async () => {
    const s2 = await login('player@stonecaster.local');
    const r = await api('GET', `/api/chimera/play/${gameId}`, { token: s2.access_token }); expectOk(r, 'reload');
    const hist = data(r).narrative_focus?.dialogue_history || [];
    must(hist.length >= doneTurns, `dialogue_history has ${hist.length} entries, expected >= ${doneTurns}`);
    return `dialogue_history=${hist.length}`;
  });

  await step('isolation: another user cannot load this game (RLS)', async () => {
    const other = await login('admin@stonecaster.local');
    const r = await api('GET', `/api/chimera/play/${gameId}`, { token: other.access_token });
    must(r.status === 404 || r.status === 403 || data(r)?.id !== gameId, `admin could read player's game: HTTP ${r.status}`);
    return `HTTP ${r.status}`;
  });
} catch { /* already reported */ }
summary();
