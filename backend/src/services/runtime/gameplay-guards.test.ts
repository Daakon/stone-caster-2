// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Regression tests for the gameplay guards found in Phase 2 playtesting:
 * invented ids, impossible actions, presence/location, Narrator context, cast normalization.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeDirectorIntent, normalizeDirectorOutput, DirectorService } from './director.service';
import { DirectorUnifiedIntentSchema } from '@shared/types/chimera-runtime';
import { Mas2Service, sanitizeNarratorOutput, renderOutcomeFacts } from './mas2.service';
import { applyLocationChange, presentEntityIds } from './scene-context';
import { normalizeStarEntity } from '../game/genesis/star-entity';

const PLAYER = '00000000-0000-4000-8000-000000000001';
const BRAM = '00000000-0000-4000-8000-000000000002';
const KIERA = '00000000-0000-4000-8000-000000000003';
const GHOST = '00000000-0000-4000-8000-0000000000ff';

const gameState = () => ({
  player_id: PLAYER,
  tier1_mechanical: {
    index: { player_id: PLAYER },
    entities: {
      [PLAYER]: { id: PLAYER, type: 'PLAYER', properties: { name: 'Aria Vale' } },
      [BRAM]: { id: BRAM, type: 'NPC', properties: { name: 'Bram', display_name: 'Constable Bram', archetype: 'Constable' } },
      [KIERA]: { id: KIERA, type: 'NPC', properties: { name: 'Kiera', species: 'Panther Shifter' } },
    },
  },
  tier0_narrative: { scene_context: { location: 'Rillford Square', time: 'dusk', atmosphere: 'busy' }, dialogue_history: [] },
  tier2_spatial: { entity_locations: { [PLAYER]: 'start_node', [BRAM]: 'start_node', [KIERA]: 'start_node' } },
}) as any;

const intent = (over: any = {}) => ({
  turn_meta: { resolution_mode: 'engine', time_jump_minutes: 0, suggested_actions: [], ...over.turn_meta },
  unseen_ripples: over.unseen_ripples ?? [],
  intent_queue: over.intent_queue ?? [],
}) as any;

describe('sanitizeDirectorIntent', () => {
  it('drops ripples on the player or on invented ids and unknown targets', () => {
    const out = sanitizeDirectorIntent(intent({
      unseen_ripples: [
        { target_id: PLAYER, type: 'relationship', delta_tier: 'Minor', property_path: 'x.desire', reason: 'self' },
        { target_id: GHOST, type: 'relationship', delta_tier: 'Minor', property_path: 'x.respect', reason: 'invented' },
        { target_id: BRAM, type: 'relationship', delta_tier: 'Minor', property_path: 'x.respect', reason: 'real' },
      ],
      intent_queue: [{ actor_id: GHOST, trigger_id: 'social_action', intended_targets: [BRAM, GHOST], proximity_cluster: [GHOST], parameters: { verb: 'ask' } }],
    }), gameState());
    expect(out.unseen_ripples.map((r) => r.target_id)).toEqual([BRAM]);
    expect(out.intent_queue[0].actor_id).toBe(PLAYER);
    expect(out.intent_queue[0].intended_targets).toEqual([BRAM]);
    expect(out.intent_queue[0].proximity_cluster).toEqual([]);
  });

  it('an impossible action clears intents and ripples', () => {
    const out = sanitizeDirectorIntent(intent({
      turn_meta: { feasibility: 'impossible', feasibility_reason: 'humans cannot fly' },
      unseen_ripples: [{ target_id: BRAM, type: 'emotional', delta_tier: 'Minor', property_path: 'x.awe', reason: 'wow' }],
      intent_queue: [{ actor_id: PLAYER, trigger_id: 'attempt_action', intended_targets: [], proximity_cluster: [], parameters: { verb: 'fly' } }],
    }), gameState());
    expect(out.intent_queue).toEqual([]);
    expect(out.unseen_ripples).toEqual([]);
  });

  it('absent NPCs cannot be targeted, and location_change companions are limited to real entities', () => {
    const gs = gameState();
    gs.tier2_spatial.entity_locations[KIERA] = 'loc:elsewhere';
    const out = sanitizeDirectorIntent(intent({
      turn_meta: { location_change: { name: 'The Copper Kettle', companions: [BRAM, GHOST, PLAYER] } },
      intent_queue: [{ actor_id: PLAYER, trigger_id: 'social_action', intended_targets: [KIERA], proximity_cluster: [], parameters: { verb: 'ask' } }],
    }), gs);
    expect(out.intent_queue[0].intended_targets).toEqual([]);
    expect(out.turn_meta.location_change?.companions).toEqual([BRAM]);
  });
});

