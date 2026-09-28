import { describe, expect, it } from 'vitest';
import { applyFrozenStateDefaults } from './frozen-state-initializer.js';
import type { GameStateBundle } from '../../domain/game-state.types.js';

const makeBundle = (): GameStateBundle => ({
  mechanical: {
    globals: {current_tick: 7},
    index: {player_id: 'player'},
    entities: {
      player: {id:'player', type:'PLAYER', status:'active', properties:{current_stamina: 9}},
      npc: {id:'npc', type:'NPC', status:'active', properties:{display_name:'Kiera'}},
    },
  },
  narrative: {scene_context:{name:'Mystika', description:''}, entity_visuals:{}, dialogue_history:[]},
  registry: {active_scene_id:'start', entity_locations:{}, node_states:{}},
});

const compiled = {
  snapshot_world: {key:'mystika', character_schema_contributions:{tier1_entity:{definitions:{race_handle:{value:'Human'}}}}},
  config_engine: {active_rulesets:[{
    key:'vitality', content_hash:'a'.repeat(64), definition:{state_contributions:{
      tier1_entity:{definitions:{
        current_stamina:{value:100, target_kind:['player']},
        combat_condition:{value:'Healthy', target_kind:['player','npc']},
      }},
      tier1_world:{definitions:{current_tick:{value:0}, time_band:{value:'scene'}}},
      tier2_system:{definitions:{success_bands:{value:{critical:5}}}},
    }},
  }]},
};

describe('frozen state initialization', () => {
  it('uses pinned definitions for player, NPC, world and system while preserving explicit values', () => {
    const bundle = makeBundle();
    const source = structuredClone(compiled);
    applyFrozenStateDefaults(bundle, compiled);
    expect(bundle.mechanical.entities.player.properties).toMatchObject({
      current_stamina:9, combat_condition:'Healthy', race_handle:'Human',
    });
    expect(bundle.mechanical.entities.npc.properties).toMatchObject({
      display_name:'Kiera', combat_condition:'Healthy', race_handle:'Human',
    });
    expect(bundle.mechanical.entities.npc.properties.current_stamina).toBeUndefined();
    expect(bundle.mechanical.globals).toMatchObject({current_tick:7, time_band:'scene', tier2_system:{success_bands:{critical:5}}});
    (bundle.mechanical.globals as any).tier2_system.success_bands.critical = 99;
    expect(compiled).toEqual(source);
  });

  it('rejects a missing starting value before the state can be saved', () => {
    const invalid = structuredClone(compiled);
    delete (invalid.config_engine.active_rulesets[0].definition.state_contributions.tier1_world.definitions.current_tick as any).value;
    expect(() => applyFrozenStateDefaults(makeBundle(), invalid)).toThrow(/ruleset:vitality@.*current_tick has no starting value/);
  });
});
