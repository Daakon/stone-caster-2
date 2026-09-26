#!/usr/bin/env node
/**
 * Interleaved local Jev latency run.
 *
 * Starts one backend process per mode against the same isolated local Supabase
 * stack, then rotates request order each turn so OpenRouter variance is not
 * grouped into three separate batches. This measures timing only; it does not
 * claim that independently sampled GPT runs are causal state controls.
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env.stonecaster-local')));
const readEnv = (file) => fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const env = { ...readEnv(path.join(root, '.env')), ...readEnv(path.join(root, 'backend', '.env')), ...process.env, ...localEnv };
const scenarioPath = process.argv.find((arg) => arg.endsWith('.json')) || path.join(root, 'scripts/playtest-scenarios/jev-paired-core.json');
const outputAt = process.argv.indexOf('--output');
const outputPath = outputAt >= 0 ? process.argv[outputAt + 1] : null;
const scenario = JSON.parse(fs.readFileSync(path.resolve(scenarioPath), 'utf8'));
const apiKey = env.SUPABASE_ANON_KEY;
const supabaseUrl = env.SUPABASE_URL;
const worldId = 'b3de4b0a-a879-43cf-8256-2153a5ff97a9';
const caelId = '4c5bb787-53ce-487d-b574-c7a6c66070e7';
const kieraId = '789dbece-3bc9-4080-82ce-31b47139fbb5';
const rulesets = ['cinematic-combat-lite', 'vitality-stamina-system', 'd100-5-pillars', 'world-cycle-time-bands', 'needs-survival-basic', 'npc-personalities', 'npc-relationships'];
const modes = [
  { name: 'gpt-only', port: 3100, flags: { JEV_SHADOW_MODE: 'false', JEV_CANARY_ACTION_CLASSIFICATION: 'false', JEV_CANARY_FEASIBILITY: 'false', JEV_CANARY_COMPARE: 'false', JEV_CANARY_SKIP_GPT: 'false' } },
  { name: 'jev-compare', port: 3101, flags: { JEV_SHADOW_MODE: 'false', JEV_CANARY_ACTION_CLASSIFICATION: 'true', JEV_CANARY_FEASIBILITY: 'true', JEV_CANARY_CONFIDENCE_THRESHOLD: '0.80', JEV_CANARY_COMPARE: 'true', JEV_CANARY_SKIP_GPT: 'false' } },
  { name: 'jev-skip-gpt', port: 3102, flags: { JEV_SHADOW_MODE: 'false', JEV_CANARY_ACTION_CLASSIFICATION: 'true', JEV_CANARY_FEASIBILITY: 'true', JEV_CANARY_CONFIDENCE_THRESHOLD: '0.80', JEV_CANARY_COMPARE: 'false', JEV_CANARY_SKIP_GPT: 'true' } },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => performance.now();
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const quantile = (values, q) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
};
const timing = (timeline, start, end) => {
  const a = timeline?.[start]?.elapsed_ms;
  const b = timeline?.[end]?.elapsed_ms;
  return typeof a === 'number' && typeof b === 'number' ? b - a : null;
};

async function api(base, method, route, { token, body, timeout = 300000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { /* preserve text */ }
    return { status: response.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

const data = (response) => response.json?.data ?? response.json;

async function login() {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'player@stonecaster.local', password: 'stonecaster-dev' }),
  });
  const result = await response.json();
  if (!result.access_token) throw new Error(`local login failed: ${JSON.stringify(result).slice(0, 300)}`);
  return result.access_token;
}

async function serviceRows(table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  return response.json();
}

function spawnBackend(mode) {
  const childEnv = {
    ...env,
    ...mode.flags,
    PORT: String(mode.port),
    ENABLE_MOCK_AI: 'false',
    JEV_RUNNER: 'sdk',
    JEV_INPUT_USD_PER_1M_TOKENS: env.JEV_INPUT_USD_PER_1M_TOKENS || '0.042',
    JEV_OUTPUT_USD_PER_1M_TOKENS: env.JEV_OUTPUT_USD_PER_1M_TOKENS || '0',
  };
  const child = spawn(process.execPath, [path.join(root, 'backend', 'dist', 'index.js')], {
    cwd: root,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (process.env.JEV_HARNESS_VERBOSE === 'true') {
    child.stdout.on('data', (chunk) => { process.stderr.write(`[${mode.name}] ${chunk}`); });
  }
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  return { ...mode, child, base: `http://localhost:${mode.port}`, getStderr: () => stderr.slice(-2000) };
}

async function waitForBackend(server) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    try {
      const response = await fetch(`${server.base}/health`, { signal: controller.signal });
      if (response.ok) return;
    } catch { /* server still starting */ }
    finally { clearTimeout(timer); }
    await sleep(250);
  }
  throw new Error(`${server.name} backend did not become healthy: ${server.getStderr()}`);
}

