// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Regression: compiled rule steps for rest/eat must actually change the actor's resources.
 * (Previously "rest to catch my breath" restored nothing because only flat `deltas` were read.)
 */
import { describe, it, expect } from 'vitest';
import { collectEntityResourceDeltas } from './rule-steps';
import { EngineService } from './engine.service';

const PLAYER = '00000000-0000-4000-8000-000000000001';

const TAKE_REST = { logic: [
  { function: 'state.modify', args: { path: 'tier1_world.current_tick', amount: 20 } },
  { function: 'state.modify', args: { path: 'tier1_entity.current_stamina', value: 100 } },
  { function: 'state.modify', args: { path: 'tier1_entity.satiety', amount: -25 } },
  { function: 'state.set', args: { path: 'tier1_entity.physical_condition', value: 'Rested' } },
] };
const CONSUME_FOOD = { logic: [
  { function: 'state.modify', args: { path: 'tier1_entity.satiety', amount: 40, clamp_max: 100 } },
  { function: 'logic.thresholds', args: {} },
] };

describe('collectEntityResourceDeltas', () => {
  it('rest: sets stamina back to full and costs satiety; ignores world clock and non-modify steps', () => {
    const d = collectEntityResourceDeltas(TAKE_REST, PLAYER, { properties: { current_stamina: 63 } });
    expect(d).toEqual({
      [`entities.${PLAYER}.properties.current_stamina`]: 37,
      [`entities.${PLAYER}.properties.satiety`]: -25, // unset satiety starts at the implied 100
    });
  });

  it('rest at full stamina adds no stamina delta', () => {
    const d = collectEntityResourceDeltas(TAKE_REST, PLAYER, { properties: {} });
    expect(d[`entities.${PLAYER}.properties.current_stamina`]).toBeUndefined();
  });

  it('food: adds satiety and respects clamp_max', () => {
    expect(collectEntityResourceDeltas(CONSUME_FOOD, PLAYER, { properties: { satiety: 50 } }))
      .toEqual({ [`entities.${PLAYER}.properties.satiety`]: 40 });
    expect(collectEntityResourceDeltas(CONSUME_FOOD, PLAYER, { properties: { satiety: 90 } }))
      .toEqual({ [`entities.${PLAYER}.properties.satiety`]: 10 });
    expect(collectEntityResourceDeltas(CONSUME_FOOD, PLAYER, { properties: { satiety: 100 } })).toEqual({});
  });
});

describe('EngineService: rest and eat intents', () => {
  const state = (props: any) => ({
    story_id: 's', player_id: PLAYER,
    tier1_mechanical: { entities: { [PLAYER]: { id: PLAYER, type: 'PLAYER', properties: props } }, index: { player_id: PLAYER } },
    tier0_narrative: {},
  }) as any;
  const intent = (trigger_id: string) => ({
    turn_meta: { resolution_mode: 'engine' as const, time_jump_minutes: 0, suggested_actions: [] },
    unseen_ripples: [],
    intent_queue: [{ actor_id: PLAYER, trigger_id, intended_targets: [], proximity_cluster: [], parameters: { verb: 'rest' } }],
  });
  const actions = { take_rest: TAKE_REST, consume_food: CONSUME_FOOD };

  it('rest_action restores stamina through the engine', async () => {
    const r = await new EngineService().executeIntentQueue(intent('rest_action'), state({ current_stamina: 51 }), actions);
    expect(r.numeric_deltas[`entities.${PLAYER}.properties.current_stamina`]).toBe(49);
  });

  it('eat_action adds satiety through the engine', async () => {
    const r = await new EngineService().executeIntentQueue(intent('eat_action'), state({ satiety: 55 }), actions);
    expect(r.numeric_deltas[`entities.${PLAYER}.properties.satiety`]).toBe(40);
  });
});
