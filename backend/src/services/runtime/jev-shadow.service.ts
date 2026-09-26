// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Jev shadow-mode evaluation for the Director.
 *
 * Jev is an SDK-backed observer by default. An explicit canary configuration may allow only
 * validated action-classification and feasibility answers to constrain a typed Director intent;
 * Jev never mutates state and the deterministic Engine remains the gameplay authority.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DirectorUnifiedIntentSchema, type DirectorUnifiedIntent, type GameState } from '@shared/types/chimera-runtime';
import { choice, TypeSafeClient, type EntryType, type Questions } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { entityDisplayName, presentEntityIds, readSceneEntities } from './scene-context.js';

export const JEV_DECISION_IDS = {
  action: 'action_classification',
  engine: 'requires_engine_resolution',
  feasibility: 'feasibility',
  target: 'primary_target_selection',
  impact: 'impact_magnitude',
} as const;

export type JevCanaryDecisionFamily = 'action_classification' | 'feasibility';
export type JevAuthority = 'jev' | 'primary' | 'deterministic' | 'none';

export interface JevCanaryConfig {
  action_classification: boolean;
  feasibility: boolean;
  confidence_threshold: number;
  compare: boolean;
  skip_gpt: boolean;
  baseline_gpt_cost_usd: number | null;
}

export interface JevCanaryDecisionTelemetry {
  family: JevCanaryDecisionFamily;
  jev_value: string | null;
  confidence: number | null;
  schema_valid: boolean;
  deterministic_valid: boolean;
  deterministic_ground_truth_source: DeterministicGroundTruth['source'] | null;
  jev_correctness: Correctness;
  confidence_valid: boolean;
  authoritative: boolean;
  authority: JevAuthority;
  fallback_reason: string | null;
  director_value: string | null;
  disagreement: boolean | null;
}

export interface JevCanaryTelemetry {
  enabled: boolean;
  compare_mode: boolean;
  gpt_director_ran: boolean;
  primary_model_called: boolean;
  final_authority: JevAuthority;
  fallback_occurred: boolean;
  jev_authoritative: boolean;
  decisions: JevCanaryDecisionTelemetry[];
  fallback_reason: string | null;
  disagreement: boolean | null;
  jev_cost_usd: number | null;
  gpt_cost_avoided_usd: number | null;
  end_to_end_latency_ms: number | null;
  gameplay_outcome?: {
    success: boolean | null;
    state_updated: boolean | null;
    delta_keys: string[];
    outcome_summary: string | null;
    possible_divergence: boolean;
  };
}

export interface JevCanaryApplication {
  intent: DirectorUnifiedIntent | null;
  telemetry: JevShadowTelemetry;
  fallback_reason: string | null;
}

export const ACTION_LABELS = ['observation', 'social_action', 'combat_action', 'rest_action', 'eat_action', 'navigate', 'attempt_action'] as const;
export const IMPACT_LABELS = ['Low', 'Moderate', 'High', 'Severe'] as const;
const ENGINE_TRIGGER_TO_ACTION: Record<string, string> = {
  combat_action: 'resolve_clash',
  social_action: 'apply_relationship_delta',
  rest_action: 'take_rest',
  eat_action: 'consume_food',
  attempt_action: 'attempt_action',
  navigate: 'navigate',
};

type ChoiceLabel = string;

export interface JevQuestion {
  id: string;
  question: string;
  options: Record<string, string>;
}

export interface JevDecisionRequest {
  state: Record<string, unknown>;
  questions: JevQuestion[];
}

export interface JevChoiceAnswer {
  type?: string;
  choice?: ChoiceLabel;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JevRunnerResponse {
  answers: Record<string, JevChoiceAnswer>;
  latency_ms: number;
  usage?: JevRunnerUsage;
}

const JevChoiceAnswerSchema = z.object({
  type: z.string().optional(),
  choice: z.string().optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
  probabilities: z.record(z.number().finite().min(0).max(1)).optional(),
}).passthrough();

const JevAnswersSchema = z.record(JevChoiceAnswerSchema);

const JevRunnerUsageSchema = z.object({
  request_chars: z.number().int().nonnegative(),
  response_chars: z.number().int().nonnegative(),
  estimated_input_tokens: z.number().int().nonnegative(),
  estimated_output_tokens: z.number().int().nonnegative(),
  estimated_total_tokens: z.number().int().nonnegative(),
  decision_count: z.number().int().nonnegative(),
  decision_types: z.array(z.string()),
  model: z.string().nullable(),
  model_version: z.string().nullable(),
  command: z.string(),
  execution_mode: z.literal('single_batched_request'),
}).passthrough();

const JevRunnerResponseSchema = z.object({
  answers: JevAnswersSchema,
  latency_ms: z.number().finite().nonnegative(),
  usage: JevRunnerUsageSchema.optional(),
}).passthrough();

/** Parse and validate the answer map emitted by `jev.cmd decide --file`. */
export function parseJevAnswersJson(responseText: string): Record<string, JevChoiceAnswer> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error('Jev response was not valid JSON');
  }
  const result = JevAnswersSchema.safeParse(parsed);
  if (!result.success) throw new Error('Jev response schema was invalid');
  return result.data;
}

function validateJevRunnerResponse(response: unknown): JevRunnerResponse {
  const result = JevRunnerResponseSchema.safeParse(response);
  if (!result.success) throw new Error('Jev runner response schema was invalid');
  return response as JevRunnerResponse;
}

export interface JevRunner {
  decide(request: JevDecisionRequest): Promise<JevRunnerResponse>;
}

export interface JevRunnerUsage {
  request_chars: number;
  response_chars: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  decision_count: number;
  decision_types: string[];
  model: string | null;
  model_version: string | null;
  command: string;
  execution_mode: 'single_batched_request';
}

export interface JevPricingMetadata {
  currency: 'USD';
  input_usd_per_1m_tokens: number | null;
  output_usd_per_1m_tokens: number | null;
  source: 'environment' | 'default' | 'unset';
}

export type Correctness = 'correct' | 'wrong' | 'unknown';
export type CorrectnessOutcome =
  | 'director_correct_jev_correct'
  | 'director_correct_jev_wrong'
  | 'director_wrong_jev_correct'
  | 'both_wrong'
  | 'undetermined';

export interface DeterministicGroundTruth {
  source: 'deterministic' | 'engine_rules' | 'not_applicable' | 'unknown';
  value: string | null;
  allowed_values: string[];
  reasons: string[];
}

export interface EngineCapability {
  trigger_id: string;
  action_slug: string;
  registered: boolean;
  requires_engine: boolean | null;
  impact_applicable: boolean;
  uses_d100: boolean;
  has_resource_effect: boolean;
  reasons: string[];
}

export interface JevDecisionObservation {
  decision: string;
  decision_type: string;
  jev_result: {
    value: string | null;
    confidence: number | null;
    probability: number | null;
  };
  director_result: {
    value: string | null;
    details?: Record<string, unknown>;
  };
  agreement: boolean | null;
  deterministic_ground_truth: DeterministicGroundTruth;
  director_correctness: Correctness;
  jev_correctness: Correctness;
  correctness_outcome: CorrectnessOutcome;
  director_validity: {
    valid: boolean;
    reasons: string[];
  };
  engine_validity: {
    valid: boolean;
    reasons: string[];
  };
  latency_ms: number | null;
  latency_scope: 'batched_request' | 'unavailable';
  estimated_cost_usd: number | null;
  status: 'ok' | 'unavailable' | 'invalid';
  error?: string;
}