async function createCompiledStory(server, token) {
  const templateRows = await serviceRows('chimera_ruleset_templates', `key=in.(${rulesets.join(',')})&select=id`);
  const story = data(await api(server.base, 'POST', '/api/v2/chimera/stories', { token, body: {
    display_name: `Interleaved Jev latency ${new Date().toISOString()}`,
    world_id: worldId,
    ruleset_template_ids: templateRows.map((row) => row.id),
    entity_ids: [],
    genesis_config: {},
  } }));
  if (!story?.id) throw new Error('story create failed');
  const patched = await api(server.base, 'PATCH', `/api/v2/chimera/stories/${story.id}`, { token, body: {
    entity_ids: [caelId, kieraId],
    genesis_config: {
      cast_members: [caelId, kieraId],
      set_design: 'Rillford Square at dusk: a busy market with lantern-lit stalls, a fountain, a tavern called The Copper Kettle, and the road out of town to the north.',
      opening_action: 'You arrive in the square carrying a travel pack, looking for someone who can tell you what is happening in Rillford.',
      narrator_tone: 'Standard', pacing: 'balanced', perspective: 'second_person',
      cast_extras: [{ name: 'Constable Bram', visual_alias: 'a wary constable', archetype: 'Constable', attire: 'dented mail and a green cloak', quirk: 'taps his baton when nervous' }],
    },
  } });
  if (patched.status >= 300) throw new Error(`story patch failed: ${patched.text.slice(0, 300)}`);
  const compiled = (await api(server.base, 'POST', `/api/chimera/compile/${story.id}`, { token, body: {}, timeout: 180000 })).json;
  if (!compiled?.compiledId) throw new Error(`compile failed: ${JSON.stringify(compiled).slice(0, 300)}`);
  return compiled.compiledId;
}

async function createGame(server, token, compiledId, index) {
  const character = data(await api(server.base, 'POST', '/api/v2/chimera/player-characters', { token, body: {
    name: `Aria Vale ${server.name} ${index}`,
    world_id: worldId,
    state_snapshot: { id: `aria-${server.name}-${index}`, type: 'PLAYER', properties: { name: 'Aria Vale', hp: 100, maxHp: 100, current_stamina: 100 } },
  } }));
  if (!character?.id) throw new Error(`${server.name} character create failed`);
  const init = data(await api(server.base, 'POST', '/api/chimera/game/init', { token, body: {
    storyId: compiledId,
    characterId: character.id,
    playerInput: { identity: { name: 'Aria Vale' } },
  } }));
  if (!init?.id) throw new Error(`${server.name} game init failed: ${JSON.stringify(init).slice(0, 300)}`);
  return { gameId: init.id };
}

function usageFromAudit(audit) {
  const usage = audit?.token_usage && typeof audit.token_usage === 'object' ? audit.token_usage : {};
  const role = Array.isArray(usage.by_role) ? usage.by_role.find((entry) => entry?.role === 'director') : undefined;
  return {
    input_tokens: Number.isFinite(role?.prompt) ? role.prompt : null,
    output_tokens: Number.isFinite(role?.completion) ? role.completion : null,
    latency_ms: Number.isFinite(role?.ms) ? role.ms : null,
    cost_usd: Number.isFinite(role?.cost) ? role.cost : null,
  };
}

async function playTurn(server, token, state, turn, index) {
  const started = now();
  const response = await api(server.base, 'POST', `/api/games/${state.gameId}/turn`, { token, body: { input: turn.input } });
  const requestMs = Number((now() - started).toFixed(2));
  const rows = await serviceRows('chimera_turns', `game_state_id=eq.${state.gameId}&order=turn_index.desc&limit=1&select=turn_index,director_intent,mechanical_delta,narrator_output`);
  // A failed Director request may not persist a turn, so a later successful request
  // can have a persisted turn index lower than its scenario ordinal. Use the newest
  // row only after a successful response; never reuse a prior row for an error.
  const row = response.status < 300 ? rows[0] || null : null;
  const persistedTurnIndex = row?.turn_index;
  const auditRows = row ? await serviceRows('ai_audit_logs', `game_id=eq.${state.gameId}&turn_index=eq.${persistedTurnIndex}&order=created_at.desc&limit=1&select=turn_index,token_usage,model_used`) : [];
  const payload = data(response);
  return {
    n: index,
    persisted_turn_index: persistedTurnIndex ?? null,
    category: turn.category || 'unspecified',
    input: turn.input,
    status: response.status,
    request_ms: requestMs,
    error: response.status >= 300 ? response.text.slice(0, 500) : null,
    timeline: payload?.runtime_timeline || null,
    director_usage: usageFromAudit(auditRows[0]),
    canary: row?.director_intent?.jev_shadow?.canary || null,
    jev_shadow: row?.director_intent?.jev_shadow || null,
  };
}

