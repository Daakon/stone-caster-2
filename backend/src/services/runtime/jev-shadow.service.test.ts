import { describe, expect, it, vi } from 'vitest';
import type { DirectorUnifiedIntent, GameState } from '@shared/types/chimera-runtime';
import {
  buildJevComparisonReport,
  createJevRunner,
  engineCapabilityFor,
  isJevCanaryEnabled,
  isJevShadowEnabled,
  JevShadowService,
  parseJevAnswersJson,
  readJevPricing,
  JevCliRunner,
  JevSdkRunner,
  readJevCanaryConfig,
  type JevChoiceAnswer,
  type JevDecisionObservation,
  type JevDecisionRequest,
} from './jev-shadow.service';

const PLAYER = '00000000-0000-4000-8000-000000000001';
const BRAM = '00000000-0000-4000-8000-000000000002';
const KIERA = '00000000-0000-4000-8000-000000000003';
const ABSENT = '00000000-0000-4000-8000-000000000004';

const gameState = () => ({
  player_id: PLAYER,
  tier1_mechanical: {
    index: { player_id: PLAYER },
    entities: {
      [PLAYER]: { id: PLAYER, type: 'PLAYER', properties: { name: 'Aria Vale', hp: 100 } },
      [BRAM]: { id: BRAM, type: 'NPC', properties: { name: 'Constable Bram', traits: ['dutiful'] } },
      [KIERA]: { id: KIERA, type: 'NPC', properties: { name: 'Kiera', traits: ['alert'] } },
      [ABSENT]: { id: ABSENT, type: 'NPC', properties: { name: 'Absent NPC' } },
    },
  },
  tier0_narrative: { scene_context: { location: 'Rillford Square', time: 'dusk' } },
  tier2_spatial: {
    entity_locations: {
      [PLAYER]: 'square', [BRAM]: 'square', [KIERA]: 'square', [ABSENT]: 'tavern',
    },
  },
}) as unknown as GameState;

const director = (): DirectorUnifiedIntent => ({
  turn_meta: { resolution_mode: 'narrative' as const, time_jump_minutes: 0, suggested_actions: [], feasibility: 'possible' as const },
  unseen_ripples: [],
  intent_queue: [
    { actor_id: PLAYER, trigger_id: 'social_action', intended_targets: [BRAM], proximity_cluster: [], parameters: { verb: 'ask' } },
    { actor_id: BRAM, trigger_id: 'social_action', intended_targets: [PLAYER], proximity_cluster: [], parameters: { verb: 'answer' } },
  ],
});

const answer = (choice: string, probability = 0.91): JevChoiceAnswer => ({
  type: 'choice', choice, confidence: probability, probabilities: { [choice]: probability },
});

