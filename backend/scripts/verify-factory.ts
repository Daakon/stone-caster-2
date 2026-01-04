
import { GameStateFactory } from '../src/services/game/factory/game-state.factory';
import { RulesetHarvester } from '../src/services/game/factory/ruleset.harvester';
import { EntityProjector } from '../src/services/game/factory/entity.projector';
import { CharacterTemplate } from '../src/domain/character.types';
import assert from 'assert';

console.log('--- Verifying GameStateFactory ---');

// Setup Dependencies
const harvester = new RulesetHarvester();
const projector = new EntityProjector();
const factory = new GameStateFactory(harvester, projector);

// Mock Data
const activeRulesets = [
    {
        defaults: {
            hp: 100, // Mech
            time_scale: 1, // Mech (Global if heuristic fails? No, defaults usually entity. Force global?)
            // Let's rely on Harvester default behavior: defaults -> entityDefaults
        },
        globals: {
            danger_level: 5 // Explicit Global
        }
    },
    {
        defaults: {
            race_description: "A stalwart human" // Narr
        }
    }
];

const playerTemplate: CharacterTemplate = {
    id: "hero-1",
    name: "Arthur",
    state_snapshot: {
        tier1_entity: { hp: 120 } // Override
    }
};

const storyId = "story-x";

const bundle = factory.createBundle(storyId, playerTemplate, activeRulesets);

console.log('Test 1: Bundle Assembly');
try {
    // Mechanical State
    assert.strictEqual(bundle.mechanical.globals.danger_level, 5, 'Globals should be populated');
    assert.strictEqual(bundle.mechanical.entities["hero-1"].properties.hp, 120, 'Entity props should be merged');
    assert.strictEqual(bundle.mechanical.index.player_id, "hero-1", 'Index should point to player');

    // Narrative Focus
    assert.strictEqual(bundle.narrative.entity_visuals["hero-1"], undefined, 'No visual override for hero, so undefined key?');
    // Wait, "race_description" is generic visual default, handled by projector?
    // Projector: visualDefaults (generic) are spread into visuals.
    // So bundle.narrative.entity_visuals["race_description"] should exist.
    assert.strictEqual(bundle.narrative.entity_visuals.race_description, "A stalwart human", 'Generic visuals should pass through');

    // Registry
    assert.strictEqual(bundle.registry.active_scene_id, "start_node");
    assert.strictEqual(bundle.registry.entity_locations["hero-1"], "start_node");

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
    console.log('Result:', JSON.stringify(bundle, null, 2));
}
