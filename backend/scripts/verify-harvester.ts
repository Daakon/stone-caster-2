
import { RulesetHarvester } from '../src/services/game/factory/ruleset.harvester';
import assert from 'assert';

console.log('--- Verifying RulesetHarvester ---');

const harvester = new RulesetHarvester();

// Test Case 1: Basic Types
const ruleset1 = {
    defaults: {
        satiety: 100,               // Number -> Mechanical
        isAlive: true,              // Boolean -> Mechanical
        description: "A hero",      // String -> Narrative
        inventory: ["sword", "map"],// Array<String> -> Narrative
        coords: [10, 20]            // Array<Number> -> Mechanical
    }
};

const result1 = harvester.harvest([ruleset1]);

console.log('Test 1: Basic Heuristics');
try {
    assert.strictEqual(result1.entityDefaults.satiety, 100, 'Satiety should be 100 (Mech)');
    assert.strictEqual(result1.entityDefaults.isAlive, true, 'isAlive should be true (Mech)');
    assert.deepStrictEqual(result1.entityDefaults.coords, [10, 20], 'Coords should be [10, 20] (Mech)');

    assert.strictEqual(result1.visualDefaults.description, "A hero", 'Description should be narrative');
    assert.deepStrictEqual(result1.visualDefaults.inventory, ["sword", "map"], 'Inventory should be narrative');

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
    console.log('Result:', JSON.stringify(result1, null, 2));
}

// Test Case 2: Explicit Scope Override & Complex Objects
const ruleset2 = {
    defaults: {
        mood: { value: "Happy", scope: "mechanical" }, // String enforced as Mechanical
        complexState: { foo: "bar" },                  // Object -> Mechanical default
        hiddenLore: { value: "Secret", scope: "narrative" } // Enforce Narrative
    }
};

const result2 = harvester.harvest([ruleset2]);

console.log('\nTest 2: Scope Overrides');
try {
    assert.strictEqual(result2.entityDefaults.mood, "Happy", 'Mood should be force-mechanical');
    assert.deepStrictEqual(result2.entityDefaults.complexState, { foo: "bar" }, 'Complex object should be mechanical');
    assert.strictEqual(result2.visualDefaults.hiddenLore, "Secret", 'HiddenLore should be force-narrative');

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
    console.log('Result:', JSON.stringify(result2, null, 2));
}

// Test Case 3: Merging
const rulesetA = { defaults: { hp: 10 } };
const rulesetB = { defaults: { hp: 20, mp: 5 } };

const result3 = harvester.harvest([rulesetA, rulesetB]);

console.log('\nTest 3: Merging');
try {
    assert.strictEqual(result3.entityDefaults.hp, 20, 'Later ruleset should override');
    assert.strictEqual(result3.entityDefaults.mp, 5, 'New keys should be added');

    console.log('✅ PASS');
} catch (e) {
    console.error('❌ FAIL', e);
}
