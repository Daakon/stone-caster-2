// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * StateService unit tests — delta application semantics.
 *
 * The turn pipeline trusts applyDeltas to (a) actually land engine deltas in
 * state and (b) report what landed so the client delta is truthful. These
 * tests pin down the entity-resource vivification and clamping rules that
 * make vitals (current_stamina, hp) and relationships persist.
 */

import { describe, it, expect } from 'vitest';
import { StateService } from './state.service.js';
import { resolveConditionRules, DEFAULT_CONDITION_RULES, type ConditionTransition } from './condition-rules.js';
import type { GameState } from '@shared/types/chimera-runtime';

const PLAYER_ID = 'player-1';
const NPC_ID = 'npc-1';

const makeState = (): GameState => ({
    story_id: 'story-1',
    player_id: PLAYER_ID,
    tier1_mechanical: {
        index: { player_id: PLAYER_ID },
        entities: {
            [PLAYER_ID]: {
                id: PLAYER_ID,
                type: 'PLAYER',
                properties: { name: 'Hero', hp: 100, maxHp: 100, current_stamina: 100 },
            },
            [NPC_ID]: {
                id: NPC_ID,
                type: 'NPC',
                // Genesis NPCs often ship without vitals — writes must still land
                properties: { name: 'Guard' },
            },
        },
    },
    tier0_narrative: {},
} as unknown as GameState);

describe('StateService.applyDeltas', () => {
    it('applies deltas to existing entity resources and reports them', () => {
        const svc = new StateService(makeState());
        const applied = svc.applyDeltas({
            [`entities.${PLAYER_ID}.properties.current_stamina`]: -7,
        });

        expect(applied[`entities.${PLAYER_ID}.properties.current_stamina`]).toBe(-7);
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[PLAYER_ID].properties.current_stamina).toBe(93);
    });

    it('initializes missing vital resources from their baseline instead of dropping the write', () => {
        const svc = new StateService(makeState());
        // NPC has no hp property; the engine computes damage against base 100
        const applied = svc.applyDeltas({
            [`entities.${NPC_ID}.properties.hp`]: -15,
        });

        expect(applied[`entities.${NPC_ID}.properties.hp`]).toBe(-15);
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[NPC_ID].properties.hp).toBe(85);
    });

    it('creates relationships on first write with baseline 5 and clamps to 0-20', () => {
        const svc = new StateService(makeState());
        const applied = svc.applyDeltas({
            [`entities.${NPC_ID}.relationships.trust`]: -10, // 5 - 10 -> clamped to 0
            [`entities.${NPC_ID}.relationships.desire`]: 2,  // 5 + 2 = 7
        });

        // Reported delta is what LANDED after clamping, not the intent
        expect(applied[`entities.${NPC_ID}.relationships.trust`]).toBe(-5);
        expect(applied[`entities.${NPC_ID}.relationships.desire`]).toBe(2);

        const state = svc.getState() as any;
        const rels = state.tier1_mechanical.entities[NPC_ID].relationships;
        expect(rels.trust).toBe(0);
        expect(rels.desire).toBe(7);
    });

    it('floors vital resources at 0', () => {
        const svc = new StateService(makeState());
        const applied = svc.applyDeltas({
            [`entities.${PLAYER_ID}.properties.current_stamina`]: -150,
        });

        expect(applied[`entities.${PLAYER_ID}.properties.current_stamina`]).toBe(-100);
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[PLAYER_ID].properties.current_stamina).toBe(0);
    });

    it('drops writes to unknown entities and omits them from the applied map', () => {
        const svc = new StateService(makeState());
        const applied = svc.applyDeltas({
            'entities.ghost-entity.properties.hp': -20,
            [`entities.${PLAYER_ID}.properties.hp`]: -10,
        });

        expect(applied['entities.ghost-entity.properties.hp']).toBeUndefined();
        expect(applied[`entities.${PLAYER_ID}.properties.hp`]).toBe(-10);
    });

    it('does not vivify unknown non-resource properties', () => {
        const svc = new StateService(makeState());
        const applied = svc.applyDeltas({
            [`entities.${PLAYER_ID}.properties.not_a_resource`]: 3,
        });

        expect(applied[`entities.${PLAYER_ID}.properties.not_a_resource`]).toBeUndefined();
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[PLAYER_ID].properties.not_a_resource).toBeUndefined();
    });

    it('still modifies pre-existing custom numeric properties without clamping', () => {
        const base = makeState() as any;
        base.tier1_mechanical.entities[PLAYER_ID].properties.reputation = 2;
        const svc = new StateService(base);

        const applied = svc.applyDeltas({
            [`entities.${PLAYER_ID}.properties.reputation`]: -5,
        });

        expect(applied[`entities.${PLAYER_ID}.properties.reputation`]).toBe(-5);
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[PLAYER_ID].properties.reputation).toBe(-3);
    });
});