export interface JevShadowReport {
  decision_count: number;
  comparable_count: number;
  agreements: number;
  agreement_rate: number | null;
  valid_count: number;
  validity_rate: number | null;
  average_confidence: number | null;
  average_probability: number | null;
  average_latency_ms: number | null;
  total_wall_clock_latency_ms: number | null;
  estimated_cost_usd: number | null;
  correctness_counts: Record<CorrectnessOutcome, number>;
  deterministic_decision_count: number;
  unknown_decision_count: number;
  decision_type_counts: Record<string, number>;
  disagreement_cases: Array<{
    decision: string;
    jev: string | null;
    director: string | null;
    confidence: number | null;
  }>;
}

export interface JevShadowTelemetry {
  version: 1;
  mode: 'shadow' | 'canary';
  provider: 'typesafe/jev';
  enabled: boolean;
  available: boolean;
  attempted: boolean;
  succeeded: boolean;
  schema_valid: boolean;
  deterministic_validation_passed: boolean;
  fallback_occurred: boolean;
  primary_model_called: boolean;
  final_authority: JevAuthority;
  batch_latency_ms: number | null;
  total_wall_clock_latency_ms: number | null;
  usage: (JevRunnerUsage & { pricing: JevPricingMetadata; estimated_cost_usd: number | null }) | null;
  decisions: JevDecisionObservation[];
  report: JevShadowReport;
  canary?: JevCanaryTelemetry;
  error?: string;
}

interface SceneEntity {
  id: string;
  name: string;
  type: string;
  status: string;
  properties: Record<string, unknown>;
}

const truthy = (value: string | undefined): boolean => ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());

export function isJevShadowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return truthy(env.JEV_SHADOW_MODE);
}

function confidenceThreshold(value: string | undefined, fallback = 0.8): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function readJevCanaryConfig(env: NodeJS.ProcessEnv = process.env): JevCanaryConfig {
  const baselineCost = Number(env.JEV_CANARY_BASELINE_GPT_COST_USD);
  return {
    action_classification: truthy(env.JEV_CANARY_ACTION_CLASSIFICATION),
    feasibility: truthy(env.JEV_CANARY_FEASIBILITY),
    confidence_threshold: confidenceThreshold(env.JEV_CANARY_CONFIDENCE_THRESHOLD || env.JEV_HIGH_CONFIDENCE_THRESHOLD),
    compare: env.JEV_CANARY_COMPARE === undefined ? true : truthy(env.JEV_CANARY_COMPARE),
    skip_gpt: truthy(env.JEV_CANARY_SKIP_GPT),
    baseline_gpt_cost_usd: Number.isFinite(baselineCost) && baselineCost >= 0 ? baselineCost : null,
  };
}

export function isJevCanaryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = readJevCanaryConfig(env);
  return config.action_classification || config.feasibility;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function estimateTokens(text: string): number {
  return Math.ceil(Array.from(text).length / 4);
}

function finitePrice(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function readJevPricing(env: NodeJS.ProcessEnv = process.env): JevPricingMetadata {
  const inputFromEnv = finitePrice(env.JEV_INPUT_USD_PER_1M_TOKENS);
  const outputFromEnv = finitePrice(env.JEV_OUTPUT_USD_PER_1M_TOKENS);
  const input = inputFromEnv ?? 0.042;
  const output = outputFromEnv ?? 0;
  return {
    currency: 'USD',
    input_usd_per_1m_tokens: input,
    output_usd_per_1m_tokens: output,
    source: inputFromEnv !== null || outputFromEnv !== null ? 'environment' : 'default',
  };
}

function estimateCost(usage: JevRunnerUsage, pricing: JevPricingMetadata): number | null {
  if (pricing.input_usd_per_1m_tokens === null || pricing.output_usd_per_1m_tokens === null) return null;
  return round(
    usage.estimated_input_tokens / 1_000_000 * pricing.input_usd_per_1m_tokens
      + usage.estimated_output_tokens / 1_000_000 * pricing.output_usd_per_1m_tokens,
  );
}

function describeEntity(entity: SceneEntity): Record<string, unknown> {
  const props = entity.properties;
  const traits = Array.isArray(props.traits) ? props.traits.slice(0, 8) : undefined;
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    entity_status: entity.status,
    traits,
    status: props.status,
    hp: props.hp,
    current_stamina: props.current_stamina,
    relationship_to_player: props.relationships,
  };
}

function sceneEntities(gameState: GameState): { entities: SceneEntity[]; playerId?: string } {
  const { entities, playerId } = readSceneEntities(gameState);
  const present = new Set(presentEntityIds(gameState));
  return {
    playerId,
    entities: Object.entries(entities)
      .filter(([id]) => present.has(id))
      .map(([id, entity]) => ({
        id,
        name: entityDisplayName(entity, id),
        type: String(entity?.type || 'NPC'),
        status: String(entity?.status || entity?.properties?.status || 'active'),
        properties: (entity?.properties || {}) as Record<string, unknown>,
      })),
  };
}

function eligibleNpc(entity: SceneEntity): boolean {
  return entity.type === 'NPC' && !['dead', 'incapacitated', 'inactive'].includes(entity.status.toLowerCase());
}

function parseActionDefinition(actionDef: unknown): Record<string, unknown> | null {
  if (!actionDef) return null;
  if (typeof actionDef === 'string') {
    try {
      const parsed = JSON.parse(actionDef);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : { logic: actionDef };
    } catch {
      return { logic: actionDef };
    }
  }
  return typeof actionDef === 'object' ? actionDef as Record<string, unknown> : null;
}

export function engineCapabilityFor(
  triggerId: string,
  actionsMap: Record<string, unknown>,
  targetCount = 0,
): EngineCapability {
  const actionSlug = ENGINE_TRIGGER_TO_ACTION[triggerId] || triggerId;
  const action = parseActionDefinition(actionsMap[actionSlug]);
  if (!action) {
    return {
      trigger_id: triggerId,
      action_slug: actionSlug,
      registered: false,
      requires_engine: null,
      impact_applicable: false,
      uses_d100: false,
      has_resource_effect: false,
      reasons: [`No registered Engine action for ${actionSlug}`],
    };
  }
  const steps = Array.isArray(action.logic) ? action.logic : [];
  const hasResourceEffect = steps.some((step) => {
    const candidate = step as Record<string, unknown>;
    const args = (candidate.args || {}) as Record<string, unknown>;
    return candidate.function === 'state.modify' && typeof args.path === 'string'
      && (args.path.startsWith('tier1_entity.') || args.path.startsWith('relationships.'));
  }) || Object.values((action.deltas || {}) as Record<string, unknown>).some((value) => typeof value === 'number');
  const usesD100 = triggerId === 'combat_action' || triggerId === 'attempt_action' || action.resolution_type === 'd100';
  const movement = triggerId === 'navigate';
  const requiresEngine = usesD100 || hasResourceEffect || movement || triggerId === 'rest_action' || triggerId === 'eat_action'
    || (triggerId === 'social_action' && targetCount > 0);
  return {
    trigger_id: triggerId,
    action_slug: actionSlug,
    registered: true,
    requires_engine: requiresEngine,
    impact_applicable: usesD100 && targetCount > 0,
    uses_d100: usesD100,
    has_resource_effect: hasResourceEffect,
    reasons: [
      `Registered action ${actionSlug}`,
      ...(usesD100 ? ['uses D100 resolution'] : []),
      ...(hasResourceEffect ? ['contains resource/relationship state effects'] : []),
      ...(movement ? ['changes scene presence/location'] : []),
    ],
  };
}