function summarizeMode(rows) {
  const successful = rows.filter((row) => row.status < 300);
  const stageValues = (start, end) => successful.map((row) => timing(row.timeline, start, end)).filter(Number.isFinite);
  const fullValues = successful.map((row) => row.timeline?.response_sent?.elapsed_ms).filter(Number.isFinite);
  const jevCost = successful.map((row) => row.jev_shadow?.usage?.estimated_cost_usd).filter(Number.isFinite);
  const avoided = successful.map((row) => row.canary?.gpt_cost_avoided_usd).filter(Number.isFinite);
  return {
    turns: rows.length,
    successful_turns: successful.length,
    failed_turns: rows.length - successful.length,
    full_turn_ms: { p50: quantile(fullValues, 0.5), p95: quantile(fullValues, 0.95), average: mean(fullValues) },
    jev_ms: { p50: quantile(stageValues('jev_start', 'jev_end'), 0.5), p95: quantile(stageValues('jev_start', 'jev_end'), 0.95), average: mean(stageValues('jev_start', 'jev_end')) },
    director_ms: { p50: quantile(stageValues('director_start', 'director_end'), 0.5), p95: quantile(stageValues('director_start', 'director_end'), 0.95), average: mean(stageValues('director_start', 'director_end')) },
    narrator_ms: { p50: quantile(stageValues('narrator_start', 'narrator_end'), 0.5), p95: quantile(stageValues('narrator_start', 'narrator_end'), 0.95), average: mean(stageValues('narrator_start', 'narrator_end')) },
    engine_ms: { p50: quantile(stageValues('engine_start', 'engine_end'), 0.5), p95: quantile(stageValues('engine_start', 'engine_end'), 0.95), average: mean(stageValues('engine_start', 'engine_end')) },
    persistence_ms: { p50: quantile(stageValues('persistence_start', 'persistence_end'), 0.5), p95: quantile(stageValues('persistence_start', 'persistence_end'), 0.95), average: mean(stageValues('persistence_start', 'persistence_end')) },
    actual_director_calls: successful.filter((row) => row.canary?.gpt_director_ran || row.timeline?.director_start).length,
    director_calls_avoided: successful.filter((row) => row.canary && !row.canary.gpt_director_ran).length,
    fallback_count: successful.filter((row) => row.canary?.fallback_occurred).length,
    jev_cost_usd: jevCost.length ? jevCost.reduce((sum, value) => sum + value, 0) : null,
    gpt_cost_avoided_usd: avoided.length ? avoided.reduce((sum, value) => sum + value, 0) : null,
  };
}

async function main() {
  if (!env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is required for the interleaved SDK run');
  const token = await login();
  const servers = modes.map(spawnBackend);
  try {
    await Promise.all(servers.map(waitForBackend));
    const compiledId = await createCompiledStory(servers[0], token);
    const states = new Map();
    for (const [index, server] of servers.entries()) states.set(server.name, await createGame(server, token, compiledId, index));
    const rows = Object.fromEntries(modes.map((mode) => [mode.name, []]));
    for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
      const turn = scenario.turns[turnIndex];
      const order = modes.map((_, offset) => modes[(turnIndex + offset) % modes.length]);
      for (const mode of order) {
        const server = servers.find((candidate) => candidate.name === mode.name);
        rows[mode.name].push(await playTurn(server, token, states.get(mode.name), turn, turnIndex + 1));
      }
    }
    const summary = Object.fromEntries(modes.map((mode) => [mode.name, summarizeMode(rows[mode.name])]));
    const controlCost = rows['gpt-only'].reduce((sum, row) => sum + (row.director_usage.cost_usd || 0), 0);
    const skipFallbackCost = rows['jev-skip-gpt'].reduce((sum, row) => sum + (row.director_usage.cost_usd || 0), 0);
    const skipJevCost = summary['jev-skip-gpt'].jev_cost_usd || 0;
    const grossGptAvoided = controlCost - skipFallbackCost;
    const netSavings = grossGptAvoided - skipJevCost;
    const output = {
      scenario: { name: scenario.name, seed_label: scenario.seed, turns: scenario.turns.length },
      interleaving: { order_rotation: 'mode index rotates each turn', modes: modes.map((mode) => mode.name) },
      summary,
      cost: {
        gpt_only_observed_director_cost_usd: controlCost,
        skip_gpt_fallback_director_cost_usd: skipFallbackCost,
        gross_gpt_cost_avoided_usd: grossGptAvoided,
        jev_cost_usd: skipJevCost,
        net_savings_usd: netSavings,
      },
      rows,
      causal_validation_note: 'No independently sampled GPT run is treated as proof of Jev-caused state divergence. Jev authority is gated by schema and deterministic validation; this run is a latency/canary measurement.',
    };
    if (outputPath) fs.writeFileSync(path.resolve(outputPath), JSON.stringify(output, null, 2), 'utf8');
    console.log(JSON.stringify({ ...output, rows: undefined }, null, 2));
  } finally {
    for (const server of servers) server.child.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