describe('StateService.deriveConditionChanges', () => {
    const HOSTILE_ID = 'enemy-1';

    const makeCombatState = (): GameState => {
        const base = makeState() as any;
        base.tier1_mechanical.entities[NPC_ID].properties = { name: 'Guard', hp: 50, maxHp: 50 };
        base.tier1_mechanical.entities[HOSTILE_ID] = {
            id: HOSTILE_ID,
            type: 'enemy',
            properties: { name: 'Bandit', hp: 40, maxHp: 40 },
        };
        return base as GameState;
    };

    const findTransition = (
        transitions: ConditionTransition[],
        entityId: string,
        property: ConditionTransition['property'] = 'combat_condition'
    ) => transitions.find(t => t.entity_id === entityId && t.property === property);

    it('marks entities Wounded at or below half HP (default rules)', () => {
        const svc = new StateService(makeCombatState());
        svc.applyDeltas({ [`entities.${NPC_ID}.properties.hp`]: -26 }); // 24/50
        const transitions = svc.deriveConditionChanges();

        expect(findTransition(transitions, NPC_ID)?.to).toBe('Wounded');
        const state = svc.getState() as any;
        expect(state.tier1_mechanical.entities[NPC_ID].properties.combat_condition).toBe('Wounded');
    });

    it('marks non-hostile entities Critical and hostile entities Surrendered below quarter HP', () => {
        const svc = new StateService(makeCombatState());
        svc.applyDeltas({
            [`entities.${NPC_ID}.properties.hp`]: -40,     // 10/50 = 20%
            [`entities.${HOSTILE_ID}.properties.hp`]: -32, // 8/40 = 20%
        });
        const transitions = svc.deriveConditionChanges();

        expect(findTransition(transitions, NPC_ID)?.to).toBe('Critical');
        expect(findTransition(transitions, HOSTILE_ID)?.to).toBe('Surrendered');
    });

    it('marks hostile entities Defeated and everyone else Unconscious at 0 HP', () => {
        const svc = new StateService(makeCombatState());
        svc.applyDeltas({
            [`entities.${PLAYER_ID}.properties.hp`]: -150,  // player collapses
            [`entities.${HOSTILE_ID}.properties.hp`]: -100,
        });
        const transitions = svc.deriveConditionChanges();

        expect(findTransition(transitions, PLAYER_ID)?.to).toBe('Unconscious');
        expect(findTransition(transitions, HOSTILE_ID)?.to).toBe('Defeated');
    });

    it('derives physical condition from stamina bands', () => {
        const svc = new StateService(makeCombatState());
        svc.applyDeltas({ [`entities.${PLAYER_ID}.properties.current_stamina`]: -100 });
        const transitions = svc.deriveConditionChanges();

        expect(findTransition(transitions, PLAYER_ID, 'physical_condition')?.to).toBe('Collapsed');
    });

    it('never writes default conditions onto untouched entities and only reports transitions (with from/to)', () => {
        const svc = new StateService(makeCombatState());

        // No deltas applied — everyone is at full vitals
        expect(svc.deriveConditionChanges()).toEqual([]);

        // Wound then re-derive without changes: second call reports nothing new
        svc.applyDeltas({ [`entities.${NPC_ID}.properties.hp`]: -26 });
        const first = findTransition(svc.deriveConditionChanges(), NPC_ID);
        expect(first?.to).toBe('Wounded');
        expect(first?.from).toBeUndefined(); // no prior condition existed
        expect(svc.deriveConditionChanges()).toEqual([]);

        // Healing back above half flips it back to Healthy, from is recorded
        svc.applyDeltas({ [`entities.${NPC_ID}.properties.hp`]: 20 });
        const recovered = findTransition(svc.deriveConditionChanges(), NPC_ID);
        expect(recovered?.from).toBe('Wounded');
        expect(recovered?.to).toBe('Healthy');
    });

    it('evaluates STORY-DEFINED rules instead of engine defaults when provided', () => {
        // A grim story: no surrender — hostiles fight to the death, and the
        // wounded threshold is much higher.
        const storyRules = resolveConditionRules({
            config_mechanics: {
                runtime: {
                    condition_rules: {
                        health_bands: [
                            { max_ratio: 0, condition: 'Dying', hostile_condition: 'Slain' },
                            { max_ratio: 0.75, condition: 'Bloodied' },
                        ],
                        health_default: 'Unharmed',
                    },
                },
            },
        });

        const svc = new StateService(makeCombatState());
        svc.applyDeltas({
            [`entities.${NPC_ID}.properties.hp`]: -15,      // 35/50 = 70% → Bloodied
            [`entities.${HOSTILE_ID}.properties.hp`]: -100, // 0 → Slain (not Defeated)
        });
        const transitions = svc.deriveConditionChanges(storyRules);

        expect(findTransition(transitions, NPC_ID)?.to).toBe('Bloodied');
        expect(findTransition(transitions, HOSTILE_ID)?.to).toBe('Slain');

        // Stamina rules were not overridden, so the engine defaults still apply
        expect(storyRules.stamina_bands).toEqual(DEFAULT_CONDITION_RULES.stamina_bands);
    });
});
