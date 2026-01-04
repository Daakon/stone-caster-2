
import { EntityProjector } from '../src/services/game/factory/entity.projector';
import { CharacterTemplate } from '../src/domain/character.types';
import assert from 'assert';

console.log('--- Verifying EntityProjector ---');

const projector = new EntityProjector();

// Mock Data
const mechDefaults = { hp: 100, mp: 50, strength: 10 };
const visualDefaults = { default_robe: "Simple Robe" };

const template: CharacterTemplate = {
    id: "char-123",
    name: "Hero",
    // Simulate DB snapshot
    state_snapshot: {
        tier1_entity: {
            strength: 15,    // Override
            xp: 0           // New prop
        },
        appearance: "A glowing aura" // Explicit visual
    }
};

const result = projector.project(template, mechDefaults, visualDefaults);

console.log('Test 1: Projecting Entity');
try {
    // Check Props
    assert.strictEqual(result.entity.id, "char-123");
    assert.strictEqual(result.entity.properties.hp, 100, 'Should inherit mechanical default');
    assert.strictEqual(result.entity.properties.strength, 15, 'Should override default');
    assert.strictEqual(result.entity.properties.xp, 0, 'Should include new prop');

    // Check Visuals
    assert.strictEqual(result.visuals["char-123"], "A glowing aura", 'Should extract appearance');
    assert.strictEqual(result.visuals.default_robe, "Simple Robe", 'Should keep other visual defaults');

    // Check Purity using JSON stringify to avoid prototype issues if any
    const propKeys = Object.keys(result.entity.properties);
    assert.ok(!propKeys.includes('appearance'), 'Properties should NOT include appearance');

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
    console.log('Result:', JSON.stringify(result, null, 2));
}

// Test 2: Extraction from Tier 1 (Legacy/Mixed Data)
const mixedTemplate: CharacterTemplate = {
    id: "char-456",
    name: "Miner",
    state_snapshot: {
        tier1_entity: {
            hp: 50,
            description: "Dusty clothes" // Should be extracted
        }
    }
};

const result2 = projector.project(mixedTemplate, {}, {});
console.log('\nTest 2: Extraction from Props');
try {
    assert.strictEqual(result2.visuals["char-456"], "Dusty clothes", 'Should extract description');
    assert.ok(!result2.entity.properties.description, 'Should remove description from props');

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
    console.log('Result:', JSON.stringify(result2, null, 2));
}
