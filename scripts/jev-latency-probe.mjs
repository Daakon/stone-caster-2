#!/usr/bin/env node
/**
 * Compare the supported jev.cmd launcher with the project TypeSafe JS SDK.
 * This is a local diagnostic; it does not change gameplay or hosted data.
 */
import fs from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFiles = [path.join(root, '.env'), path.join(root, 'backend', '.env')].filter(fs.existsSync);
for (const file of envFiles) Object.assign(process.env, dotenv.parse(fs.readFileSync(file)), process.env);

const iterations = Number(process.env.JEV_LATENCY_ITERATIONS || 5);
const state = {
  player_input: 'I rest beside the road and recover my breath.',
  scene: { location: 'Rillford Square', time: 'dusk', present: ['Aria Vale', 'Constable Bram', 'Kiera'] },
  player: { id: 'player', name: 'Aria Vale', properties: { hp: 100, current_stamina: 62, inventory: ['travel pack', 'food', 'water', 'knife'] } },
  present_entities: [
    { id: 'bram', name: 'Constable Bram', type: 'NPC', status: 'present', properties: { hp: 100 } },
    { id: 'kiera', name: 'Kiera', type: 'NPC', status: 'present', properties: { hp: 100 } },
  ],
  engine_capabilities: { rest_action: { registered: true, requires_engine: true } },
};
const questions = {
  action_classification: { type: 'choice', instructions: 'Classify the player input into exactly one primary action category.', criteria: {
    observation: 'Only observes or asks for description.', social_action: 'Addresses or interacts with a character.', combat_action: 'Attempts violence or physical conflict.', rest_action: 'Rests, sleeps, camps, or recovers.', eat_action: 'Consumes food or drink.', navigate: 'Travels to a distinct place.', attempt_action: 'Attempts another physical or skill action.',
  } },
  feasibility: { type: 'choice', instructions: 'Is the requested action feasible for this character with the listed possessions?', criteria: { possible: 'The character can plausibly attempt it.', impossible: 'It requires an unavailable capability or reality change.' } },
  target_selection: { type: 'choice', instructions: 'Which known character is the primary target, or none?', criteria: { none: 'No target.', bram: 'Constable Bram.', kiera: 'Kiera.' } },
};
const request = {
  state,
  questions: Object.entries(questions).map(([id, question]) => ({
    id,
    question: question.instructions,
    options: question.criteria,
  })),
};

const ms = (start) => Number((performance.now() - start).toFixed(2));
const extractJson = (text) => {
  const starts = [...text.matchAll(/[\[{]/g)].map((m) => m.index).reverse();
  for (const start of starts) {
    try { return JSON.parse(text.slice(start)); } catch { /* try an earlier opening bracket */ }
  }
  throw new Error(`Jev output did not contain JSON: ${text.slice(-500)}`);
};

async function runCli() {
  const rows = [];
  for (let i = 0; i < iterations; i += 1) {
    const directory = await mkdtemp(path.join(tmpdir(), 'stonecaster-jev-probe-'));
    const requestPath = path.join(directory, 'request.json');
    const serializationStart = performance.now();
    await writeFile(requestPath, JSON.stringify(request), 'utf8');
    const serializationMs = ms(serializationStart);
    const processStart = performance.now();
    const row = await new Promise((resolve, reject) => {
      let spawnedAt = null;
      let stdout = '';
      let stderr = '';
      const child = spawn('jev.cmd', ['decide', '--file', requestPath], {
        shell: true,
        windowsHide: true,
        env: { ...process.env, TYPESAFE_LOG_LEVEL: 'info' },
      });
      child.once('spawn', () => { spawnedAt = performance.now(); });
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(stderr.trim() || `jev.cmd exited ${code}`));
        const parseStart = performance.now();
        const answer = extractJson(stdout);
        const parseMs = ms(parseStart);
        const sdkLog = [...stdout.matchAll(/<-[^\n]*? in (\d+(?:\.\d+)?)ms/g)].map((match) => Number(match[1])).at(-1) ?? null;
        const processWallMs = ms(processStart);
        resolve({
          serialization_ms: Number(serializationMs.toFixed(2)),
          process_startup_ms: spawnedAt === null ? null : Number((spawnedAt - processStart).toFixed(2)),
          process_wall_clock_ms: Number(processWallMs.toFixed(2)),
          sdk_network_inference_ms: sdkLog,
          cli_overhead_ms: sdkLog === null ? null : Number((processWallMs - sdkLog).toFixed(2)),
          parse_reporting_ms: Number(parseMs.toFixed(2)),
          model: Object.values(answer)[0]?.model || null,
        });
      });
    });
    rows.push(row);
    await rm(directory, { recursive: true, force: true });
  }
  return rows;
}

async function runSdk() {
  const sdkModule = process.env.JEV_SDK_PATH
    ? await import(pathToFileURL(process.env.JEV_SDK_PATH).href)
    : await import('@typesafe-ai/sdk');
  const { TypeSafeClient } = sdkModule;
  const logs = [];
  const client = new TypeSafeClient({ logLevel: 'info', logger: {
    debug() {},
    info(message) {
      const match = /<-[^\n]*? in (\d+(?:\.\d+)?)ms/.exec(message);
      if (match) logs.push(Number(match[1]));
    },
    warn() {},
    error() {},
  } });
  const rows = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    const response = await client.systemOne({ state, questions });
    const totalMs = ms(start);
    rows.push({
      sdk_total_ms: Number(totalMs.toFixed(2)),
      sdk_network_inference_ms: logs.at(-1) ?? null,
      model: response.model || null,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
    });
  }
  return rows;
}

const summarize = (rows, key) => {
  const values = rows.map((row) => row[key]).filter((value) => typeof value === 'number');
  return values.length ? {
    count: values.length,
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
    average_ms: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
  } : null;
};

const cli = await runCli();
const sdk = await runSdk();
console.log(JSON.stringify({
  iterations,
  supported_sdk_path: process.env.JEV_SDK_PATH || '@typesafe-ai/sdk project dependency',
  cli,
  sdk,
  summary: {
    cli_process_startup: summarize(cli, 'process_startup_ms'),
    cli_process_wall_clock: summarize(cli, 'process_wall_clock_ms'),
    cli_sdk_network_inference: summarize(cli, 'sdk_network_inference_ms'),
    cli_overhead: summarize(cli, 'cli_overhead_ms'),
    cli_request_serialization: summarize(cli, 'serialization_ms'),
    cli_parse_reporting: summarize(cli, 'parse_reporting_ms'),
    sdk_total: summarize(sdk, 'sdk_total_ms'),
    sdk_network_inference: summarize(sdk, 'sdk_network_inference_ms'),
  },
}, null, 2));