const ACTION_PATTERNS: Array<[string, RegExp]> = [
  ['combat_action', /\b(attack|attacks|attacked|fight|fights|fought|strike|strikes|stab|stabs|hit|hits|punch|shoot|shoots|kick|kicks|defend|defends|brace|braces|counterattack)\b/i],
  ['social_action', /\b(ask|asks|tell|tells|talk|talks|speak|speaks|greet|greets|persuade|persuades|threaten|threatens|flirt|flirts|compliment|compliments|insult|insults|confide)\b/i],
  ['rest_action', /\b(rest|rests|sleep|sleeps|camp|camps|sit down|catch (?:my|a) breath|recover)\b/i],
  ['eat_action', /\b(eat|eats|ate|drink|drinks|drank|consume|consumes|food|water|hungry|thirsty)\b/i],
  ['navigate', /\b(go|goes|went|travel|travels|leave|leaves|enter|enters|head|heads|move|moves|walk|walks|return|returns|north|south|east|west)\b/i],
  ['observation', /\b(look|looks|observe|observes|watch|watches|listen|listens|see|sees|notice|notices|describe|what is happening)\b/i],
  ['attempt_action', /\b(try|tries|attempt|attempts|search|searches|climb|climbs|sneak|sneaks|pick|picks|open|opens|unlock|unlocks|solve|solves|use|uses|grab|grabs|examine|examines|inspect|inspects|hide|hides|clever)\b/i],
];

