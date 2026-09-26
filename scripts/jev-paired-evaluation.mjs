#!/usr/bin/env node
/**
 * Compare persisted gameplay outputs from GPT-only control, Jev compare, and
 * Jev skip-GPT runs. Inputs are result files emitted by stonecaster-playtest.
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};

const required = (name) => {
  const value = arg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return JSON.parse(fs.readFileSync(value, 'utf8'));
};

const control = {
  core: required('--control-core'),
  interaction: required('--control-interaction'),
};
const compare = {
  core: required('--compare-core'),
  interaction: required('--compare-interaction'),
};
const skip = {
  core: required('--skip-core'),
  interaction: required('--skip-interaction'),
};
const jevInputRate = Number(process.env.JEV_INPUT_USD_PER_1M_TOKENS);
const jevOutputRate = Number(process.env.JEV_OUTPUT_USD_PER_1M_TOKENS);

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};

function entityMap(payload) {
  const map = new Map();
  const states = [payload.start_state, ...(payload.record || []).map((row) => row.persisted_authoritative_state)];
  let fallbackIndex = 0;
  for (const state of states) {
    for (const [id, entity] of Object.entries(state?.mechanical_state?.entities || {})) {
      const properties = entity?.properties || {};
      const name = properties.display_name || properties.name || entity?.display_name || entity?.name;
      const label = typeof name === 'string' && name.trim()
        ? `ENTITY:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
        : `ENTITY:unknown_${fallbackIndex++}`;
      map.set(id, label);
    }
  }
  return map;
}

function replaceIds(value, map) {
  if (Array.isArray(value)) return value.map((item) => replaceIds(item, map));
  if (!value || typeof value !== 'object') return typeof value === 'string' ? (map.get(value) || value) : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    map.get(key) || key,
    replaceIds(item, map),
  ]));
}

function withoutShadow(intent) {
  if (!intent || typeof intent !== 'object') return intent;
  const clone = JSON.parse(JSON.stringify(intent));
  delete clone.jev_shadow;
  return clone;
}

function persistedState(row) {
  return {
    mechanical_state: row.persisted_authoritative_state?.mechanical_state || null,
    action_queue: row.persisted_authoritative_state?.action_queue || null,
    scene_registry: row.persisted_authoritative_state?.scene_registry || null,
    turn_meta: row.persisted_authoritative_state?.turn_meta || null,
  };
}

function narrative(row) {
  return row.narrative_snapshot || null;
}

function diffPaths(left, right, path = '', output = []) {
  if (output.length >= 20) return output;
  if (JSON.stringify(left) === JSON.stringify(right)) return output;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    output.push(path || '$');
    return output;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of [...keys].sort()) {
    diffPaths(left[key], right[key], `${path}.${key}`, output);
    if (output.length >= 20) break;
  }
  return output;
}

function comparePair(controlPayload, modePayload, mode) {
  const controlMap = entityMap(controlPayload);
  const modeMap = entityMap(modePayload);
  const controlStart = JSON.stringify(stable(replaceIds(controlPayload.start_state, controlMap)));
  const modeStart = JSON.stringify(stable(replaceIds(modePayload.start_state, modeMap)));
  const rows = [];
  const count = Math.min(controlPayload.record.length, modePayload.record.length);
  for (let index = 0; index < count; index += 1) {
    const c = controlPayload.record[index];
    const m = modePayload.record[index];
    const cState = JSON.stringify(stable(replaceIds(persistedState(c), controlMap)));
    const mState = JSON.stringify(stable(replaceIds(persistedState(m), modeMap)));
    const cPersisted = persistedState(c);
    const mPersisted = persistedState(m);
    const cIntent = JSON.stringify(stable(replaceIds(withoutShadow(c.persisted_authoritative_state?.director_intent), controlMap)));
    const mIntent = JSON.stringify(stable(replaceIds(withoutShadow(m.persisted_authoritative_state?.director_intent), modeMap)));
    const cNarrative = JSON.stringify(stable(narrative(c)));
    const mNarrative = JSON.stringify(stable(narrative(m)));
    const stateDivergence = cState !== mState;
    const decisionDivergence = cIntent !== mIntent;
    const narrativeDivergence = cNarrative !== mNarrative;
    const mechanicalStateDivergence = JSON.stringify(stable(replaceIds(cPersisted.mechanical_state, controlMap)))
      !== JSON.stringify(stable(replaceIds(mPersisted.mechanical_state, modeMap)));
    const sceneRegistryDivergence = JSON.stringify(stable(replaceIds(cPersisted.scene_registry, controlMap)))
      !== JSON.stringify(stable(replaceIds(mPersisted.scene_registry, modeMap)));
    const actionQueueDivergence = JSON.stringify(stable(cPersisted.action_queue))
      !== JSON.stringify(stable(mPersisted.action_queue));
    const turnMetaDivergence = JSON.stringify(stable(cPersisted.turn_meta))
      !== JSON.stringify(stable(mPersisted.turn_meta));
    const jevDecisionDivergence = (m.canary?.decisions || []).some((decision) => decision.authority === 'jev' && decision.disagreement === true);
    rows.push({
      turn: index + 1,
      category: m.category,
      control_status: c.status,
      mode_status: m.status,
      mode_turn_failed: m.status >= 300,
      state_comparable: c.status < 300 && m.status < 300,
      state_divergence: stateDivergence,
      mechanical_state_divergence: mechanicalStateDivergence,
      scene_registry_divergence: sceneRegistryDivergence,
      action_queue_divergence: actionQueueDivergence,
      turn_meta_divergence: turnMetaDivergence,
      director_intent_divergence: decisionDivergence,
      decision_divergence: decisionDivergence,
      narrative_divergence: narrativeDivergence,
      narrative_only_divergence: !stateDivergence && !decisionDivergence && narrativeDivergence,
      state_diff_paths: stateDivergence ? diffPaths(JSON.parse(cState), JSON.parse(mState)) : [],
      jev_caused_decision_divergence: jevDecisionDivergence,
      possible_jev_gameplay_divergence: !!m.canary?.gameplay_outcome?.possible_divergence,
      control_intent: c.persisted_authoritative_state?.director_intent || null,
      mode_intent: m.persisted_authoritative_state?.director_intent || null,
    });
  }
  const stateDivergences = rows.filter((row) => row.state_divergence).length;
  const mechanicalStateDivergences = rows.filter((row) => row.mechanical_state_divergence).length;
  const sceneRegistryDivergences = rows.filter((row) => row.scene_registry_divergence).length;
  const actionQueueDivergences = rows.filter((row) => row.action_queue_divergence).length;
  const turnMetaDivergences = rows.filter((row) => row.turn_meta_divergence).length;
  const directorIntentDivergences = rows.filter((row) => row.director_intent_divergence).length;
  const decisionDivergences = rows.filter((row) => row.decision_divergence).length;
  const narrativeOnly = rows.filter((row) => row.narrative_only_divergence).length;
  const failedModeTurns = rows.filter((row) => row.mode_turn_failed).length;
  return {
    mode,
    turns_compared: rows.length,
    control_turns: controlPayload.record.length,
    mode_turns: modePayload.record.length,
    identical_canonical_start_state: controlStart === modeStart,
    paired_state_divergence_count: stateDivergences,
    paired_state_divergence_rate: rows.length ? stateDivergences / rows.length : null,
    paired_mechanical_state_divergence_count: mechanicalStateDivergences,
    paired_mechanical_state_divergence_rate: rows.length ? mechanicalStateDivergences / rows.length : null,
    paired_scene_registry_divergence_count: sceneRegistryDivergences,
    paired_scene_registry_divergence_rate: rows.length ? sceneRegistryDivergences / rows.length : null,
    paired_action_queue_divergence_count: actionQueueDivergences,
    paired_action_queue_divergence_rate: rows.length ? actionQueueDivergences / rows.length : null,
    paired_turn_meta_divergence_count: turnMetaDivergences,
    paired_turn_meta_divergence_rate: rows.length ? turnMetaDivergences / rows.length : null,
    paired_state_divergence_rate_successful_turns: rows.filter((row) => row.state_comparable).length
      ? rows.filter((row) => row.state_comparable && row.state_divergence).length / rows.filter((row) => row.state_comparable).length
      : null,
    paired_decision_divergence_count: decisionDivergences,
    paired_decision_divergence_rate: rows.length ? decisionDivergences / rows.length : null,
    paired_director_intent_divergence_count: directorIntentDivergences,
    paired_director_intent_divergence_rate: rows.length ? directorIntentDivergences / rows.length : null,
    paired_narrative_only_divergence_count: narrativeOnly,
    paired_narrative_only_divergence_rate: rows.length ? narrativeOnly / rows.length : null,
    failed_mode_turn_count: failedModeTurns,
    jev_caused_decision_divergence_count: rows.filter((row) => row.jev_caused_decision_divergence).length,
    possible_jev_gameplay_divergence_count: rows.filter((row) => row.possible_jev_gameplay_divergence).length,
    turns: rows,
  };
}

const aggregateCanary = (payloads) => {
  const decisions = payloads.flatMap((payload) => payload.record.flatMap((row) => row.canary?.decisions || []));
  const canaryRows = payloads.flatMap((payload) => payload.record.filter((row) => row.canary));
  const canaryTurns = canaryRows.map((row) => row.canary);
  const jevWallClock = canaryRows.map((row) => row.intent?.jev_shadow?.total_wall_clock_latency_ms).filter((value) => typeof value === 'number');
  const jev = decisions.filter((decision) => decision.authority === 'jev');
  const gpt = decisions.filter((decision) => decision.authority === 'primary');
  const known = decisions.filter((decision) => ['correct', 'wrong'].includes(decision.jev_correctness));
  const correct = known.filter((decision) => decision.jev_correctness === 'correct');
  const incorrect = known.filter((decision) => decision.jev_correctness === 'wrong');
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const confidence = (items) => items.map((item) => item.confidence).filter((value) => typeof value === 'number');
  const inferredCost = (row) => {
    if (typeof row.canary.jev_cost_usd === 'number') return row.canary.jev_cost_usd;
    const usage = row.intent?.jev_shadow?.usage;
    if (!usage || !Number.isFinite(jevInputRate) || !Number.isFinite(jevOutputRate)) return null;
    return ((usage.estimated_input_tokens || 0) / 1_000_000) * jevInputRate
      + ((usage.estimated_output_tokens || 0) / 1_000_000) * jevOutputRate;
  };
  const costs = canaryRows.map(inferredCost).filter((value) => typeof value === 'number');
  const avoided = canaryTurns.map((turn) => turn.gpt_cost_avoided_usd).filter((value) => typeof value === 'number');
  const cost = costs.length === canaryTurns.length ? costs.reduce((sum, value) => sum + value, 0) : null;
  const avoidedCost = avoided.length === canaryTurns.length ? avoided.reduce((sum, value) => sum + value, 0) : null;
  const falseAcceptCount = jev.filter((decision) => decision.jev_correctness === 'wrong').length;
  const falseRejectCount = decisions.filter((decision) => !decision.authoritative && decision.jev_correctness === 'correct').length;
  const byFamily = Object.fromEntries(['action_classification', 'feasibility'].map((family) => {
    const familyDecisions = decisions.filter((decision) => decision.family === family);
    const authoritative = familyDecisions.filter((decision) => decision.authority === 'jev');
    const knownCorrect = familyDecisions.filter((decision) => decision.jev_correctness === 'correct');
    const familyFalseAcceptCount = authoritative.filter((decision) => decision.jev_correctness === 'wrong').length;
    const familyFalseRejectCount = familyDecisions.filter((decision) => decision.authority !== 'jev' && decision.jev_correctness === 'correct').length;
    return [family, {
      count: familyDecisions.length,
      jev_authoritative_count: authoritative.length,
      fallback_count: familyDecisions.length - authoritative.length,
      fallback_rate: familyDecisions.length ? (familyDecisions.length - authoritative.length) / familyDecisions.length : null,
      accuracy: authoritative.length ? authoritative.filter((decision) => decision.jev_correctness === 'correct').length / authoritative.length : null,
      false_accept_count: familyFalseAcceptCount,
      false_accept_rate: authoritative.length ? familyFalseAcceptCount / authoritative.length : null,
      false_reject_count: familyFalseRejectCount,
      false_reject_rate: knownCorrect.length ? familyFalseRejectCount / knownCorrect.length : null,
      known_correct_count: knownCorrect.length,
    }];
  }));
  return {
    turns: canaryTurns.length,
    decisions: decisions.length,
    jev_authoritative_count: jev.length,
    gpt_authoritative_count: gpt.length,
    authoritative_accuracy: jev.length ? jev.filter((decision) => decision.jev_correctness === 'correct').length / jev.length : null,
    fallback_rate: decisions.length ? gpt.length / decisions.length : null,
    false_accept_count: falseAcceptCount,
    false_accept_rate: jev.length ? falseAcceptCount / jev.length : null,
    false_reject_count: falseRejectCount,
    false_reject_rate: known.filter((decision) => decision.jev_correctness === 'correct').length
      ? falseRejectCount / known.filter((decision) => decision.jev_correctness === 'correct').length
      : null,
    confidence_correct: { count: confidence(correct).length, average: mean(confidence(correct)) },
    confidence_incorrect: { count: confidence(incorrect).length, average: mean(confidence(incorrect)) },
    director_calls_avoided: canaryTurns.filter((turn) => !turn.gpt_director_ran).length,
    expected_director_calls: canaryTurns.length,
    jev_cost_usd: cost,
    gpt_cost_avoided_usd: avoidedCost,
    cost_savings_usd: avoidedCost === null || cost === null ? null : avoidedCost - cost,
    average_jev_end_to_end_latency_ms: mean(canaryTurns.map((turn) => turn.end_to_end_latency_ms).filter((value) => typeof value === 'number')),
    average_jev_batch_wall_clock_latency_ms: mean(jevWallClock),
    total_jev_batch_wall_clock_latency_ms: jevWallClock.reduce((sum, value) => sum + value, 0),
    by_family: byFamily,
    control_gpt_cost_usd: payloads.reduce((sum, payload) => sum + payload.record.reduce((subtotal, row) => subtotal + (row.director_usage?.cost_usd || 0), 0), 0),
    jev_pricing_configured: Number.isFinite(jevInputRate) && Number.isFinite(jevOutputRate),
  };
};

const output = {
  core: {
    compare: comparePair(control.core, compare.core, 'compare'),
    skip_gpt: comparePair(control.core, skip.core, 'skip_gpt'),
  },
  interaction: {
    compare: comparePair(control.interaction, compare.interaction, 'compare'),
    skip_gpt: comparePair(control.interaction, skip.interaction, 'skip_gpt'),
  },
  canary: {
    compare: aggregateCanary([compare.core, compare.interaction]),
    skip_gpt: aggregateCanary([skip.core, skip.interaction]),
  },
};
if (argv.includes('--summary')) {
  for (const suite of Object.values(output)) {
    for (const pair of Object.values(suite)) {
      if (pair && typeof pair === 'object' && Array.isArray(pair.turns)) delete pair.turns;
    }
  }
}
console.log(JSON.stringify(output, null, 2));
