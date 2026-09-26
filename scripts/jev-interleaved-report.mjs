#!/usr/bin/env node
import fs from 'node:fs';

const files = process.argv.slice(2).filter((value) => value.endsWith('.json'));
if (files.length === 0) {
  throw new Error('Pass one or more interleaved harness JSON files.');
}

const documents = files.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const modes = ['gpt-only', 'jev-compare', 'jev-skip-gpt'];
const quantile = (values, q) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] : null;
};
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const stage = (row, start, end) => {
  const a = row.timeline?.[start]?.elapsed_ms;
  const b = row.timeline?.[end]?.elapsed_ms;
  return typeof a === 'number' && typeof b === 'number' ? b - a : null;
};
const stats = (values) => ({
  n: values.length,
  p50: quantile(values, 0.5),
  p95: quantile(values, 0.95),
  average: average(values),
});
const rowsFor = (mode) => documents.flatMap((document) => document.rows[mode].map((row) => ({
  ...row,
  scenario: document.scenario.name,
})));

const metrics = {};
for (const mode of modes) {
  const rows = rowsFor(mode);
  const successful = rows.filter((row) => row.status < 300);
  const values = (start, end, predicate = () => true) => successful
    .filter(predicate)
    .map((row) => stage(row, start, end))
    .filter(Number.isFinite);
  metrics[mode] = {
    turns: rows.length,
    successful_turns: successful.length,
    failed_turns: rows.length - successful.length,
    full_turn_ms: stats(values('request_received', 'response_sent')),
    jev_sdk_ms: stats(values('jev_start', 'jev_end', (row) => row.jev_shadow?.attempted === true)),
    director_ms: stats(values('director_start', 'director_end')),
    narrator_ms: stats(values('narrator_start', 'narrator_end')),
    engine_ms: stats(values('engine_start', 'engine_end')),
    persistence_ms: stats(values('persistence_start', 'persistence_end')),
    actual_director_calls: successful.filter((row) => row.canary?.gpt_director_ran === true || row.timeline?.director_start).length,
    director_calls_avoided: successful.filter((row) => row.canary && !row.canary.gpt_director_ran).length,
    fallback_turns: successful.filter((row) => row.canary?.fallback_occurred === true).length,
    jev_cost_usd: successful.reduce((sum, row) => sum + (Number(row.jev_shadow?.usage?.estimated_cost_usd) || 0), 0),
    director_cost_usd: successful.reduce((sum, row) => sum + (Number(row.director_usage?.cost_usd) || 0), 0),
  };
}

const correctness = {};
for (const mode of ['jev-compare', 'jev-skip-gpt']) {
  correctness[mode] = {};
  for (const family of ['action_classification', 'feasibility']) {
    const decisions = rowsFor(mode)
      .filter((row) => row.status < 300)
      .flatMap((row) => (row.canary?.decisions || []).filter((decision) => decision.family === family));
    const accepted = decisions.filter((decision) => decision.authoritative === true);
    const fallback = decisions.filter((decision) => decision.authoritative !== true);
    correctness[mode][family] = {
      evaluated: decisions.length,
      accepted: accepted.length,
      fallback: fallback.length,
      accuracy_on_accepted: accepted.length ? accepted.filter((decision) => decision.jev_correctness === 'correct').length / accepted.length : null,
      false_accept: accepted.filter((decision) => decision.jev_correctness === 'wrong').length,
      false_reject: fallback.filter((decision) => decision.jev_correctness === 'correct').length,
    };
  }
}

const cost = {};
for (const document of documents) {
  const control = document.rows['gpt-only'].reduce((sum, row) => sum + (Number(row.director_usage?.cost_usd) || 0), 0);
  const skipFallback = document.rows['jev-skip-gpt'].reduce((sum, row) => sum + (Number(row.director_usage?.cost_usd) || 0), 0);
  const jev = document.rows['jev-skip-gpt'].reduce((sum, row) => sum + (Number(row.jev_shadow?.usage?.estimated_cost_usd) || 0), 0);
  cost[document.scenario.name] = {
    control_director_usd: control,
    skip_fallback_director_usd: skipFallback,
    gross_gpt_avoided_usd: control - skipFallback,
    jev_usd: jev,
    net_savings_usd: control - skipFallback - jev,
  };
}
cost.combined = Object.values(cost).reduce((sum, item) => ({
  control_director_usd: sum.control_director_usd + item.control_director_usd,
  skip_fallback_director_usd: sum.skip_fallback_director_usd + item.skip_fallback_director_usd,
  gross_gpt_avoided_usd: sum.gross_gpt_avoided_usd + item.gross_gpt_avoided_usd,
  jev_usd: sum.jev_usd + item.jev_usd,
  net_savings_usd: sum.net_savings_usd + item.net_savings_usd,
}), {
  control_director_usd: 0,
  skip_fallback_director_usd: 0,
  gross_gpt_avoided_usd: 0,
  jev_usd: 0,
  net_savings_usd: 0,
});

console.log(JSON.stringify({
  scenarios: documents.map((document) => document.scenario),
  metrics,
  correctness,
  cost,
}, null, 2));