export function classifyInputAction(userInput: string): string | null {
  return ACTION_PATTERNS.find(([, pattern]) => pattern.test(userInput))?.[0] || null;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function entityAliases(entity: SceneEntity): string[] {
  const props = entity.properties;
  const values = [
    entity.name,
    typeof props.visual_name === 'string' ? props.visual_name : '',
    typeof props.archetype === 'string' ? props.archetype : '',
    entity.type,
    ...(Array.isArray(props.occupation_tags) ? props.occupation_tags.filter((value): value is string => typeof value === 'string') : []),
  ];
  return [...new Set(values.map(normalized).filter((value) => value.length > 2))];
}

function inputMentionsEntity(userInput: string, entity: SceneEntity): boolean {
  const input = normalized(userInput);
  return entityAliases(entity).some((alias) => {
    if (input.includes(alias)) return true;
    const words = alias.split(' ').filter((word) => word.length > 2 && !['the', 'a', 'an'].includes(word));
    return words.length > 0 && words.every((word) => input.split(' ').includes(word));
  });
}

function targetGroundTruth(userInput: string, action: string | null, npcs: SceneEntity[]): DeterministicGroundTruth {
  const eligible = npcs.filter(eligibleNpc);
  const mentioned = eligible.filter((entity) => inputMentionsEntity(userInput, entity));
  if (mentioned.length === 1) {
    return { source: 'deterministic', value: mentioned[0].id, allowed_values: [mentioned[0].id], reasons: [`Input names present eligible NPC ${mentioned[0].name}`] };
  }
  if (mentioned.length > 1) {
    return { source: 'unknown', value: null, allowed_values: mentioned.map((entity) => entity.id), reasons: ['Input names multiple eligible NPCs; deterministic validator cannot choose a single primary target'] };
  }
  const genericTarget = /\b(someone|somebody|anyone|an enemy|the enemy|a guard|the guard|a constable|the constable|the bartender|a person)\b/i.test(userInput);
  if (genericTarget && eligible.length === 1) {
    return { source: 'deterministic', value: eligible[0].id, allowed_values: [eligible[0].id], reasons: ['Input uses an unnamed target and exactly one eligible NPC is present'] };
  }
  if (genericTarget || (action && ['social_action', 'combat_action', 'attempt_action'].includes(action) && eligible.length > 1)) {
    return { source: 'unknown', value: null, allowed_values: [...eligible.map((entity) => entity.id), 'none'], reasons: ['A target is implied but no unique eligible entity can be selected deterministically'] };
  }
  if (!action || ['observation', 'rest_action', 'eat_action', 'navigate'].includes(action)) {
    return { source: 'deterministic', value: 'none', allowed_values: ['none'], reasons: ['Action category does not address a target'] };
  }
  return { source: 'unknown', value: null, allowed_values: [...eligible.map((entity) => entity.id), 'none'], reasons: ['No target signal was found in the input'] };
}

function knownPlayerTokens(player: SceneEntity | undefined): string[] {
  if (!player) return [];
  const values: unknown[] = [];
  for (const key of ['abilities', 'capabilities', 'powers', 'skills', 'inventory', 'items', 'possessions', 'traits']) {
    const value = player.properties[key];
    if (Array.isArray(value)) values.push(...value);
    else if (value !== undefined) values.push(value);
  }
  return normalized(values.map((value) => String(value)).join(' ')).split(' ').filter(Boolean);
}

function feasibilityGroundTruth(userInput: string, action: string | null, player: SceneEntity | undefined): DeterministicGroundTruth {
  const input = normalized(userInput);
  const capabilityTokens = knownPlayerTokens(player);
  const hasCapability = (terms: string[]) => terms.some((term) => capabilityTokens.includes(term));
  const impossibleWithoutCapability: Array<[RegExp, string[]]> = [
    [/\b(fly|flying|levitate|teleport|teleportation)\b/i, ['fly', 'flying', 'teleport', 'levitation']],
    [/\b(mind control|control their mind|read minds|summon|conjure|create gold|create money|make everyone|rewrite reality)\b/i, ['mind control', 'summon', 'conjure']],
  ];
  for (const [pattern, capabilities] of impossibleWithoutCapability) {
    if (pattern.test(input) && !hasCapability(capabilities)) {
      return { source: 'deterministic', value: 'impossible', allowed_values: ['impossible'], reasons: [`Input requests unsupported capability: ${capabilities.join(', ')}`] };
    }
  }
  const inventoryKnown = ['inventory', 'items', 'possessions'].some((key) => player?.properties[key] !== undefined);
  const inventoryText = normalized(['inventory', 'items', 'possessions'].map((key) => player?.properties[key]).filter(Boolean).join(' '));
  if (inventoryKnown && /\b(eat|consume|drink)\b/i.test(input) && !/\b(food|water|meal|bread|ration|drink)\b/i.test(inventoryText)) {
    return { source: 'deterministic', value: 'impossible', allowed_values: ['impossible'], reasons: ['Input consumes food/drink but the known inventory has no matching resource'] };
  }
  if (action) return { source: 'deterministic', value: 'possible', allowed_values: ['possible'], reasons: ['Action is within the known ordinary action set and no deterministic capability/resource violation was found'] };
  return { source: 'unknown', value: null, allowed_values: ['possible', 'impossible'], reasons: ['No deterministic action category was recognized'] };
}

function actionGroundTruth(userInput: string, action: string | null): DeterministicGroundTruth {
  return action
    ? { source: 'deterministic', value: action, allowed_values: [action], reasons: [`Input matched deterministic action pattern for ${action}`] }
    : { source: 'unknown', value: null, allowed_values: [...ACTION_LABELS], reasons: ['No supported action pattern matched the input'] };
}

function impactGroundTruth(action: string | null, capability: EngineCapability): DeterministicGroundTruth {
  if (!capability.impact_applicable || !['combat_action', 'attempt_action'].includes(action || '')) {
    return { source: 'not_applicable', value: null, allowed_values: [], reasons: ['The registered Engine capability has no tiered impact output for this action'] };
  }
  return { source: 'engine_rules', value: null, allowed_values: [...IMPACT_LABELS], reasons: ['The Engine accepts every schema-valid impact tier; exact magnitude remains semantic and is not forced by deterministic rules'] };
}

function reactionGroundTruth(action: string | null, npc: SceneEntity): DeterministicGroundTruth {
  const eligible = eligibleNpc(npc) && ['social_action', 'combat_action', 'attempt_action'].includes(action || '');
  return {
    source: 'deterministic',
    value: eligible ? 'eligible' : 'not_eligible',
    allowed_values: [eligible ? 'eligible' : 'not_eligible'],
    reasons: eligible ? ['NPC is present, active, and the action can address or affect an NPC'] : ['NPC is absent/ineligible or the action does not create a reaction candidate'],
  };
}

function normalizeTargetValue(value: string | null): string | null {
  return value === 'no_known_entity' ? 'none' : value;
}

function decisionTypeFor(id: string): string {
  return id.startsWith('npc_reaction_') ? 'npc_reaction' : id;
}

function correctnessFor(value: string | null, truth: DeterministicGroundTruth, validity: { valid: boolean }): Correctness {
  if (!validity.valid) return 'wrong';
  if (truth.source === 'unknown' || truth.source === 'not_applicable') return 'unknown';
  const normalizedValue = normalizeTargetValue(value);
  if (truth.value !== null) return normalizedValue === truth.value ? 'correct' : 'wrong';
  return truth.allowed_values.length > 0 && normalizedValue !== null && truth.allowed_values.includes(normalizedValue) ? 'correct' : 'wrong';
}

function correctnessOutcome(director: Correctness, jev: Correctness): CorrectnessOutcome {
  if (director === 'unknown' || jev === 'unknown') return 'undetermined';
  if (director === 'correct' && jev === 'correct') return 'director_correct_jev_correct';
  if (director === 'correct' && jev === 'wrong') return 'director_correct_jev_wrong';
  if (director === 'wrong' && jev === 'correct') return 'director_wrong_jev_correct';
  return 'both_wrong';
}

function canaryFamilyDecision(
  telemetry: JevShadowTelemetry,
  family: JevCanaryDecisionFamily,
  threshold: number,
  directorValue: string | null = null,
): JevCanaryDecisionTelemetry {
  const decision = telemetry.decisions.find((candidate) => candidate.decision === family);
  const schemaValid = decision?.status === 'ok' && decision.engine_validity.valid;
  const deterministicValid = !!decision
    && ['deterministic', 'engine_rules'].includes(decision.deterministic_ground_truth.source)
    && decision.jev_correctness === 'correct';
  const confidence = decision?.jev_result.confidence ?? null;
  const confidenceValid = confidence !== null && confidence >= threshold;
  const reasons: string[] = [];
  if (!decision) reasons.push('Jev did not return this decision family');
  if (decision && !schemaValid) reasons.push(...decision.engine_validity.reasons);
  if (decision && !deterministicValid) reasons.push('Deterministic validator did not accept the Jev value');
  if (!confidenceValid) reasons.push(`Confidence ${confidence ?? 'missing'} is below threshold ${threshold}`);
  const authoritative = schemaValid && deterministicValid && confidenceValid;
  return {
    family,
    jev_value: decision?.jev_result.value ?? null,
    confidence,
    schema_valid: schemaValid,
    deterministic_valid: deterministicValid,
    deterministic_ground_truth_source: decision?.deterministic_ground_truth.source ?? null,
    jev_correctness: decision?.jev_correctness ?? 'unknown',
    confidence_valid: confidenceValid,
    authoritative,
    fallback_reason: authoritative ? null : reasons.join('; '),
    director_value: directorValue,
    disagreement: decision && directorValue !== null && decision.jev_result.value !== null
      ? decision.jev_result.value !== directorValue
      : null,
  };
}

function canaryDecisionMap(telemetry: JevShadowTelemetry, config: JevCanaryConfig, directorIntent?: DirectorUnifiedIntent): JevCanaryDecisionTelemetry[] {
  const primary = primaryDirectorValues(directorIntent);
  const decisions: JevCanaryDecisionTelemetry[] = [];
  const add = (family: JevCanaryDecisionFamily) => {
    const decision = canaryFamilyDecision(telemetry, family, config.confidence_threshold, primary[family === 'action_classification' ? 'action' : 'feasibility']);
    decisions.push({
      ...decision,
      authority: decision.authoritative ? 'jev' : (directorIntent ? 'primary' : 'none'),
    });
  };
  if (config.action_classification) {
    add('action_classification');
  }
  if (config.feasibility) {
    add('feasibility');
  }
  return decisions;
}

const CANARY_VERBS: Record<string, string> = {
  observation: 'observe',
  social_action: 'speak',
  combat_action: 'attack',
  rest_action: 'rest',
  eat_action: 'eat',
  navigate: 'travel',
  attempt_action: 'attempt',
};

function applyCanaryFields(
  intent: DirectorUnifiedIntent,
  decisions: JevCanaryDecisionTelemetry[],
  playerId: string | undefined,
): DirectorUnifiedIntent {
  let next = intent;
  const action = decisions.find((decision) => decision.family === 'action_classification' && decision.authoritative)?.jev_value;
  const feasibility = decisions.find((decision) => decision.family === 'feasibility' && decision.authoritative)?.jev_value;
  if (action && ACTION_LABELS.includes(action as typeof ACTION_LABELS[number])) {
    if (action === 'observation') {
      next = {
        ...next,
        turn_meta: { ...next.turn_meta, resolution_mode: 'narrative' },
        intent_queue: [],
        unseen_ripples: [],
      };
    } else {
      const queue = [...next.intent_queue];
      if (queue.length > 0) {
        queue[0] = {
          ...queue[0],
          trigger_id: action,
          parameters: { ...queue[0].parameters, verb: queue[0].parameters.verb || CANARY_VERBS[action] },
        };
      } else if (playerId) {
        queue.push({
          actor_id: playerId,
          trigger_id: action,
          intended_targets: [],
          proximity_cluster: [],
          parameters: { verb: CANARY_VERBS[action] || 'attempt' },
        });
      }
      next = { ...next, intent_queue: queue };
    }
  }
  if (feasibility === 'possible' || feasibility === 'impossible') {
    next = {
      ...next,
      turn_meta: {
        ...next.turn_meta,
        feasibility,
        ...(feasibility === 'impossible' ? { resolution_mode: 'narrative' as const } : {}),
      },
      ...(feasibility === 'impossible' ? { intent_queue: [], unseen_ripples: [] } : {}),
    };
  }
  return DirectorUnifiedIntentSchema.parse(next);
}

function primaryDirectorValues(intent: DirectorUnifiedIntent | undefined, playerId?: string) {
  if (!intent) {
    return {
      action: null,
      engine: null,
      feasibility: null,
      target: null,
      impact: null,
      primary_target: null,
      reaction_actors: [] as string[],
    };
  }
  const first = intent.intent_queue[0];
  const primaryTarget = first?.intended_targets[0] || null;
  const reactionActors = intent.intent_queue
    .slice(1)
    .map((entry: { actor_id: string }) => entry.actor_id)
    .filter((id: string) => id !== playerId);
  return {
    action: first?.trigger_id || (intent.turn_meta.resolution_mode === 'narrative' ? 'observation' : 'attempt_action'),
    engine: intent.turn_meta.resolution_mode === 'engine' ? 'yes' : 'no',
    feasibility: intent.turn_meta.feasibility || 'possible',
    target: primaryTarget || 'none',
    impact: first?.parameters.impact_tier || null,
    primary_target: primaryTarget,
    reaction_actors: reactionActors,
  };
}

function boundedProbability(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function choiceAnswer(answer: JevChoiceAnswer | undefined): { value: string | null; confidence: number | null; probability: number | null } {
  const value = typeof answer?.choice === 'string' ? answer.choice : null;
  return {
    value,
    confidence: boundedProbability(answer?.confidence),
    probability: value && answer?.probabilities ? boundedProbability(answer.probabilities[value]) : null,
  };
}

function baseValidity(value: string | null, options: readonly string[]): { valid: boolean; reasons: string[] } {
  if (!value) return { valid: false, reasons: ['Jev did not return a choice'] };
  if (!options.some((option) => option === value)) return { valid: false, reasons: [`Choice "${value}" is outside the allowed schema`] };
  return { valid: true, reasons: [] };
}

export function buildJevComparisonReport(
  decisions: JevDecisionObservation[],
  totalWallClockLatencyMs?: number | null,
  totalEstimatedCostUsd?: number | null,
): JevShadowReport {
  const comparable = decisions.filter((d) => d.agreement !== null);
  const valid = decisions.filter((d) => d.engine_validity.valid);
  const confidence = decisions.map((d) => d.jev_result.confidence).filter((v): v is number => v !== null);
  const probability = decisions.map((d) => d.jev_result.probability).filter((v): v is number => v !== null);
  const latency = decisions.map((d) => d.latency_ms).filter((v): v is number => v !== null);
  const costs = decisions.map((d) => d.estimated_cost_usd).filter((v): v is number => v !== null);
  const agreements = comparable.filter((d) => d.agreement === true).length;
  const correctnessCounts: Record<CorrectnessOutcome, number> = {
    director_correct_jev_correct: 0,
    director_correct_jev_wrong: 0,
    director_wrong_jev_correct: 0,
    both_wrong: 0,
    undetermined: 0,
  };
  const decisionTypeCounts: Record<string, number> = {};
  for (const decision of decisions) {
    const outcome = decision.correctness_outcome || 'undetermined';
    correctnessCounts[outcome] += 1;
    const type = decision.decision_type || decisionTypeFor(decision.decision);
    decisionTypeCounts[type] = (decisionTypeCounts[type] || 0) + 1;
  }
  return {
    decision_count: decisions.length,
    comparable_count: comparable.length,
    agreements,
    agreement_rate: comparable.length ? round(agreements / comparable.length) : null,
    valid_count: valid.length,
    validity_rate: decisions.length ? round(valid.length / decisions.length) : null,
    average_confidence: confidence.length ? round(confidence.reduce((a, b) => a + b, 0) / confidence.length) : null,
    average_probability: probability.length ? round(probability.reduce((a, b) => a + b, 0) / probability.length) : null,
    average_latency_ms: latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : null,
    total_wall_clock_latency_ms: totalWallClockLatencyMs ?? (latency.length ? Math.max(...latency) : null),
    estimated_cost_usd: totalEstimatedCostUsd !== undefined
      ? totalEstimatedCostUsd
      : costs.length ? round(costs.reduce((a, b) => a + b, 0)) : null,
    correctness_counts: correctnessCounts,
    deterministic_decision_count: decisions.filter((d) => ['deterministic', 'engine_rules'].includes(d.deterministic_ground_truth?.source)).length,
    unknown_decision_count: decisions.filter((d) => !d.correctness_outcome || d.correctness_outcome === 'undetermined').length,
    decision_type_counts: decisionTypeCounts,
    disagreement_cases: comparable
      .filter((d) => d.agreement === false)
      .map((d) => ({
        decision: d.decision,
        jev: d.jev_result.value,
        director: d.director_result.value,
        confidence: d.jev_result.confidence,
      })),
  };
}

function runnerTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const timeoutMs = Number(env.JEV_SHADOW_TIMEOUT_MS || 12000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
}

function sdkAnswerMap(answers: Record<string, unknown>): Record<string, JevChoiceAnswer> {
  return Object.fromEntries(Object.entries(answers).map(([id, answer]) => [id, answer as JevChoiceAnswer]));
}

export class JevSdkRunner implements JevRunner {
  private readonly timeoutMs: number;
  private client: TypeSafeClient | null;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    client?: TypeSafeClient,
  ) {
    this.timeoutMs = runnerTimeoutMs(env);
    this.client = client || null;
  }

  private getClient(): TypeSafeClient {
    if (!this.client) {
      this.client = new TypeSafeClient({
        ...(this.env.JEV_MODEL ? { defaultModel: this.env.JEV_MODEL } : {}),
        timeout: this.timeoutMs,
        retry: { maxRetries: 0 },
      });
    }
    return this.client;
  }

  async decide(request: JevDecisionRequest): Promise<JevRunnerResponse> {
    const started = Date.now();
    const requestText = JSON.stringify(request);
    const questions = Object.fromEntries(request.questions.map((question) => [
      question.id,
      choice(question.question, question.options),
    ])) as Questions;
    const response = await this.getClient().systemOne({
      state: request.state as EntryType,
      questions,
    }, {
      timeout: this.timeoutMs,
      retry: { maxRetries: 0 },
    });
    const responseText = JSON.stringify(response.answers);
    const inputTokens = response.usage?.input_tokens ?? estimateTokens(requestText);
    const outputTokens = response.usage?.output_tokens ?? estimateTokens(responseText);
    const usage: JevRunnerUsage = {
      request_chars: requestText.length,
      response_chars: responseText.length,
      estimated_input_tokens: inputTokens,
      estimated_output_tokens: outputTokens,
      estimated_total_tokens: inputTokens + outputTokens,
      decision_count: request.questions.length,
      decision_types: [...new Set(request.questions.map((question) => decisionTypeFor(question.id)))],
      model: response.model || this.env.JEV_MODEL || null,
      model_version: this.env.JEV_MODEL_VERSION || null,
      command: '@typesafe-ai/sdk',
      execution_mode: 'single_batched_request',
    };
    return {
      answers: sdkAnswerMap(response.answers as Record<string, unknown>),
      latency_ms: Date.now() - started,
      usage,
    };
  }
}

export class JevCliRunner implements JevRunner {
  private readonly timeoutMs: number;

  constructor(
    private readonly command = 'jev.cmd',
    timeoutMs = runnerTimeoutMs(),
  ) {
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
  }

  async decide(request: JevDecisionRequest): Promise<JevRunnerResponse> {
    const started = Date.now();
    const directory = await mkdtemp(path.join(tmpdir(), 'stonecaster-jev-'));
    const requestPath = path.join(directory, 'request.json');
    const requestText = JSON.stringify(request);
    await writeFile(requestPath, requestText, 'utf8');
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(this.command, ['decide', '--file', requestPath], {
          shell: true,
          windowsHide: true,
        });
        let output = '';
        let error = '';
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`Jev timed out after ${this.timeoutMs}ms`));
        }, this.timeoutMs);
        child.stdout.on('data', (chunk: Buffer | string) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer | string) => { error += chunk.toString(); });
        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) resolve(output);
          else reject(new Error(error.trim() || `Jev exited with code ${code}`));
        });
      });
      const responseText = stdout.trim();
      const parsed = parseJevAnswersJson(responseText);
      const usage: JevRunnerUsage = {
        request_chars: requestText.length,
        response_chars: responseText.length,
        estimated_input_tokens: estimateTokens(requestText),
        estimated_output_tokens: estimateTokens(responseText),
        estimated_total_tokens: estimateTokens(requestText) + estimateTokens(responseText),
        decision_count: request.questions.length,
        decision_types: [...new Set(request.questions.map((question) => decisionTypeFor(question.id)))],
        model: process.env.JEV_MODEL || null,
        model_version: process.env.JEV_MODEL_VERSION || null,
        command: this.command,
        execution_mode: 'single_batched_request',
      };
      return { answers: parsed, latency_ms: Date.now() - started, usage };
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function createJevRunner(env: NodeJS.ProcessEnv = process.env): JevRunner {
  const runner = (env.JEV_RUNNER || 'sdk').trim().toLowerCase();
  if (runner === 'cli') {
    return new JevCliRunner(env.JEV_CLI_COMMAND || 'jev.cmd', runnerTimeoutMs(env));
  }
  return new JevSdkRunner(env);
}

