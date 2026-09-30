#!/usr/bin/env node
/**
 * StoneCaster isolated local environment CLI.
 *
 *   node scripts/stonecaster-local.mjs <command> [--mock|--real]
 *
 *   stack:up      start the local Supabase stack (project id "stonecaster", ports 5442x)
 *   stack:down    stop it (data volume kept)
 *   dev           stack + backend (:3000, watch mode: auto rebuild+restart)  + frontend (:5183); --mock (default, no model calls) or --real
 *                 --real uses the providers configured via LLM_PROVIDER / {DIRECTOR,NARRATOR,GENESIS}_LLM_PROVIDER / *_LLM_MODEL
 *                 (backend/.env, repo-root .env or the shell), or --provider=openrouter|openai|mock to set them all at once.
 *                 With no explicit provider, real mode auto-picks openrouter (model openrouter/free) if OPENROUTER_API_KEY exists, else openai.
 *   reset         drop + recreate the local DB from supabase/migrations and supabase/seed
 *   health        verify stack, seed data, backend and frontend
 *   smoke         end-to-end gameplay smoke test against the running app (--mock or --real)
 *
 * Hosted .env files are never modified. Local values are injected into child-process environments,
 * which win over backend/.env (dotenv does not override) and frontend/.env (Vite gives process env priority).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const args = process.argv.slice(2);
const cmd = args[0];
const mode = args.includes('--real') ? 'real' : 'mock';
const providerArg = args.find((a) => a.startsWith('--provider='))?.split('=')[1];

const localEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env.stonecaster-local')));
const PORTS = { api: Number(localEnv.PORT), web: Number(localEnv.VITE_PORT), supabaseApi: 54421, supabaseDb: 54422, studio: 54423, mail: 54424 };

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };
const log = (s) => console.log(`[stonecaster] ${s}`);

function sh(command, opts = {}) {
  return spawnSync(command, { cwd: root, shell: true, stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', ...opts });
}
const supabase = (a, opts) => sh(`npx --no-install supabase ${a}`, opts);

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '0.0.0.0');
  });
}

function childEnv() {
  const base = { ...process.env, ...localEnv };
  if (mode === 'real') {
    // Precedence: shell > backend/.env > repo-root .env (the OpenRouter key currently lives in the root file)
    const read = (f) => (fs.existsSync(f) ? dotenv.parse(fs.readFileSync(f)) : {});
    const files = { ...read(path.join(root, '.env')), ...read(path.join(root, 'backend', '.env')) };
    const pick = (k) => process.env[k] || files[k];
    for (const k of ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'PRIMARY_AI_MODEL', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_TIMEOUT_MS',
      ...['DIRECTOR', 'NARRATOR', 'GENESIS'].flatMap((r) => [`${r}_LLM_PROVIDER`, `${r}_LLM_MODEL`])]) {
      if (pick(k)) base[k] = pick(k);
    }
    if (providerArg) base.LLM_PROVIDER = providerArg;
    const roleProviders = ['DIRECTOR', 'NARRATOR', 'GENESIS'].map((r) => base[`${r}_LLM_PROVIDER`]);
    if (!base.LLM_PROVIDER && !roleProviders.every(Boolean)) {
      base.LLM_PROVIDER = base.OPENROUTER_API_KEY ? 'openrouter' : 'openai';
    }
    const used = new Set(['DIRECTOR', 'NARRATOR', 'GENESIS'].map((r) => base[`${r}_LLM_PROVIDER`] || base.LLM_PROVIDER));
    if (used.has('openai') && !base.OPENAI_API_KEY) throw new Error('Real AI mode selected provider "openai" but no OPENAI_API_KEY found (backend/.env, root .env or shell).');
    if (used.has('openrouter') && !base.OPENROUTER_API_KEY) throw new Error('Real AI mode selected provider "openrouter" but no OPENROUTER_API_KEY found (backend/.env, root .env or shell).');
    base.ENABLE_MOCK_AI = 'false';
  } else {
    base.ENABLE_MOCK_AI = 'true';
  }
  return base;
}

function stackRunning() {
  const r = supabase('status -o json', { quiet: true });
  return r.status === 0 && /API_URL/.test(r.stdout || '');
}
function stackUp() {
  if (stackRunning()) return log(c.g('Supabase stack already running (stonecaster).'));
  log('starting Supabase stack (first run pulls images)...');
  const r = supabase('start');
  if (r.status !== 0) throw new Error('supabase start failed');
}

async function http(url, init = {}, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { /* not json */ }
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  } finally { clearTimeout(t); }
}