describe('scene presence and location change', () => {
  const bundle = () => {
    const gs = gameState();
    return { mechanical: gs.tier1_mechanical, narrative: gs.tier0_narrative, registry: gs.tier2_spatial };
  };

  it('moves the player and named companions; everyone else stays behind', () => {
    const b = bundle();
    expect(applyLocationChange(b, { name: 'The Copper Kettle', companions: [BRAM] })).toBe(true);
    expect(b.narrative.scene_context.location).toBe('The Copper Kettle');
    const here = presentEntityIds({ player_id: PLAYER, tier1_mechanical: b.mechanical, tier2_spatial: b.registry });
    expect(here.sort()).toEqual([PLAYER, BRAM].sort());
    expect(here).not.toContain(KIERA);
  });

  it('is a no-op without a change or when already at that place', () => {
    const b = bundle();
    expect(applyLocationChange(b, undefined)).toBe(false);
    applyLocationChange(b, { name: 'North Road', companions: [] });
    expect(applyLocationChange(b, { name: 'North Road', companions: [BRAM] })).toBe(false);
  });
});

describe('Director/Narrator context', () => {
  it('the Director state summary names the cast, marks the player and lists absent NPCs separately', () => {
    const gs = gameState();
    gs.tier2_spatial.entity_locations[KIERA] = 'loc:elsewhere';
    const summary = (new DirectorService({ generateJSON: async () => ({}) } as any) as any).summarizeGameState(gs);
    expect(summary).toContain(`Player**: Aria Vale`);
    expect(summary).toContain(`Constable Bram (${BRAM})`);
    expect(summary).toMatch(/Elsewhere[^\n]*Kiera/);
  });

  it('the Narrator prompt contains the player action, present cast, absent cast and possessions', () => {
    const gs = gameState();
    gs.tier2_spatial.entity_locations[KIERA] = 'loc:elsewhere';
    const prompt = (new Mas2Service({ generateJSON: async () => ({}) } as any) as any).buildNarratorUserPrompt(
      { success: true, outcome_summary: 'ok', numeric_deltas: {}, target_results: [], status_tags: {} }, gs, undefined, undefined,
      'I ask Bram about the woods.'
    );
    expect(prompt).toContain('I ask Bram about the woods.');
    expect(prompt).toContain('Constable Bram');
    expect(prompt).toMatch(/Elsewhere[\s\S]*- Kiera/);
    expect(prompt).toContain('Player Possessions');
  });

  it('narrator entity_updates on the player or invented ids are dropped', () => {
    const out = sanitizeNarratorOutput({
      ripple_narrative: 'x', thought_chain: 'y',
      state_updates: { entity_updates: [
        { id: PLAYER, path: 'relationships.player.trust', value: 1, description: '' },
        { id: GHOST, path: 'relationships.player.trust', value: 1, description: '' },
        { id: BRAM, path: 'relationships.player.trust', value: 1, description: '' },
      ] },
    } as any, gameState());
    expect(out.state_updates?.entity_updates?.map((u: any) => u.id)).toEqual([BRAM]);
  });
});

describe('normalizeStarEntity', () => {
  it('turns a raw chimera_entities row into a named runtime entity', () => {
    const e = normalizeStarEntity({
      id: KIERA, slug: 'kiera', entity_type: 'NPC', display_name: 'Kiera',
      raw_data: { identity: { name: 'Kiera', species: 'Panther Shifter' }, traits: ['tactically sharp'], ai_hints: ['Cannot speak in animal form'] },
    });
    expect(e).toMatchObject({ id: KIERA, type: 'NPC', status: 'active' });
    expect(e.properties).toMatchObject({ name: 'Kiera', display_name: 'Kiera', species: 'Panther Shifter', traits: ['tactically sharp'], ai_hints: ['Cannot speak in animal form'] });
  });
});

describe('normalizeDirectorOutput', () => {
  const base = (mode: string, extra: any = {}) => ({ turn_meta: { resolution_mode: mode, time_jump_minutes: 0, suggested_actions: [] }, unseen_ripples: [], intent_queue: [], ...extra });

  it('maps resolution_mode "impossible" to narrative + impossible feasibility (real model slip)', () => {
    const out: any = normalizeDirectorOutput(base('impossible'));
    expect(out.turn_meta.resolution_mode).toBe('narrative');
    expect(out.turn_meta.feasibility).toBe('impossible');
  });

  it('maps a trigger name in resolution_mode (e.g. "navigate") to a valid mode (real model slip)', () => {
    const out: any = normalizeDirectorOutput(base('navigate', { intent_queue: [{ trigger_id: 'navigate' }] }));
    expect(['engine', 'narrative']).toContain(out.turn_meta.resolution_mode);
  });

  it('leaves valid output alone and the normalized shape passes the real schema', () => {
    expect((normalizeDirectorOutput(base('Engine')) as any).turn_meta.resolution_mode).toBe('engine');
    expect(DirectorUnifiedIntentSchema.safeParse(normalizeDirectorOutput(base('impossible'))).success).toBe(true);
  });
});

describe('normalizeDirectorOutput: incomplete intents (real model slip)', () => {
  it('fills a missing verb from the trigger, a missing actor with the player, and missing target lists', () => {
    const out: any = normalizeDirectorOutput({
      turn_meta: { resolution_mode: 'narrative' },
      intent_queue: [{ trigger_id: 'navigate', parameters: {} }, { trigger_id: 'social_action' }],
    }, PLAYER);
    expect(out.intent_queue[0].parameters.verb).toBe('travel');
    expect(out.intent_queue[0].actor_id).toBe(PLAYER);
    expect(out.intent_queue[0].intended_targets).toEqual([]);
    expect(out.intent_queue[1].parameters.verb).toBe('speak');
    expect(DirectorUnifiedIntentSchema.safeParse(out).success).toBe(true);
  });
});