export class JevShadowService {
  private readonly runner: JevRunner;

  constructor(
    runner?: JevRunner,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.runner = runner || createJevRunner(env);
  }

  reconcileDirectorComparison(
    telemetry: JevShadowTelemetry,
    directorIntent: DirectorUnifiedIntent,
    gameState: GameState,
  ): JevShadowTelemetry {
    const { playerId } = readSceneEntities(gameState);
    const primary = primaryDirectorValues(directorIntent, playerId);
    const decisions = telemetry.decisions.map((decision) => {
      let directorValue: string | null = null;
      let directorValidity: { valid: boolean; reasons: string[] };
      if (decision.decision === JEV_DECISION_IDS.action) {
        directorValue = primary.action;
        directorValidity = baseValidity(directorValue, ACTION_LABELS);
      } else if (decision.decision === JEV_DECISION_IDS.engine) {
        directorValue = primary.engine;
        directorValidity = baseValidity(directorValue, ['yes', 'no']);
      } else if (decision.decision === JEV_DECISION_IDS.feasibility) {
        directorValue = primary.feasibility;
        directorValidity = baseValidity(directorValue, ['possible', 'impossible']);
      } else if (decision.decision === JEV_DECISION_IDS.target) {
        directorValue = primary.target;
        const knownTargets = Array.isArray(decision.director_result.details?.known_targets)
          ? decision.director_result.details.known_targets.filter((value): value is string => typeof value === 'string')
          : [];
        directorValidity = baseValidity(directorValue, ['none', ...knownTargets]);
      } else if (decision.decision === JEV_DECISION_IDS.impact) {
        directorValue = primary.impact;
        directorValidity = decision.deterministic_ground_truth.source === 'not_applicable'
          ? { valid: directorValue === null, reasons: directorValue === null ? [] : ['Director supplied impact for a non-impact action'] }
          : baseValidity(directorValue, IMPACT_LABELS);
      } else {
        const npcId = typeof decision.director_result.details?.npc_id === 'string' ? decision.director_result.details.npc_id : null;
        directorValue = npcId && primary.reaction_actors.includes(npcId) ? 'eligible' : 'not_eligible';
        directorValidity = baseValidity(directorValue, ['eligible', 'not_eligible']);
      }
      const jevValue = normalizeTargetValue(decision.jev_result.value);
      const normalizedDirector = normalizeTargetValue(directorValue);
      return {
        ...decision,
        director_result: { ...decision.director_result, value: directorValue },
        agreement: jevValue === null || normalizedDirector === null ? null : jevValue === normalizedDirector,
        director_correctness: correctnessFor(normalizedDirector, decision.deterministic_ground_truth, directorValidity),
        correctness_outcome: correctnessOutcome(
          correctnessFor(normalizedDirector, decision.deterministic_ground_truth, directorValidity),
          decision.jev_correctness,
        ),
        director_validity: directorValidity,
      };
    });
    const report = buildJevComparisonReport(decisions, telemetry.total_wall_clock_latency_ms, telemetry.usage?.estimated_cost_usd);
    return { ...telemetry, decisions, report };
  }

