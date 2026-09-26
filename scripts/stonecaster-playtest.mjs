#!/usr/bin/env node
/**
 * StoneCaster gameplay playtest harness (API level, against the RUNNING local app).
 *
 *   node scripts/stonecaster-playtest.mjs [scenario.json | --inline "turn 1" "turn 2" ...] [--resume] [--json]
 *
 * Creates a story with a real cast (Cael, Kiera + an ad-hoc constable), starts a game, plays each input, and prints
 * every layer per turn so gameplay can be judged, not just "did it 200":
 *   input -> Director intent (trigger, targets by NAME, ripples) -> Engine delta -> Narration -> resulting state.
 * --resume reloads the game with a fresh session after the last turn and diffs it against the last live state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...dotenv.parse(fs.readFileSync(path.join(root, '.env.stonecaster-local'))), ...process.env };
const API = `http://localhost:${env.PORT || 3000}`;
const SB = env.SUPABASE_URL;
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const resume = argv.includes('--resume');
const inlineAt = argv.indexOf('--inline');
const outputAt = argv.indexOf('--output');
const outputPath = outputAt >= 0 ? argv[outputAt + 1] : null;
const scenarioFile = argv.find((a, index) => a.endsWith('.json') && index !== outputAt + 1);
const rawTurns = inlineAt >= 0
  ? argv.slice(inlineAt + 1).filter((a) => !a.startsWith('--')).map((input) => ({ input, category: 'inline' }))
  : scenarioFile ? JSON.parse(fs.readFileSync(scenarioFile, 'utf8')).turns : [{ input: 'I look around.', category: 'observation' }];
const turns = rawTurns.map((turn) => typeof turn === 'string' ? ({ input: turn, category: 'unspecified' }) : turn);

const WORLD_ID = 'b3de4b0a-a879-43cf-8256-2153a5ff97a9';
const CAEL = '4c5bb787-53ce-487d-b574-c7a6c66070e7';
const KIERA = '789dbece-3bc9-4080-82ce-31b47139fbb5';
const RULESETS = ['cinematic-combat-lite', 'vitality-stamina-system', 'd100-5-pillars', 'world-cycle-time-bands', 'needs-survival-basic', 'npc-personalities', 'npc-relationships'];

const must = (c, m) => { if (!c) throw new Error(m); };
const numberOrNull = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const price = (key) => numberOrNull(Number(env[key]));
const estimateCost = (inputTokens, outputTokens, inputRate, outputRate) => {
  if (inputTokens === null || outputTokens === null || inputRate === null || outputRate === null) return null;
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
};
async function api(method, p, { token, body, timeout = 300000 } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${API}${p}`, { method, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text };
  } finally { clearTimeout(t); }
}
const data = (r) => r.json?.data ?? r.json;
const login = async () => { const r = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'player@stonecaster.local', password: 'stonecaster-dev' }) })).json(); must(r.access_token, 'login failed'); return r.access_token; };
const svc = async (table, q) => (await fetch(`${SB}/rest/v1/${table}?${q}`, { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } })).json();
const directorPricing = {
  input_usd_per_1m_tokens: price('GPT_DIRECTOR_INPUT_USD_PER_1M_TOKENS'),
  output_usd_per_1m_tokens: price('GPT_DIRECTOR_OUTPUT_USD_PER_1M_TOKENS'),
};
const jevPricing = {
  input_usd_per_1m_tokens: price('JEV_INPUT_USD_PER_1M_TOKENS'),
  output_usd_per_1m_tokens: price('JEV_OUTPUT_USD_PER_1M_TOKENS'),
};
const highConfidenceThreshold = numberOrNull(Number(env.JEV_HIGH_CONFIDENCE_THRESHOLD)) ?? 0.8;

function directorUsageFromAudit(audit) {
  const usage = audit?.token_usage && typeof audit.token_usage === 'object' ? audit.token_usage : {};
  const role = Array.isArray(usage.by_role)
    ? usage.by_role.find((entry) => entry?.role === 'director')
    : undefined;
  if (!role) {
    return { model: null, input_tokens: null, output_tokens: null, latency_ms: null, cost_usd: audit?.model_used === 'mock' ? 0 : null, source: audit?.model_used === 'mock' ? 'mock' : 'unavailable' };
  }
  const inputTokens = numberOrNull(role.prompt);
  const outputTokens = numberOrNull(role.completion);
  const observedCost = numberOrNull(role.cost);
  return {
    model: role.model || audit?.model_used || null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: numberOrNull(role.ms),
    cost_usd: observedCost ?? estimateCost(inputTokens, outputTokens, directorPricing.input_usd_per_1m_tokens, directorPricing.output_usd_per_1m_tokens),
    source: observedCost !== null ? 'observed' : (inputTokens !== null ? 'estimated' : 'unavailable'),
  };
}

const token = await login();
const rulesets = await svc('chimera_ruleset_templates', `key=in.(${RULESETS.join(',')})&select=id`);
const story = data(await api('POST', '/api/v2/chimera/stories', { token, body: { display_name: `Playtest ${new Date().toISOString()}`, world_id: WORLD_ID, ruleset_template_ids: rulesets.map((x) => x.id), entity_ids: [], genesis_config: {} } }));
must(story?.id, 'story create failed');
// Same sequence as the Casting Circle UI: create the draft, then PATCH cast + Director's Slate
const patch = await api('PATCH', `/api/v2/chimera/stories/${story.id}`, { token, body: {
  entity_ids: [CAEL, KIERA],
  genesis_config: {
    cast_members: [CAEL, KIERA],
    set_design: 'Rillford Square at dusk: a busy market with lantern-lit stalls, a fountain, a tavern called The Copper Kettle, and the road out of town to the north.',
    opening_action: 'You arrive in the square carrying a travel pack, looking for someone who can tell you what is happening in Rillford.',
    narrator_tone: 'Standard', pacing: 'balanced', perspective: 'second_person',
    cast_extras: [{ name: 'Constable Bram', visual_alias: 'a wary constable', archetype: 'Constable', attire: 'dented mail and a green cloak', quirk: 'taps his baton when nervous' }],
  } } });
must(patch.status < 300, `story patch failed ${patch.text.slice(0, 300)}`);

const compiled = (await api('POST', `/api/chimera/compile/${story.id}`, { token, body: {}, timeout: 180000 })).json;
must(compiled?.compiledId, `compile failed ${JSON.stringify(compiled).slice(0, 300)}`);
const character = data(await api('POST', '/api/v2/chimera/player-characters', { token, body: { name: 'Aria Vale', world_id: WORLD_ID, state_snapshot: { id: 'aria', type: 'PLAYER', properties: { name: 'Aria Vale', hp: 100, maxHp: 100, current_stamina: 100 } } } }));
must(character?.id, 'character create failed');
const init = data(await api('POST', '/api/chimera/game/init', { token, body: { storyId: compiled.compiledId, characterId: character.id, playerInput: { identity: { name: 'Aria Vale' } } } }));
const gameId = init?.id; must(gameId, 'game init failed');

const nameOf = (state) => (id) => { const e = state?.mechanical_state?.entities?.[id]; return e?.properties?.display_name || e?.properties?.name || e?.display_name || (e?.type === 'PLAYER' ? 'PLAYER' : String(id).slice(0, 8)); };
const summarize = (state) => {
  const ents = state.mechanical_state?.entities || {}; const n = nameOf(state);
  return Object.entries(ents).map(([id, e]) => {
    const p = e.properties || {};
    const rel = e.social?.relationships?.player ?? e.relationships?.player ?? p.relationships?.player;
    return `${n(id)}[hp=${p.hp ?? '-'} sta=${p.current_stamina ?? '-'}${p.status ? ' st=' + JSON.stringify(p.status) : ''}${p.conditions ? ' cond=' + JSON.stringify(p.conditions) : ''}${rel ? ' rel=' + JSON.stringify(rel) : ''}]`;
  }).join(' ');
};
const load = async (tok) => data(await api('GET', `/api/chimera/play/${gameId}`, { token: tok }));

const record = [];
const initialState = await load(token);
let state = initialState;
if (!asJson) {
  console.log(`\n=== game ${gameId} ===\nOPENING: ${(state.narrative_focus?.dialogue_history?.[0]?.content || state.narrative_focus?.scene_context?.description || '').slice(0, 700)}\nSCENE: ${JSON.stringify(state.narrative_focus?.scene_context || {}).slice(0, 300)}\nCAST: ${summarize(state)}\n`);
}
for (const [i, turn] of turns.entries()) {
  const input = turn.input;
  const category = turn.category || 'unspecified';
  const t0 = Date.now();
  const r = await api('POST', `/api/games/${gameId}/turn`, { token, body: { input } });
  const ms = Date.now() - t0;
  const turnRows = await svc('chimera_turns', `game_state_id=eq.${gameId}&order=turn_index.desc&limit=1&select=turn_index,director_intent,mechanical_delta,narrator_output`);
  const row = turnRows[0] || {};
  const auditRows = row.turn_index === undefined ? [] : await svc('ai_audit_logs', `game_id=eq.${gameId}&turn_index=eq.${row.turn_index}&order=created_at.desc&limit=1&select=turn_index,token_usage,model_used`);
  const directorUsage = directorUsageFromAudit(auditRows[0]);
  const d = data(r);
  state = await load(token);
  const rec = {
    n: i + 1,
    category,
    input,
    status: r.status,
    ms,
    error: r.status >= 300 ? r.text.slice(0, 400) : undefined,
    intent: row.director_intent,
    canary: row.director_intent?.jev_shadow?.canary,
    delta: row.mechanical_delta,
    narration: row.narrator_output?.narration,
    director_usage: directorUsage,
    runtime_timeline: d?.runtime_timeline || null,
    logs: (d?.new_logs || []).map((l) => `${l.role || l.type || ''}: ${l.content}`),
    suggested: state.action_queue,
    persisted_authoritative_state: {
      mechanical_state: state.mechanical_state,
      action_queue: state.action_queue,
      scene_registry: state.scene_registry,
      director_intent: row.director_intent,
      mechanical_delta: row.mechanical_delta,
      turn_meta: row.director_intent?.turn_meta || null,
    },
    narrative_snapshot: {
      narrative_focus: state.narrative_focus,
      narrator_output: row.narrator_output,
      action_queue: state.action_queue,
    },
    state: summarize(state),
  };
  record.push(rec);
  if (!asJson) {
    console.log(`--- TURN ${rec.n} (${ms}ms, HTTP ${r.status}) ---\nPLAYER: ${input}`);
    if (rec.error) { console.log(`ERROR: ${rec.error}`); continue; }
    console.log(`DIRECTOR: ${JSON.stringify(rec.intent)}\nENGINE Δ: ${JSON.stringify(rec.delta)}\nLOGS: ${rec.logs.join(' | ')}\nNARRATION: ${rec.narration}\nCHIPS: ${JSON.stringify(rec.suggested)}\nSTATE: ${rec.state}\n`);
  }
}
const jevShadowTurns = record.map((r) => r.intent?.jev_shadow).filter(Boolean);
const jevDecisions = jevShadowTurns.flatMap((shadow) => shadow.decisions || []);
const canaryTurns = record.map((r) => r.canary).filter(Boolean);
const canaryDecisions = canaryTurns.flatMap((canary) => canary.decisions || []);
const comparableJev = jevDecisions.filter((d) => d.agreement !== null);
const validJev = jevDecisions.filter((d) => d.engine_validity?.valid);
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const sumKnown = (values) => values.length === 0 || values.some((v) => typeof v !== 'number') ? null : values.reduce((a, b) => a + b, 0);
const summarizeConfidence = (decisions) => {
  const values = decisions.map((d) => d.confidence).filter((v) => typeof v === 'number');
  return { count: values.length, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, average: mean(values) };
};
const correctnessCounts = jevDecisions.reduce((counts, decision) => {
  const key = decision.correctness_outcome || 'undetermined';
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const deterministicDecisions = jevDecisions.filter((d) => ['deterministic', 'engine_rules'].includes(d.deterministic_ground_truth?.source));
const highConfidenceEligible = deterministicDecisions.filter((d) => d.engine_validity?.valid && typeof d.jev_result?.confidence === 'number' && d.jev_result.confidence >= highConfidenceThreshold);
const safelyCorrectEligible = highConfidenceEligible.filter((d) => d.jev_correctness === 'correct');
const jevCosts = jevShadowTurns.map((s) => s.usage?.estimated_cost_usd).filter((v) => typeof v === 'number');
const directorCosts = record.map((r) => r.director_usage?.cost_usd);
const totalJevCost = sumKnown(jevCosts);
const totalDirectorCost = sumKnown(directorCosts);
const eligibleShare = deterministicDecisions.length ? highConfidenceEligible.length / deterministicDecisions.length : null;
const fallbackShare = eligibleShare === null ? null : 1 - eligibleShare;
const hypotheticalHybridCost = totalJevCost !== null && totalDirectorCost !== null && fallbackShare !== null
  ? totalJevCost + (totalDirectorCost * fallbackShare)
  : null;
const decisionGroups = jevDecisions.reduce((groups, decision) => {
  const type = decision.decision_type || decision.decision || 'unknown';
  (groups[type] ||= []).push(decision);
  return groups;
}, {});
const decisionCategoryMetrics = Object.fromEntries(Object.entries(decisionGroups).map(([type, decisions]) => {
  const known = decisions.filter((d) => d.correctness_outcome !== 'undetermined');
  const correct = known.filter((d) => d.jev_correctness === 'correct').length;
  const wrong = known.filter((d) => d.jev_correctness === 'wrong').length;
  const deterministic = decisions.filter((d) => ['deterministic', 'engine_rules'].includes(d.deterministic_ground_truth?.source)).length;
  const highConfidence = decisions.filter((d) => d.engine_validity?.valid && typeof d.jev_result?.confidence === 'number' && d.jev_result.confidence >= highConfidenceThreshold);
  return [type, {
    count: decisions.length,
    deterministic_count: deterministic,
    known_correctness_count: known.length,
    jev_correct: correct,
    jev_wrong: wrong,
    jev_correctness_rate: known.length ? correct / known.length : null,
    director_correct: known.filter((d) => d.director_correctness === 'correct').length,
    average_confidence: mean(decisions.map((d) => d.jev_result?.confidence).filter((v) => typeof v === 'number')),
    average_latency_ms: mean(decisions.map((d) => d.latency_ms).filter((v) => typeof v === 'number')),
    high_confidence_count: highConfidence.length,
    high_confidence_correct_count: highConfidence.filter((d) => d.jev_correctness === 'correct').length,
    appears_safe_candidate: deterministic > 0 && known.length > 0 && wrong === 0 && highConfidence.length > 0,
  }];
}));
const canaryKnown = canaryDecisions.filter((d) => ['correct', 'wrong'].includes(d.jev_correctness));
const canaryAuthoritative = canaryDecisions.filter((d) => d.authoritative);
const canaryGptAuthoritative = canaryDecisions.filter((d) => d.authority === 'primary');
const canaryCorrect = canaryKnown.filter((d) => d.jev_correctness === 'correct');
const canaryIncorrect = canaryKnown.filter((d) => d.jev_correctness === 'wrong');
const falseAccepts = canaryAuthoritative.filter((d) => d.jev_correctness === 'wrong');
const falseRejects = canaryKnown.filter((d) => !d.authoritative && d.jev_correctness === 'correct');
const canaryJevCost = sumKnown(canaryTurns.map((turn) => turn.jev_cost_usd ?? null));
const gptCostAvoided = sumKnown(canaryTurns.map((turn) => turn.gpt_cost_avoided_usd));
const actualDirectorCalls = canaryTurns.filter((turn) => turn.gpt_director_ran).length;
const expectedDirectorCalls = canaryTurns.length;
const averageCanaryEndToEndLatency = mean(canaryTurns.map((turn) => turn.end_to_end_latency_ms).filter((v) => typeof v === 'number'));
const averageDirectorLatency = mean(record.map((turn) => turn.director_usage?.latency_ms).filter((v) => typeof v === 'number'));
const canaryByFamily = Object.fromEntries(Object.entries(canaryDecisions.reduce((groups, decision) => {
  (groups[decision.family] ||= []).push(decision);
  return groups;
}, {})).map(([family, decisions]) => {
  const known = decisions.filter((d) => ['correct', 'wrong'].includes(d.jev_correctness));
  const authoritative = decisions.filter((d) => d.authoritative);
  const gptAuthoritative = decisions.filter((d) => d.authority === 'primary');
  const correct = known.filter((d) => d.jev_correctness === 'correct');
  const incorrect = known.filter((d) => d.jev_correctness === 'wrong');
  return [family, {
    count: decisions.length,
    authoritative_count: authoritative.length,
    jev_authoritative_count: authoritative.length,
    gpt_authoritative_count: gptAuthoritative.length,
    authoritative_accuracy: authoritative.length ? authoritative.filter((d) => d.jev_correctness === 'correct').length / authoritative.length : null,
    fallback_count: decisions.length - authoritative.length,
    fallback_rate: decisions.length ? (decisions.length - authoritative.length) / decisions.length : null,
    false_accept_count: authoritative.filter((d) => d.jev_correctness === 'wrong').length,
    false_reject_count: decisions.filter((d) => !d.authoritative && d.jev_correctness === 'correct').length,
    known_correctness_count: known.length,
    jev_correct_count: correct.length,
    jev_wrong_count: incorrect.length,
    average_confidence: mean(decisions.map((d) => d.confidence).filter((v) => typeof v === 'number')),
  }];
}));
const canaryActualSavings = gptCostAvoided === null || canaryJevCost === null ? null : gptCostAvoided - canaryJevCost;
const jevShadowReport = {
  turns: jevShadowTurns.length,
  available_turns: jevShadowTurns.filter((s) => s.available).length,
  decision_count: jevDecisions.length,
  comparable_count: comparableJev.length,
  agreement_rate: comparableJev.length ? comparableJev.filter((d) => d.agreement).length / comparableJev.length : null,
  validity_rate: jevDecisions.length ? validJev.length / jevDecisions.length : null,
  correctness_counts: correctnessCounts,
  deterministic_decision_count: deterministicDecisions.length,
  unknown_decision_count: jevDecisions.filter((d) => d.correctness_outcome === 'undetermined').length,
  high_confidence_threshold: highConfidenceThreshold,
  high_confidence_eligible_decisions: highConfidenceEligible.length,
  observed_correct_high_confidence_decisions: safelyCorrectEligible.length,
  decision_category_metrics: decisionCategoryMetrics,
  average_confidence: mean(jevDecisions.map((d) => d.jev_result?.confidence).filter((v) => typeof v === 'number')),
  average_probability: mean(jevDecisions.map((d) => d.jev_result?.probability).filter((v) => typeof v === 'number')),
  average_latency_ms: mean(jevDecisions.map((d) => d.latency_ms).filter((v) => typeof v === 'number')),
  total_jev_wall_clock_latency_ms: jevShadowTurns.reduce((sum, shadow) => sum + (shadow.total_wall_clock_latency_ms || 0), 0),
  jev_execution_mode: [...new Set(jevShadowTurns.map((shadow) => shadow.usage?.execution_mode).filter(Boolean))],
  estimated_cost_usd: totalJevCost,
  cost_comparison: {
    jev_total_estimated_usd: totalJevCost,
    gpt_director_total_usd: totalDirectorCost,
    gpt_director_cost_sources: [...new Set(record.map((r) => r.director_usage?.source).filter(Boolean))],
    hypothetical_hybrid_usd: hypotheticalHybridCost,
    estimated_savings_percent: totalDirectorCost && hypotheticalHybridCost !== null ? ((totalDirectorCost - hypotheticalHybridCost) / totalDirectorCost) * 100 : null,
    fallback_share: fallbackShare,
    pricing: { jev: jevPricing, gpt_director: directorPricing },
    assumption: 'Hybrid projection allocates the observed Director turn cost linearly across deterministic decisions; this is a planning estimate, not a billing quote.',
  },
  disagreement_cases: comparableJev.filter((d) => d.agreement === false).map((d) => ({
    decision: d.decision, jev: d.jev_result?.value, director: d.director_result?.value, confidence: d.jev_result?.confidence,
  })),
  canary: {
    decision_count: canaryDecisions.length,
    authoritative_count: canaryAuthoritative.length,
    jev_authoritative_count: canaryAuthoritative.length,
    gpt_authoritative_count: canaryGptAuthoritative.length,
    authoritative_accuracy: canaryAuthoritative.length ? canaryAuthoritative.filter((d) => d.jev_correctness === 'correct').length / canaryAuthoritative.length : null,
    fallback_count: canaryDecisions.length - canaryAuthoritative.length,
    fallback_rate: canaryDecisions.length ? (canaryDecisions.length - canaryAuthoritative.length) / canaryDecisions.length : null,
    false_accept_count: falseAccepts.length,
    false_accept_rate: canaryAuthoritative.length ? falseAccepts.length / canaryAuthoritative.length : null,
    false_reject_count: falseRejects.length,
    false_reject_rate: canaryCorrect.length ? falseRejects.length / canaryCorrect.length : null,
    confidence_correct: summarizeConfidence(canaryCorrect),
    confidence_incorrect: summarizeConfidence(canaryIncorrect),
    expected_director_calls: expectedDirectorCalls,
    actual_director_calls: actualDirectorCalls,
    actual_director_calls_avoided: expectedDirectorCalls - actualDirectorCalls,
    jev_cost_usd: canaryJevCost,
    gpt_cost_avoided_usd: gptCostAvoided,
    actual_cost_savings_usd: canaryActualSavings,
    actual_cost_savings_percent: gptCostAvoided ? (canaryActualSavings / gptCostAvoided) * 100 : null,
    average_jev_end_to_end_latency_ms: averageCanaryEndToEndLatency,
    average_director_latency_ms: averageDirectorLatency,
    latency_delta_ms: averageCanaryEndToEndLatency !== null && averageDirectorLatency !== null ? averageCanaryEndToEndLatency - averageDirectorLatency : null,
    gameplay_divergence_count: canaryTurns.filter((turn) => turn.gameplay_outcome?.possible_divergence).length,
    canary_by_family: canaryByFamily,
  },
};
if (!asJson && jevShadowTurns.length > 0) {
  console.log(`JEV SHADOW REPORT: ${JSON.stringify(jevShadowReport)}`);
}
if (resume) {
  const fresh = summarize(await load(await login()));
  const same = fresh === summarize(state);
  console.log(`RESUME: fresh-session reload ${same ? 'MATCHES' : 'DIFFERS from'} live state\n  live : ${summarize(state)}\n  fresh: ${fresh}`);
  const hist = (await load(token)).narrative_focus?.dialogue_history || [];
  console.log(`  dialogue_history entries: ${hist.length}`);
}
const resultPayload = {
  gameId,
  start_state: {
    mechanical_state: initialState.mechanical_state,
    scene_registry: initialState.scene_registry,
  },
  record,
  jevShadowReport,
};
if (outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(resultPayload, null, 2), 'utf8');
  if (!asJson) console.log(`RESULT_WRITTEN: ${outputPath}`);
}
if (asJson) console.log(JSON.stringify(resultPayload, null, 2));
