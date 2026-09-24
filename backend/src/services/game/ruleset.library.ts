/**
 * Action Library - V3.0 Action Definitions
 * 
 * This file contains the canonical action definitions for the Deterministic Engine.
 * These definitions are used by the Mock Dispatcher for manual testing.
 */

import type { ActionDefinition } from './resolution.service.js';

/**
 * Master Action Library
 * Maps action slugs to their complete definitions
 */
export const ACTION_LIBRARY: Record<string, ActionDefinition> = {
    /**
     * resolve_clash - Combat action
     * Source: cinematic-combat-lite ruleset
     * Trigger: combat_action intent
     */
    resolve_clash: {
        kind: 'player_initiated',
        logic: [
            {
                step_id: 'deduct_cost',
                function: 'state.modify',
                args: {
                    path: 'tier1_player.current_stamina',
                    amount: -5,
                },
            },
            {
                step_id: 'set_atmosphere',
                function: 'state.set',
                args: {
                    path: 'tier1_world.narrative.atmosphere',
                    value: 'Tense',
                },
            },
            {
                step_id: 'calculate_advantage',
                function: 'logic.map',
                args: {
                    input: 'input.tactic_tag',
                    map: {
                        reckless: -20,
                        trickery: 20,
                        defensive: -10,
                        aggressive: 10,
                    },
                    default: 0,
                },
                output_to: 'tactic_modifier',
            },
            {
                step_id: 'roll_contest',
                function: 'resolution.contest',
                args: {
                    actor_stat_path: 'tier1_player.combat_prowess', // Player is the actor
                    actor_mod: 'tactic_modifier', // Will be resolved from context
                    target_stat_path: 'tier1_entity.combat_prowess', // Target entity
                },
                output_to: 'clash_result',
            },
            {
                step_id: 'escalate_wound_target',
                function: 'state.transition',
                args: {
                    target: 'tier1_entity.combat_condition',
                    map: {
                        Healthy: 'Minor Injury',
                        'Minor Injury': 'Major Injury',
                        'Major Injury': 'Defeated',
                    },
                },
                conditions: [
                    {
                        op: 'eq',
                        left: 'clash_result',
                        right: 'actor_win',
                    },
                ],
            },
            {
                step_id: 'wound_player',
                function: 'state.set',
                args: {
                    path: 'tier1_player.combat_condition',
                    value: 'Wounded',
                },
                conditions: [
                    {
                        op: 'eq',
                        left: 'clash_result',
                        right: 'target_win',
                    },
                ],
            },
        ],
    },

    /**
     * take_rest - Vitality/Time action
     * Source: vitality-stamina-system & needs-survival-basic rulesets
     * Trigger: rest_action intent
     */
    take_rest: {
        kind: 'player_initiated',
        logic: [
            {
                step_id: 'advance_time',
                function: 'state.modify',
                args: {
                    path: 'tier1_world.current_tick',
                    amount: 20,
                },
            },
            {
                step_id: 'restore_stamina',
                function: 'state.modify',
                args: {
                    path: 'tier1_entity.current_stamina',
                    value: 100, // Absolute set via value override
                },
            },
            {
                step_id: 'decay_needs',
                function: 'state.modify',
                args: {
                    path: 'tier1_entity.satiety',
                    amount: -25,
                },
            },
            {
                step_id: 'set_condition',
                function: 'state.set',
                args: {
                    path: 'tier1_entity.physical_condition',
                    value: 'Rested',
                },
            },
            {
                step_id: 'reset_atmosphere',
                function: 'state.set',
                args: {
                    path: 'tier1_world.narrative.atmosphere',
                    value: 'Peaceful',
                },
            },
        ],
    },

    /**
     * apply_relationship_delta - Social action
     * Source: npc-relationships ruleset
     * Trigger: social_action intent
     */
    apply_relationship_delta: {
        kind: 'system_compute',
        logic: [
            {
                step_id: 'identify_axis',
                function: 'logic.map',
                args: {
                    input: 'input.verb',
                    map: {
                        flirt: 'desire',
                        compliment: 'warmth',
                        insult: 'respect',
                        confide: 'trust',
                    },
                    default: 'warmth',
                },
                output_to: 'target_stat_key',
            },
            {
                step_id: 'determine_amount',
                function: 'logic.map',
                args: {
                    input: 'input.verb',
                    map: {
                        flirt: 5,
                        compliment: 5,
                        insult: -15,
                        confide: 10,
                        betray: -50,
                    },
                    default: 0,
                },
                output_to: 'delta_amount',
            },
            {
                step_id: 'apply_delta',
                function: 'state.modify',
                args: {
                    path: 'relationships.{target_id}.stats.{target_stat_key}', // Will be resolved
                    amount: '@delta_amount', // Will be resolved from context
                    clamp_min: 0,
                    clamp_max: 100,
                },
            },
            {
                step_id: 'grant_confidant_tag',
                function: 'state.list_op',
                args: {
                    op: 'add',
                    path: 'relationships.{target_id}.tags', // Will be resolved
                    item: {
                        role: 'Confidant',
                    },
                },
                conditions: [
                    {
                        op: 'gte',
                        left: 'relationships.{target_id}.stats.trust', // Will be resolved
                        right: 80,
                    },
                ],
            },
        ],
    },
};