  applyCanaryAuthority(
    telemetry: JevShadowTelemetry,
    directorIntent: DirectorUnifiedIntent | null,
    gameState: GameState,
    actionsMap: Record<string, unknown>,
    config: JevCanaryConfig = readJevCanaryConfig(this.env),
  ): JevCanaryApplication {
    const compared = directorIntent ? this.reconcileDirectorComparison(telemetry, directorIntent, gameState) : telemetry;
    const decisions = canaryDecisionMap(compared, config, directorIntent || undefined);
    const authoritative = decisions.filter((decision) => decision.authoritative);
    const failed = decisions.filter((decision) => !decision.authoritative);
    let intent = directorIntent;
    let fallbackReason = failed.length ? failed.map((decision) => `${decision.family}: ${decision.fallback_reason}`).join(' | ') : null;

    if (directorIntent) {
      intent = applyCanaryFields(directorIntent, decisions, readSceneEntities(gameState).playerId);
    } else if (failed.length === 0 && authoritative.some((decision) => decision.family === 'action_classification')) {
      intent = this.buildNoDirectorCanaryIntent(decisions, gameState, actionsMap);
      if (!intent) {
        fallbackReason = [fallbackReason, 'No safe Engine-backed intent could be constructed without the Director'].filter(Boolean).join(' | ');
      }
    } else {
      fallbackReason = [fallbackReason, failed.length ? 'A promoted Jev decision failed validation; the primary Director is required' : 'Action classification must be authoritative to construct a no-Director intent'].filter(Boolean).join(' | ');
    }

    const canary: JevCanaryTelemetry = {
      enabled: true,
      compare_mode: config.compare,
      gpt_director_ran: directorIntent !== null,
      primary_model_called: directorIntent !== null,
      final_authority: intent ? (directorIntent ? 'primary' : 'jev') : 'none',
      fallback_occurred: failed.length > 0 || !intent,
      jev_authoritative: !!intent && authoritative.length > 0 && (!config.action_classification || decisions.some((decision) => decision.family === 'action_classification' && decision.authoritative)),
      decisions,
      fallback_reason: fallbackReason,
      disagreement: decisions.some((decision) => decision.disagreement === true) ? true : (directorIntent ? false : null),
      jev_cost_usd: compared.usage?.estimated_cost_usd ?? null,
      gpt_cost_avoided_usd: directorIntent ? 0 : (!failed.length && intent ? config.baseline_gpt_cost_usd : 0),
      end_to_end_latency_ms: compared.total_wall_clock_latency_ms,
    };
    const finalTelemetry: JevShadowTelemetry = { ...compared, mode: 'canary', canary };
    if (!intent) return { intent: null, telemetry: finalTelemetry, fallback_reason: fallbackReason };
    return { intent, telemetry: finalTelemetry, fallback_reason: fallbackReason };
  }