describe('returning to a place', () => {
  it('coming back to the starting location reuses its key, so those who stayed are present again', () => {
    const gs = gameState();
    const b: any = { mechanical: gs.tier1_mechanical, narrative: gs.tier0_narrative, registry: gs.tier2_spatial };
    const present = () => presentEntityIds({ player_id: PLAYER, tier1_mechanical: b.mechanical, tier2_spatial: b.registry });

    applyLocationChange(b, { name: 'The Copper Kettle', companions: [KIERA] }); // Bram stays in the square
    expect(present()).not.toContain(BRAM);
    applyLocationChange(b, { name: 'North Road', companions: [] });
    applyLocationChange(b, { name: 'Rillford Square', companions: [] });      // back where Bram is
    expect(present()).toContain(BRAM);
    expect(present()).not.toContain(KIERA);                                    // still in the tavern
  });
});

describe('renderOutcomeFacts (Narrator/engine consistency)', () => {
  const name = (id: string) => ({ [BRAM]: 'Constable Bram', [KIERA]: 'Kiera' } as Record<string, string>)[id] ?? 'someone';
  const result = (over: any) => ({ success: true, outcome_summary: 'Constable Bram: success (Roll: 12, Target: 50, Impact: High)', numeric_deltas: {}, target_results: [], status_tags: {}, ...over }) as any;

  it('states a landed hit with severity and never leaks rolls or numbers', () => {
    const text = renderOutcomeFacts(result({
      numeric_deltas: { [`entities.${BRAM}.properties.hp`]: -15 },
      target_results: [{ intent_index: 0, intended_targets: [BRAM], actual_targets: [BRAM], resolution_summary: 'success', roll: 12 }],
    }), name);
    expect(text).toContain('Constable Bram: SUCCEEDS and inflicts a heavy wound');
    expect(text).not.toMatch(/Roll|Target: 50|-15|15/);
  });

  it('states a plain failure as a miss with the target unharmed (not a fumble)', () => {
    const text = renderOutcomeFacts(result({ success: false, target_results: [{ intent_index: 0, intended_targets: [BRAM], actual_targets: [BRAM], resolution_summary: 'fail', roll: 80 }] }), name);
    expect(text).toContain('Constable Bram: FAILS');
    expect(text).toContain('Constable Bram is unharmed');
    expect(text).not.toContain('slips');
  });

  it('a redirected fumble names the bystander who was struck; a non-redirected one hurts nobody', () => {
    const redirected = renderOutcomeFacts(result({
      success: false, numeric_deltas: { [`entities.${KIERA}.properties.hp`]: -4 },
      target_results: [{ intent_index: 0, intended_targets: [BRAM], actual_targets: [KIERA], resolution_summary: 'fumble', roll: 98 }],
    }), name);
    expect(redirected).toContain('striking Kiera instead (a light wound)');
    const contained = renderOutcomeFacts(result({ success: false, target_results: [{ intent_index: 0, intended_targets: [BRAM], actual_targets: [BRAM], resolution_summary: 'fumble', roll: 98 }] }), name);
    expect(contained).toContain('Nobody is hurt');
  });

  it('passes an Impossible ruling through', () => {
    const text = renderOutcomeFacts(result({ success: false, outcome_summary: 'Impossible: humans cannot fly. The attempt does not work and nothing changes.' }), name);
    expect(text).toContain('Impossible: humans cannot fly');
  });
});

describe('renderOutcomeFacts with several actors', () => {
  it('attributes each result to who acted, so an attack and a counter-attack are not confused', () => {
    const dir = { intent_queue: [
      { actor_id: PLAYER, trigger_id: 'combat_action', intended_targets: [BRAM], proximity_cluster: [], parameters: { verb: 'slash' } },
      { actor_id: BRAM, trigger_id: 'combat_action', intended_targets: [PLAYER], proximity_cluster: [], parameters: { verb: 'strike' } },
    ] } as any;
    const names = (id: string) => ({ [PLAYER]: 'Aria Vale', [BRAM]: 'Constable Bram' } as Record<string, string>)[id] ?? 'someone';
    const text = renderOutcomeFacts({
      success: false, outcome_summary: 'x', status_tags: {}, numeric_deltas: { [`entities.${BRAM}.properties.hp`]: -15 },
      target_results: [
        { intent_index: 0, intended_targets: [BRAM], actual_targets: [BRAM], resolution_summary: 'success' },
        { intent_index: 1, intended_targets: [PLAYER], actual_targets: [PLAYER], resolution_summary: 'fail' },
      ],
    } as any, names, dir);
    expect(text).toContain("Aria Vale's slash on Constable Bram: SUCCEEDS and inflicts a heavy wound");
    expect(text).toContain("Constable Bram's strike on Aria Vale: FAILS");
    expect(text).toContain('Aria Vale is unharmed');
  });
});