async function health() {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });
  const svcHeaders = { apikey: localEnv.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${localEnv.SUPABASE_SERVICE_KEY}` };

  const docker = sh('docker ps --format {{.Names}}', { quiet: true });
  const names = (docker.stdout || '').split(/\r?\n/);
  const need = ['supabase_db_stonecaster', 'supabase_auth_stonecaster', 'supabase_rest_stonecaster', 'supabase_kong_stonecaster'];
  add('docker containers (stonecaster)', need.every((n) => names.includes(n)), need.filter((n) => !names.includes(n)).join(', ') || 'db/auth/rest/kong up');

  const auth = await http(`${localEnv.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: localEnv.SUPABASE_ANON_KEY } });
  add('supabase auth', auth.ok, `HTTP ${auth.status}`);

  const counts = { prompts: 13, profiles: 3 };
  for (const [t, min] of Object.entries(counts)) {
    const range = await countHeader(`${localEnv.SUPABASE_URL}/rest/v1/${t}?select=*`, svcHeaders);
    const n = Number(/\/(\d+)$/.exec(range)?.[1] ?? NaN);
    add(`seed: ${t} >= ${min}`, n >= min, `${Number.isNaN(n) ? '?' : n} rows`);
  }
  const contentCounts = { world: 2, ruleset: 16, entity: 7, mechanic_skill: 15 };
  for (const [kind, min] of Object.entries(contentCounts)) {
    const range = await countHeader(`${localEnv.SUPABASE_URL}/rest/v1/chimera_content_source_items?select=content_key&content_kind=eq.${kind}`, svcHeaders);
    const n = Number(/\/(\d+)$/.exec(range)?.[1] ?? NaN);
    add(`repo content: ${kind} >= ${min}`, n >= min, `${Number.isNaN(n) ? '?' : n} rows`);
  }

  const anon = await http(`${localEnv.SUPABASE_URL}/rest/v1/prompts?select=id`, { headers: { apikey: localEnv.SUPABASE_ANON_KEY, Authorization: `Bearer ${localEnv.SUPABASE_ANON_KEY}` } });
  add('RLS: anon cannot read prompts', anon.ok && Array.isArray(anon.json) && anon.json.length === 0, `${anon.json?.length ?? '?'} rows visible`);

  const api = await http(`http://localhost:${PORTS.api}/health`);
  add(`backend :${PORTS.api} /health`, api.ok, api.ok ? `HTTP ${api.status}${api.json?.mockAi !== undefined ? ` mockAi=${api.json.mockAi}` : ''}` : (api.error || `HTTP ${api.status}`));
  const web = await http(`http://localhost:${PORTS.web}/`);
  add(`frontend :${PORTS.web}`, web.ok, web.ok ? `HTTP ${web.status}` : (web.error || `HTTP ${web.status}`));

  for (const ch of checks) console.log(`${ch.ok ? c.g('PASS') : c.r('FAIL')}  ${ch.name}${ch.detail ? c.d('  — ' + ch.detail) : ''}`);
  const stackOk = checks.filter((k) => !/backend|frontend/.test(k.name)).every((k) => k.ok);
  const appOk = checks.filter((k) => /backend|frontend/.test(k.name)).every((k) => k.ok);
  console.log(`\nstack: ${stackOk ? c.g('healthy') : c.r('UNHEALTHY')}   app: ${appOk ? c.g('up') : c.y('not running (start with npm run local:dev)')}`);
  return stackOk && (appOk || args.includes('--stack-only'));
}
async function countHeader(url, headers) {
  const res = await fetch(url, { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } }).catch(() => null);
  return res?.headers.get('content-range') || '';
}

async function dev() {
  for (const [name, port] of [['API', PORTS.api], ['web', PORTS.web]]) {
    if (!(await portFree(port))) throw new Error(`${name} port ${port} is already in use. Free it (see: netstat -ano | findstr :${port}); local StoneCaster is pinned to ${PORTS.api}/${PORTS.web}.`);
  }
  stackUp();
  const env = childEnv();
  const llm = ['DIRECTOR', 'NARRATOR', 'GENESIS'].map((r) => `${r.toLowerCase()}=${env[`${r}_LLM_PROVIDER`] || env.LLM_PROVIDER}`).join(' ');
  log(`AI mode: ${mode === 'real' ? c.y(`REAL (${llm})`) : c.g('MOCK (no external model calls)')}`);
  log(`API http://localhost:${PORTS.api}   Web http://localhost:${PORTS.web}   Studio http://127.0.0.1:${PORTS.studio}   Mail http://127.0.0.1:${PORTS.mail}`);
  const kids = [];
  const run = (name, command) => {
    const k = spawn(command, { cwd: root, env, shell: true, stdio: 'inherit' });
    k.on('exit', (code) => { log(`${name} exited (${code})`); stop(code ?? 1); });
    kids.push(k);
  };
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return; stopping = true;
    for (const k of kids) { try { isWin ? spawnSync(`taskkill /pid ${k.pid} /T /F`, { shell: true, stdio: 'ignore' }) : k.kill('SIGTERM'); } catch { /* gone */ } }
    setTimeout(() => process.exit(code), 300);
  };
  process.on('SIGINT', () => stop(0)); process.on('SIGTERM', () => stop(0));
  run('backend', 'npm run dev:watch --workspace=backend'); // tsup --watch: rebuild + restart node on src/shared changes
  run('frontend', `npm run dev --workspace=frontend -- --host localhost --port ${PORTS.web} --strictPort`);
}

async function main() {
  switch (cmd) {
    case 'stack:up': return stackUp();
    case 'stack:down': return void supabase('stop');
    case 'reset': {
      stackUp();
      const r = supabase('db reset');
      if (r.status !== 0) process.exit(r.status || 1);
      const seed = spawnSync('node scripts/seed-first-party-local.mjs', { cwd: root, env: { ...process.env, ...localEnv }, shell: true, stdio: 'inherit' });
      if (seed.status !== 0) process.exit(seed.status ?? 1);
      return process.exit((await health()) ? 0 : 1);
    }
    case 'health': return process.exit((await health()) ? 0 : 1);
    case 'dev': return dev();
    case 'smoke': {
      const r = spawnSync(`node scripts/stonecaster-smoke.mjs ${mode === 'real' ? '--real' : '--mock'}`, { cwd: root, env: childEnv(), shell: true, stdio: 'inherit' });
      return process.exit(r.status ?? 1);
    }
    default:
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, ''));
  }
}
main().catch((e) => { console.error(c.r(`[stonecaster] ${e.message}`)); process.exit(1); });