  private buildNoDirectorCanaryIntent(
    decisions: JevCanaryDecisionTelemetry[],
    gameState: GameState,
    actionsMap: Record<string, unknown>,
  ): DirectorUnifiedIntent | null {
    const action = decisions.find((decision) => decision.family === 'action_classification' && decision.authoritative)?.jev_value;
    const playerId = readSceneEntities(gameState).playerId;
    if (!action || !playerId || !ACTION_LABELS.includes(action as typeof ACTION_LABELS[number])) return null;
    const capability = engineCapabilityFor(action, actionsMap, 0);
    if (action !== 'observation' && !capability.registered) return null;
    const base = DirectorUnifiedIntentSchema.parse({
      turn_meta: {
        resolution_mode: action === 'observation' || capability.requires_engine === false ? 'narrative' : 'engine',
        suggested_actions: [],
      },
      unseen_ripples: [],
      intent_queue: [],
    });
    return applyCanaryFields(base, decisions, playerId);
  }

  async evaluate(
    userInput: string,
    gameState: GameState,
    directorIntent: DirectorUnifiedIntent | undefined,
    actionsMap: Record<string, unknown> = {},
    mode: 'shadow' | 'canary' = 'shadow',
  ): Promise<JevShadowTelemetry> {
    if (mode === 'shadow' && !isJevShadowEnabled(this.env)) return this.disabled('JEV_SHADOW_MODE is not enabled', mode, directorIntent !== undefined);
    if (mode === 'canary' && !isJevCanaryEnabled(this.env)) return this.disabled('No Jev canary decision family is enabled', mode, directorIntent !== undefined);

    const started = Date.now();
    try {
      const scene = sceneEntities(gameState);
      const player = scene.entities.find((entity) => entity.id === scene.playerId);
      const npcs = scene.entities.filter((entity) => entity.id !== scene.playerId && eligibleNpc(entity));
      const primary = primaryDirectorValues(directorIntent, scene.playerId);
      const inputAction = classifyInputAction(userInput);
      const primaryCapability = engineCapabilityFor(inputAction || primary.action, actionsMap, primary.primary_target ? 1 : 0);
      const actionTruth = actionGroundTruth(userInput, inputAction);
      const engineTruth: DeterministicGroundTruth = inputAction === 'observation'
        ? { source: 'deterministic', value: 'no', allowed_values: ['no'], reasons: ['Observation does not change resources, presence, or a resolvable outcome'] }
        : primaryCapability.requires_engine === null
          ? { source: 'unknown', value: null, allowed_values: ['yes', 'no'], reasons: ['No registered Engine capability was available for the recognized action'] }
          : { source: 'engine_rules', value: primaryCapability.requires_engine ? 'yes' : 'no', allowed_values: ['yes', 'no'], reasons: primaryCapability.reasons };
      const targetTruth = targetGroundTruth(userInput, inputAction, npcs);
      const feasibilityTruth = feasibilityGroundTruth(userInput, inputAction, player);
      const impactTruth = impactGroundTruth(inputAction, primaryCapability);
      const targetOptions: Record<string, string> = { none: 'No primary target or no addressed entity' };
      for (const entity of npcs) targetOptions[entity.id] = entity.name;
      // Keep at least two closed-set options even in a player-only scene; the sentinel is not a
      // gameplay entity and is never passed to the Engine.
      if (npcs.length === 0) targetOptions.no_known_entity = 'No known present NPC is available as a target';

      const questions: JevQuestion[] = [
      {
        id: JEV_DECISION_IDS.action,
        question: 'Classify the player input into exactly one primary action category.',
        options: {
          observation: 'The player only observes or asks for atmospheric description.',
          social_action: 'The player addresses, asks, persuades, threatens, or otherwise interacts with a known character.',
          combat_action: 'The player attempts violence, an attack, or physical conflict.',
          rest_action: 'The player rests, sleeps, camps, or recovers.',
          eat_action: 'The player consumes food or drink.',
          navigate: 'The player travels to a distinct place.',
          attempt_action: 'The player attempts another physical or skill action with possible failure.',
        },
      },
      {
        id: JEV_DECISION_IDS.engine,
        question: 'Does this player action require deterministic Engine resolution because it changes resources, changes presence/location, or can materially succeed or fail?',
        options: { yes: 'Engine resolution is required.', no: 'Narrative handling is sufficient.' },
      },
      {
        id: JEV_DECISION_IDS.feasibility,
        question: 'Is the requested action feasible for this character in the described world and with the listed possessions?',
        options: { possible: 'The character can plausibly attempt this action.', impossible: 'The action requires an unavailable power, item, capability, or reality change.' },
      },
      {
        id: JEV_DECISION_IDS.target,
        question: 'Which known character, if any, is the primary target or addressee of the player input? Choose none when there is no target.',
        options: targetOptions,
      },
      {
        id: JEV_DECISION_IDS.impact,
        question: 'What is the likely impact magnitude of the player action if it materially resolves?',
        options: {
          Low: 'Minor or glancing impact.',
          Moderate: 'Clear, noticeable impact without being devastating.',
          High: 'Significant impact that materially changes the situation.',
          Severe: 'Devastating or relationship-altering impact.',
        },
      },
      ];
      for (const npc of npcs) {
        questions.push({
          id: `npc_reaction_${npc.id.replaceAll('-', '_')}`,
          question: `Is ${npc.name} eligible to take a meaningful reaction to this player action based on presence, the action, and the character's traits?`,
          options: { eligible: 'The NPC is present and has a plausible reaction.', not_eligible: 'The NPC should not react to this action.' },
        });
      }

      const stateView = gameState as unknown as {
        tier0_narrative?: { scene_context?: unknown };
        narrative_focus?: { scene_context?: unknown };
      };
      const state: Record<string, unknown> = {
        player_input: userInput,
        scene: stateView.tier0_narrative?.scene_context || stateView.narrative_focus?.scene_context || {},
        player: player ? describeEntity(player) : { id: scene.playerId || null },
        present_entities: scene.entities.map(describeEntity),
        ordinary_possessions: ['travel pack', 'simple tools', 'knife', 'food', 'water'],
        engine_capabilities: ACTION_LABELS.filter((action) => action !== 'observation').map((action) => engineCapabilityFor(action, actionsMap, npcs.length)),
      };

      const response = validateJevRunnerResponse(await this.runner.decide({ state, questions }));
      const answerMap = response.answers || {};
      const fallbackRequestText = JSON.stringify({ state, questions });
      const rawUsage = response.usage || {
        request_chars: fallbackRequestText.length,
        response_chars: 0,
        estimated_input_tokens: estimateTokens(fallbackRequestText),
        estimated_output_tokens: 0,
        estimated_total_tokens: estimateTokens(fallbackRequestText),
        decision_count: questions.length,
        decision_types: [...new Set(questions.map((question) => decisionTypeFor(question.id)))],
        model: this.env.JEV_MODEL || null,
        model_version: this.env.JEV_MODEL_VERSION || null,
        command: 'jev.cmd',
        execution_mode: 'single_batched_request' as const,
      } satisfies JevRunnerUsage;
      const pricing = readJevPricing(this.env);
      const usage = { ...rawUsage, pricing, estimated_cost_usd: estimateCost(rawUsage, pricing) };
      const decisions: JevDecisionObservation[] = [];
      const add = (
        decision: string,
        answer: JevChoiceAnswer | undefined,
        directorValue: string | null,
        directorValidity: { valid: boolean; reasons: string[] },
        truth: DeterministicGroundTruth,
        validity: { valid: boolean; reasons: string[] },
        details?: Record<string, unknown>,
      ) => {
        const jev = choiceAnswer(answer);
        const directorNormalized = normalizeTargetValue(directorValue);
        const jevNormalized = normalizeTargetValue(jev.value);
        const hasDirectorComparison = directorIntent !== undefined;
        const directorCorrectness = hasDirectorComparison ? correctnessFor(directorNormalized, truth, directorValidity) : 'unknown';
        const jevCorrectness = correctnessFor(jevNormalized, truth, validity);
        decisions.push({
          decision,
          decision_type: decisionTypeFor(decision),
          jev_result: jev,
          director_result: { value: directorValue, ...(details ? { details } : {}) },
          agreement: jevNormalized === null || directorNormalized === null ? null : jevNormalized === directorNormalized,
          deterministic_ground_truth: truth,
          director_correctness: directorCorrectness,
          jev_correctness: jevCorrectness,
          correctness_outcome: correctnessOutcome(directorCorrectness, jevCorrectness),
          director_validity: hasDirectorComparison ? directorValidity : { valid: false, reasons: ['Director comparison pending'] },
          engine_validity: validity,
          latency_ms: response.latency_ms ?? null,
          latency_scope: 'batched_request',
          estimated_cost_usd: usage.estimated_cost_usd === null ? null : round(usage.estimated_cost_usd / questions.length),
          status: answer?.choice ? (validity.valid ? 'ok' : 'invalid') : 'unavailable',
          ...(answer?.choice ? {} : { error: 'Jev returned no choice for this decision' }),
        });
      };

      const actionAnswer = answerMap[JEV_DECISION_IDS.action]?.choice || null;
      add(JEV_DECISION_IDS.action, answerMap[JEV_DECISION_IDS.action], primary.action, baseValidity(primary.action, ACTION_LABELS), actionTruth, baseValidity(actionAnswer, ACTION_LABELS), { director_trigger: primary.action, input_action: inputAction });
      const engineAnswer = answerMap[JEV_DECISION_IDS.engine]?.choice || null;
      add(JEV_DECISION_IDS.engine, answerMap[JEV_DECISION_IDS.engine], primary.engine, baseValidity(primary.engine, ['yes', 'no']), engineTruth, baseValidity(engineAnswer, ['yes', 'no']), { director_resolution_mode: directorIntent?.turn_meta.resolution_mode || null, capability: primaryCapability });
      const feasibilityAnswer = answerMap[JEV_DECISION_IDS.feasibility]?.choice || null;
      add(JEV_DECISION_IDS.feasibility, answerMap[JEV_DECISION_IDS.feasibility], primary.feasibility, baseValidity(primary.feasibility, ['possible', 'impossible']), feasibilityTruth, baseValidity(feasibilityAnswer, ['possible', 'impossible']), { director_feasibility: primary.feasibility });
      const targetAnswer = answerMap[JEV_DECISION_IDS.target]?.choice || null;
      const targetValidity = baseValidity(targetAnswer, Object.keys(targetOptions));
      if (targetAnswer && !['none', 'no_known_entity'].includes(targetAnswer) && !npcs.some((entity) => entity.id === targetAnswer)) {
        targetValidity.valid = false;
        targetValidity.reasons.push('Target is not a present known NPC');
      }
      const directorTargetValidity = baseValidity(primary.target, ['none', ...npcs.map((entity) => entity.id)]);
      add(JEV_DECISION_IDS.target, answerMap[JEV_DECISION_IDS.target], primary.target, directorTargetValidity, targetTruth, targetValidity, { known_targets: npcs.map((entity) => entity.id) });
      const impactAnswer = answerMap[JEV_DECISION_IDS.impact]?.choice || null;
      const directorImpactValidity = impactTruth.source === 'not_applicable'
        ? { valid: primary.impact === null, reasons: primary.impact === null ? [] : ['Director supplied impact for an action without a tiered Engine capability'] }
        : baseValidity(primary.impact, IMPACT_LABELS);
      add(JEV_DECISION_IDS.impact, answerMap[JEV_DECISION_IDS.impact], primary.impact, directorImpactValidity, impactTruth, impactTruth.source === 'not_applicable' ? { valid: true, reasons: [] } : baseValidity(impactAnswer, IMPACT_LABELS), { director_impact: primary.impact, capability: primaryCapability });

      for (const npc of npcs) {
        const id = `npc_reaction_${npc.id.replaceAll('-', '_')}`;
        const answer = answerMap[id];
        const expected = primary.reaction_actors.includes(npc.id) ? 'eligible' : 'not_eligible';
        const truth = reactionGroundTruth(inputAction, npc);
        add(id, answer, expected, baseValidity(expected, ['eligible', 'not_eligible']), truth, baseValidity(answer?.choice || null, ['eligible', 'not_eligible']), { npc_id: npc.id, present: true, eligible: eligibleNpc(npc) });
      }

      const totalWallClockLatencyMs = Date.now() - started;
      const schemaValid = decisions.length > 0 && decisions.every((decision) => decision.status === 'ok');
      const deterministicValidationPassed = decisions.length > 0 && decisions.every((decision) =>
        decision.engine_validity.valid
        && ['deterministic', 'engine_rules', 'not_applicable'].includes(decision.deterministic_ground_truth.source));
      return {
        version: 1,
        mode,
        provider: 'typesafe/jev',
        enabled: true,
        available: true,
        attempted: true,
        succeeded: true,
        schema_valid: schemaValid,
        deterministic_validation_passed: deterministicValidationPassed,
        fallback_occurred: !schemaValid,
        primary_model_called: directorIntent !== undefined,
        final_authority: directorIntent ? 'primary' : 'none',
        batch_latency_ms: response.latency_ms || Date.now() - started,
        total_wall_clock_latency_ms: totalWallClockLatencyMs,
        usage,
        decisions,
        report: buildJevComparisonReport(decisions, totalWallClockLatencyMs, usage.estimated_cost_usd),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[JevShadow] Shadow evaluation unavailable:', message);
      return {
        ...this.disabled(message, mode, directorIntent !== undefined),
        enabled: true,
        attempted: true,
        fallback_occurred: true,
      };
    }
  }

  private disabled(error: string, mode: 'shadow' | 'canary' = 'shadow', primaryModelCalled = false): JevShadowTelemetry {
    return {
      version: 1,
      mode,
      provider: 'typesafe/jev',
      enabled: false,
      available: false,
      attempted: false,
      succeeded: false,
      schema_valid: false,
      deterministic_validation_passed: false,
      fallback_occurred: false,
      primary_model_called: primaryModelCalled,
      final_authority: primaryModelCalled ? 'primary' : 'none',
      batch_latency_ms: null,
      total_wall_clock_latency_ms: null,
      usage: null,
      decisions: [],
      report: buildJevComparisonReport([]),
      error,
    };
  }
}
