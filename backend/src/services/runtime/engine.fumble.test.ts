// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Regression: a fumble may only hurt someone when the attack was REDIRECTED onto a bystander.
 * With no proximity cluster the attack goes wide and the intended target takes no damage
 * (previously the intended target lost half-damage while the Narrator described a miss).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EngineService } from './engine.service.js';

const PLAYER = '00000000-0000-4000-8000-000000000001';
const GUARD = '00000000-0000-4000-8000-000000000002';
const BARD = '00000000-0000-4000-8000-000000000003';

const state = () => ({
  story_id: 's', player_id: PLAYER,
  tier1_mechanical: { entities: {
    [PLAYER]: { id: PLAYER, type: 'PLAYER', properties: { name: 'Aria', hp: 100 }, stats: { root_force: 50 } },
    [GUARD]: { id: GUARD, type: 'NPC', properties: { name: 'Guard', hp: 100 } },
    [BARD]: { id: BARD, type: 'NPC', properties: { name: 'Bard', hp: 100 } },
  }, index: { player_id: PLAYER } },
  tier0_narrative: {},
}) as any;

const intent = (proximity: string[]) => ({
  turn_meta: { resolution_mode: 'engine' as const, time_jump_minutes: 0, suggested_actions: [] },
  unseen_ripples: [],
  intent_queue: [{
    actor_id: PLAYER, trigger_id: 'combat_action', intended_targets: [GUARD], proximity_cluster: proximity,
    parameters: { verb: 'slash', impact_tier: 'Moderate' as const, skill_id: 'root_force' },
  }],
});

const hpDeltas = (deltas: Record<string, number>) =>
  Object.entries(deltas).filter(([path]) => path.endsWith('.properties.hp'));

describe('EngineService fumble handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a fumble with no proximity cluster deals NO damage to the intended target', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.97); // roll 98 => fumble
    const result = await new EngineService().executeIntentQueue(intent([]), state(), { resolve_clash: { damage: 20 } });
    expect(result.success).toBe(false);
    expect(hpDeltas(result.numeric_deltas)).toEqual([]);
    expect(result.target_results[0].resolution_summary).toBe('fumble');
    expect(result.target_results[0].actual_targets).toEqual([GUARD]);
  });

  it('a fumble WITH a proximity cluster redirects half damage onto the bystander only', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.97);
    const result = await new EngineService().executeIntentQueue(intent([BARD]), state(), { resolve_clash: { damage: 20 } });
    const hp = hpDeltas(result.numeric_deltas);
    expect(hp).toHaveLength(1);
    expect(hp[0][0]).toContain(BARD);
    expect(hp[0][1]).toBeLessThan(0);
    expect(result.target_results[0].actual_targets).toEqual([BARD]);
  });
});