describe('Jev shadow telemetry', () => {
  it('uses the supported SDK runner by default and keeps the CLI as an explicit fallback', () => {
    expect(createJevRunner({})).toBeInstanceOf(JevSdkRunner);
    expect(createJevRunner({ JEV_RUNNER: 'cli' })).toBeInstanceOf(JevCliRunner);
  });

  it('uses the published Jev pricing defaults while allowing environment overrides', () => {
    expect(readJevPricing({})).toMatchObject({
      input_usd_per_1m_tokens: 0.042,
      output_usd_per_1m_tokens: 0,
      source: 'default',
    });
    expect(readJevPricing({ JEV_INPUT_USD_PER_1M_TOKENS: '0.1', JEV_OUTPUT_USD_PER_1M_TOKENS: '0.02' }))
      .toMatchObject({ input_usd_per_1m_tokens: 0.1, output_usd_per_1m_tokens: 0.02, source: 'environment' });
  });

  it('maps one batched SDK response into the historical Jev runner envelope', async () => {
    const systemOne = vi.fn(async () => ({
      model: 'jev-1.13.0',
      answers: {
        action_classification: answer('rest_action'),
        feasibility: answer('possible'),
      },
      usage: { input_tokens: 20, output_tokens: 4 },
    }));
    const runner = new JevSdkRunner({ JEV_MODEL: 'jev-test', JEV_SHADOW_TIMEOUT_MS: '50' }, { systemOne } as never);
    const response = await runner.decide({
      state: { player_input: 'I rest.' },
      questions: [
        { id: 'action_classification', question: 'Classify the action.', options: { rest_action: 'Rest.', observation: 'Observe.' } },
        { id: 'feasibility', question: 'Is it possible?', options: { possible: 'Yes.', impossible: 'No.' } },
      ],
    });
    expect(systemOne).toHaveBeenCalledWith(
      expect.objectContaining({ state: { player_input: 'I rest.' }, questions: expect.objectContaining({ action_classification: expect.any(Object) }) }),
      expect.objectContaining({ timeout: 50, retry: { maxRetries: 0 } }),
    );
    expect(response).toMatchObject({
      answers: { action_classification: { choice: 'rest_action' }, feasibility: { choice: 'possible' } },
      usage: {
        command: '@typesafe-ai/sdk',
        model: 'jev-1.13.0',
        estimated_input_tokens: 20,
        estimated_output_tokens: 4,
        execution_mode: 'single_batched_request',
      },
    });
  });

  it('keeps canary authority independently disabled by default', () => {
    expect(isJevCanaryEnabled({})).toBe(false);
    expect(readJevCanaryConfig({})).toMatchObject({
      action_classification: false,
      feasibility: false,
      confidence_threshold: 0.8,
      compare: true,
      skip_gpt: false,
    });
    expect(readJevCanaryConfig({ JEV_CANARY_ACTION_CLASSIFICATION: 'true' })).toMatchObject({
      action_classification: true,
      feasibility: false,
    });
    expect(readJevCanaryConfig({ JEV_CANARY_FEASIBILITY: 'true' })).toMatchObject({
      action_classification: false,
      feasibility: true,
    });
  });

  it('is opt-in and disabled mode makes no runner call', async () => {
    expect(isJevShadowEnabled({ JEV_SHADOW_MODE: 'false' })).toBe(false);
    const runner = { decide: vi.fn() };
    const result = await new JevShadowService(runner, { JEV_SHADOW_MODE: 'false' }).evaluate('look around', gameState(), director());
    expect(runner.decide).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      mode: 'shadow', enabled: false, available: false, decisions: [],
      attempted: false, final_authority: 'primary', primary_model_called: true,
    });
  });

  it('rejects malformed JSON and out-of-range structured answers at the adapter boundary', () => {
    expect(() => parseJevAnswersJson('{')).toThrow('not valid JSON');
    expect(() => parseJevAnswersJson(JSON.stringify({ result: { choice: 'yes', confidence: 1.2 } })))
      .toThrow('schema was invalid');
    expect(parseJevAnswersJson(JSON.stringify({ result: { choice: 'yes', confidence: 0.95 } })))
      .toMatchObject({ result: { choice: 'yes', confidence: 0.95 } });
  });

  it('fails open when the runner returns a schema-invalid envelope', async () => {
    const runner = {
      decide: vi.fn(async () => ({
        answers: { action_classification: { choice: 'rest_action', confidence: 2 } },
        latency_ms: 1,
      })),
    };
    const result = await new JevShadowService(runner, { JEV_SHADOW_MODE: 'true' })
      .evaluate('I rest beside the road.', gameState(), director());
    expect(result).toMatchObject({
      enabled: true, available: false, attempted: true, succeeded: false,
      fallback_occurred: true, error: 'Jev runner response schema was invalid',
    });
  });

  it('batches narrow typed decisions and scores both Director and Jev against deterministic checks', async () => {
    let request: JevDecisionRequest | undefined;
    const answers: Record<string, JevChoiceAnswer> = {
      action_classification: answer('social_action'),
      requires_engine_resolution: answer('no'),
      feasibility: answer('possible'),
      primary_target_selection: answer(BRAM),
      impact_magnitude: answer('Low'),
      [`npc_reaction_${BRAM.replaceAll('-', '_')}`]: answer('eligible'),
      [`npc_reaction_${KIERA.replaceAll('-', '_')}`]: answer('not_eligible'),
    };
    const runner = {
      decide: vi.fn(async (input: JevDecisionRequest) => {
        request = input;
        return { answers, latency_ms: 37 };
      }),
    };

    const result = await new JevShadowService(runner, {
      JEV_SHADOW_MODE: 'true',
      JEV_INPUT_USD_PER_1M_TOKENS: '0.042',
      JEV_OUTPUT_USD_PER_1M_TOKENS: '0',
      JEV_MODEL: 'jev-test',
    }).evaluate(
      'I ask Constable Bram what has been happening.', gameState(), director(), {
        apply_relationship_delta: { logic: [{ function: 'state.modify', args: { path: 'relationships.{target_id}.stats.warmth' } }] },
      },
    );

    expect(runner.decide).toHaveBeenCalledOnce();
    expect(request?.state.player_input).toContain('Constable Bram');
    expect(request?.questions.map((q) => q.id)).toEqual(expect.arrayContaining([
      'action_classification', 'requires_engine_resolution', 'feasibility', 'primary_target_selection', 'impact_magnitude',
      `npc_reaction_${BRAM.replaceAll('-', '_')}`,
      `npc_reaction_${KIERA.replaceAll('-', '_')}`,
    ]));
    const targetQuestion = request?.questions.find((q) => q.id === 'primary_target_selection');
    expect(targetQuestion?.options).toMatchObject({ [BRAM]: 'Constable Bram', [KIERA]: 'Kiera', none: expect.any(String) });
    expect(targetQuestion?.options[ABSENT]).toBeUndefined();
    expect(result.available).toBe(true);
    expect(result.usage).toMatchObject({ decision_count: 7, execution_mode: 'single_batched_request', model: 'jev-test', estimated_input_tokens: expect.any(Number) });
    expect(result.usage?.estimated_cost_usd).toBeGreaterThan(0);
    expect(result.total_wall_clock_latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.decisions.every((d) => d.status === 'ok')).toBe(true);
    expect(result.decisions.find((d) => d.decision === 'primary_target_selection')).toMatchObject({
      agreement: true,
      deterministic_ground_truth: { source: 'deterministic', value: BRAM },
      director_correctness: 'correct',
      jev_correctness: 'correct',
      correctness_outcome: 'director_correct_jev_correct',
      engine_validity: { valid: true },
      latency_ms: 37,
      latency_scope: 'batched_request',
    });
    expect(result.report).toMatchObject({ decision_count: 7, comparable_count: 6, agreements: 6, agreement_rate: 1, validity_rate: 1, average_latency_ms: 37 });
    expect(result.report.correctness_counts).toMatchObject({ director_correct_jev_correct: 4, both_wrong: 2 });
    expect(result.report.unknown_decision_count).toBeGreaterThan(0);
  });

  it('uses deterministic engine capability metadata instead of Director agreement as the judge', () => {
    expect(engineCapabilityFor('rest_action', {
      take_rest: { logic: [{ function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } }] },
    })).toMatchObject({ registered: true, requires_engine: true, has_resource_effect: true });
    expect(engineCapabilityFor('observation', {})).toMatchObject({ registered: false, requires_engine: null });
  });

  it('uses only validated high-confidence action and feasibility decisions in canary mode', async () => {
    const answers: Record<string, JevChoiceAnswer> = {
      action_classification: answer('social_action', 0.95),
      requires_engine_resolution: answer('no', 0.95),
      feasibility: answer('possible', 0.94),
      primary_target_selection: answer(BRAM, 0.95),
      impact_magnitude: answer('Low', 0.5),
      [`npc_reaction_${BRAM.replaceAll('-', '_')}`]: answer('eligible', 0.95),
      [`npc_reaction_${KIERA.replaceAll('-', '_')}`]: answer('eligible', 0.95),
    };
    const runner = { decide: vi.fn(async () => ({ answers, latency_ms: 21 })) };
    const service = new JevShadowService(runner, {
      JEV_CANARY_ACTION_CLASSIFICATION: 'true',
      JEV_CANARY_FEASIBILITY: 'true',
      JEV_CANARY_CONFIDENCE_THRESHOLD: '0.8',
      JEV_INPUT_USD_PER_1M_TOKENS: '0.042',
      JEV_OUTPUT_USD_PER_1M_TOKENS: '0',
    });
    const evaluated = await service.evaluate(
      'I ask Constable Bram what has been happening.',
      gameState(),
      undefined,
      { apply_relationship_delta: { logic: [{ function: 'state.modify', args: { path: 'relationships.{target_id}.stats.warmth' } }] } },
      'canary',
    );
    const primaryIntent = director();
    const originalPrimaryIntent = structuredClone(primaryIntent);
    const application = service.applyCanaryAuthority(
      evaluated,
      primaryIntent,
      gameState(),
      { apply_relationship_delta: { logic: [{ function: 'state.modify', args: { path: 'relationships.{target_id}.stats.warmth' } }] } },
    );
    expect(application.intent?.intent_queue[0]?.trigger_id).toBe('social_action');
    expect(application.intent?.turn_meta.feasibility).toBe('possible');
    expect(application.telemetry.mode).toBe('canary');
    expect(application.telemetry.canary).toMatchObject({
      jev_authoritative: true,
      gpt_director_ran: true,
      decisions: [
        { family: 'action_classification', authoritative: true, authority: 'jev', deterministic_valid: true },
        { family: 'feasibility', authoritative: true, authority: 'jev', deterministic_valid: true },
      ],
    });
    expect(primaryIntent).toEqual(originalPrimaryIntent);
  });

  it('falls back to the Director when confidence or deterministic validation fails', async () => {
    const runner = {
      decide: vi.fn(async () => ({
        answers: {
          action_classification: answer('combat_action', 0.79),
          requires_engine_resolution: answer('no', 0.9),
          feasibility: answer('possible', 0.95),
          primary_target_selection: answer(BRAM, 0.95),
          impact_magnitude: answer('Low', 0.5),
          [`npc_reaction_${BRAM.replaceAll('-', '_')}`]: answer('eligible', 0.95),
          [`npc_reaction_${KIERA.replaceAll('-', '_')}`]: answer('eligible', 0.95),
        },
        latency_ms: 12,
      })),
    };
    const service = new JevShadowService(runner, {
      JEV_CANARY_ACTION_CLASSIFICATION: 'true',
      JEV_CANARY_FEASIBILITY: 'true',
      JEV_CANARY_CONFIDENCE_THRESHOLD: '0.8',
    });
    const evaluated = await service.evaluate('I ask Constable Bram a question.', gameState(), undefined, {}, 'canary');
    const application = service.applyCanaryAuthority(evaluated, director(), gameState(), {});
    expect(application.intent?.intent_queue[0]?.trigger_id).toBe('social_action');
    expect(application.telemetry.canary?.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ family: 'action_classification', authoritative: false, confidence_valid: false }),
      expect.objectContaining({ family: 'feasibility', authoritative: true }),
    ]));
    expect(application.telemetry.canary?.fallback_reason).toContain('action_classification');
  });

  it('does not construct a partial no-Director intent when one promoted decision fails', async () => {
    const runner = {
      decide: vi.fn(async () => ({
        answers: {
          action_classification: answer('rest_action', 0.96),
          requires_engine_resolution: answer('yes', 0.9),
          feasibility: answer('impossible', 0.96),
          primary_target_selection: answer('none', 0.9),
          impact_magnitude: answer('Low', 0.2),
          [`npc_reaction_${BRAM.replaceAll('-', '_')}`]: answer('not_eligible', 0.9),
          [`npc_reaction_${KIERA.replaceAll('-', '_')}`]: answer('not_eligible', 0.9),
        },
        latency_ms: 15,
      })),
    };
    const env = {
      JEV_CANARY_ACTION_CLASSIFICATION: 'true',
      JEV_CANARY_FEASIBILITY: 'true',
      JEV_CANARY_COMPARE: 'false',
      JEV_CANARY_SKIP_GPT: 'true',
      JEV_CANARY_CONFIDENCE_THRESHOLD: '0.8',
    };
    const service = new JevShadowService(runner, env);
    const evaluated = await service.evaluate('I rest beside the road.', gameState(), undefined, {
      take_rest: { logic: [{ function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } }] },
    }, 'canary');
    const application = service.applyCanaryAuthority(evaluated, null, gameState(), {
      take_rest: { logic: [{ function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } }] },
    });
    expect(application.intent).toBeNull();
    expect(application.telemetry.canary).toMatchObject({
      fallback_occurred: true,
      final_authority: 'none',
      gpt_cost_avoided_usd: 0,
    });
  });

  it('can construct a minimal typed intent when GPT is explicitly skipped', async () => {
    const runner = {
      decide: vi.fn(async () => ({
        answers: {
          action_classification: answer('rest_action', 0.96),
          requires_engine_resolution: answer('yes', 0.9),
          feasibility: answer('possible', 0.96),
          primary_target_selection: answer('none', 0.9),
          impact_magnitude: answer('Low', 0.2),
          [`npc_reaction_${BRAM.replaceAll('-', '_')}`]: answer('not_eligible', 0.9),
          [`npc_reaction_${KIERA.replaceAll('-', '_')}`]: answer('not_eligible', 0.9),
        },
        latency_ms: 15,
      })),
    };
    const service = new JevShadowService(runner, {
      JEV_CANARY_ACTION_CLASSIFICATION: 'true',
      JEV_CANARY_FEASIBILITY: 'true',
      JEV_CANARY_COMPARE: 'false',
      JEV_CANARY_SKIP_GPT: 'true',
      JEV_CANARY_CONFIDENCE_THRESHOLD: '0.8',
    });
    const evaluated = await service.evaluate('I rest beside the road.', gameState(), undefined, {
      take_rest: { logic: [{ function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } }] },
    }, 'canary');
    const application = service.applyCanaryAuthority(evaluated, null, gameState(), {
      take_rest: { logic: [{ function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } }] },
    });
    expect(application.intent).toMatchObject({
      turn_meta: { resolution_mode: 'engine', feasibility: 'possible' },
      intent_queue: [{ actor_id: PLAYER, trigger_id: 'rest_action' }],
    });
    expect(application.telemetry.canary).toMatchObject({ gpt_director_ran: false, jev_authoritative: true });
  });

  it('records a failed Jev call without affecting the Director result', async () => {
    const runner = { decide: vi.fn(async () => { throw new Error('missing credential'); }) };
    const result = await new JevShadowService(runner, { JEV_SHADOW_MODE: 'true' }).evaluate('I fly', gameState(), director());
    expect(result).toMatchObject({
      enabled: true, available: false, decisions: [], error: 'missing credential',
      attempted: true, succeeded: false, fallback_occurred: true, final_authority: 'primary',
    });
  });

  it('fails open on a timeout-shaped provider error', async () => {
    const runner = { decide: vi.fn(async () => { throw new Error('Jev timed out after 10ms'); }) };
    const result = await new JevShadowService(runner, { JEV_SHADOW_MODE: 'true' })
      .evaluate('I fly', gameState(), director());
    expect(result).toMatchObject({
      enabled: true, available: false, attempted: true, fallback_occurred: true,
      error: 'Jev timed out after 10ms', final_authority: 'primary',
    });
  });

  it('builds a compact report with disagreements and confidence', () => {
    const decisions: JevDecisionObservation[] = [{
      decision: 'action_classification',
      decision_type: 'action_classification',
      jev_result: { value: 'social_action', confidence: 0.62, probability: 0.62 },
      director_result: { value: 'combat_action' },
      agreement: false,
      deterministic_ground_truth: { source: 'deterministic', value: 'social_action', allowed_values: ['social_action'], reasons: [] },
      director_correctness: 'wrong',
      jev_correctness: 'correct',
      correctness_outcome: 'director_wrong_jev_correct',
      director_validity: { valid: true, reasons: [] },
      engine_validity: { valid: true, reasons: [] },
      latency_ms: 42,
      latency_scope: 'batched_request',
      estimated_cost_usd: null,
      status: 'ok',
    }];
    expect(buildJevComparisonReport(decisions)).toMatchObject({
      decision_count: 1, comparable_count: 1, agreements: 0, agreement_rate: 0,
      validity_rate: 1, average_confidence: 0.62, average_probability: 0.62,
      average_latency_ms: 42,
      disagreement_cases: [{ decision: 'action_classification', jev: 'social_action', director: 'combat_action', confidence: 0.62 }],
    });
  });
});
