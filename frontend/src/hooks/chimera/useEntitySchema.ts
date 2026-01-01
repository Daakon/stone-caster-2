import { useMemo } from 'react';
import type { WorldDefinition, RulesetDefinition } from '@shared/types/chimera-authoring';
import type { FormHint } from '../../types/chimera-form';

export interface StepDefinition {
    id: string;
    label: string;
    priority: number;
    groups: GroupDefinition[];
}

export interface GroupDefinition {
    id: string;
    label: string;
    priority: number;
    fields: StepField[];
}

export interface StepField extends FormHint {
    key: string;
    defaultValue?: any;
    ui_step?: string;
    ui_step_priority?: number;
    ui_group?: string;
    ui_group_priority?: number;
}

export interface UseEntitySchemaOptions {
    targetKind: 'player' | 'npc';
}

const UNIVERSAL_IDENTITY_SCHEMA: Record<string, Partial<StepField>> = {
    name: {
        key: 'name',
        label: 'Character Name',
        control: 'text',
        ui_step: 'identity',
        ui_step_priority: 0,
        ui_group: 'Character Basics',
        ui_group_priority: 0,
        description: "What are you called?",
        default: ''
    },
    pronouns: {
        key: 'pronouns',
        label: 'Pronouns',
        control: 'select',
        options: ['He/Him', 'She/Her', 'They/Them', 'Other'],
        ui_step: 'identity',
        ui_step_priority: 0,
        ui_group: 'Character Basics',
        ui_group_priority: 0,
        default: 'They/Them'
    },
    age: {
        key: 'age',
        label: 'Age',
        control: 'number',
        ui_step: 'identity',
        ui_step_priority: 0,
        ui_group: 'Character Basics',
        ui_group_priority: 0,
        default: 25
    },
    appearance: {
        key: 'appearance',
        label: 'Visual Description',
        control: 'textarea',
        ui_step: 'identity',
        ui_step_priority: 0,
        ui_group: 'Character Basics',
        ui_group_priority: 0,
        description: "How do you look to others?",
        default: ''
    },
    backstory: {
        key: 'backstory',
        label: 'History & Origin',
        control: 'textarea',
        ui_step: 'identity',
        ui_step_priority: 0,
        ui_group: 'Character Basics',
        ui_group_priority: 0,
        description: "Where do you come from?",
        default: ''
    }
};

/**
 * Aggregates and structures the schema for an entity based on the World and Rulesets.
 * STRICT MODE: Enforces Step -> Group -> Field hierarchy.
 */
export function useEntitySchema(
    world: WorldDefinition | undefined,
    rulesets: RulesetDefinition[] | undefined,
    options: UseEntitySchemaOptions
) {
    const { targetKind } = options;

    return useMemo(() => {
        // Initialize with Universal Identity
        const rawFields: Record<string, StepField> = {};

        Object.values(UNIVERSAL_IDENTITY_SCHEMA).forEach(field => {
            if (field.key) {
                rawFields[field.key] = field as StepField;
            }
        });

        // Helper: safe merge
        const mergeField = (key: string, source: any, sourceName: string) => {
            const existing = rawFields[key];

            // Extract ui_group:
            let group = source.ui_group || source.group;
            if (!group && source.section) group = source.section;

            if (!group) {
                if (existing) {
                    group = existing.ui_group; // Keep existing group if not overridden
                } else {
                    group = sourceName; // Default to Source Name
                }
            }

            // Extract ui_step:
            let step = source.ui_step;
            if (!step && source.step) step = source.step;
            if (!step) {
                if (existing) {
                    step = existing.ui_step;
                } else {
                    step = 'misc';
                }
            }

            // Merge
            const merged: StepField = {
                key: key,
                label: source.label || existing?.label || key,
                control: source.control || existing?.control || 'text',
                ui_step: step,
                ui_step_priority: source.ui_step_priority ?? existing?.ui_step_priority ?? 99,
                ui_group: group,
                ui_group_priority: source.ui_group_priority ?? existing?.ui_group_priority ?? 50,
                default: source.default ?? existing?.default,
                options: source.options || existing?.options,
                min: source.min ?? existing?.min,
                max: source.max ?? existing?.max,
                description: source.description || existing?.description,
                ...source
            };

            rawFields[key] = merged;
        };

        // 1. Process World Extensions
        if (world?.character_schema_extensions) {
            Object.entries(world?.character_schema_extensions || {}).forEach(([key, val]) => {
                mergeField(key, val, 'Core Rules');
            });
        }

        // 2. Process Rulesets
        rulesets?.forEach(ruleset => {
            const contributions = ruleset.character_schema_contributions?.tier1_entity
                || ruleset.state_contributions
                || {};

            const definitions = contributions.definitions || {};
            const hints = contributions.form_hints || {};

            Object.entries(definitions).forEach(([key, val]) => {
                mergeField(key, val, ruleset.name || 'Ruleset');
            });

            Object.entries(hints).forEach(([key, val]) => {
                mergeField(key, val, ruleset.name || 'Ruleset');
            });
        });

        // 3. Structure into Steps > Groups > Fields
        const stepsMap = new Map<string, StepDefinition>();

        Object.values(rawFields).forEach(field => {
            const stepId = field.ui_step || 'misc';
            const groupId = field.ui_group || 'General';

            // Get or create Step
            if (!stepsMap.has(stepId)) {
                stepsMap.set(stepId, {
                    id: stepId,
                    label: capitalize(stepId),
                    // Priority defaults
                    priority: field.ui_step_priority ?? (stepId === 'identity' ? 0 : (stepId === 'attributes' ? 20 : (stepId === 'personality' ? 30 : 99))),
                    groups: []
                });
            }
            const step = stepsMap.get(stepId)!;

            if (field.ui_step_priority !== undefined && field.ui_step_priority < step.priority) {
                step.priority = field.ui_step_priority;
            }

            // Get or create Group within Step
            let group = step.groups.find(g => g.id === groupId);
            if (!group) {
                group = {
                    id: groupId,
                    label: groupId,
                    priority: field.ui_group_priority ?? 50,
                    fields: []
                };
                step.groups.push(group);
            }

            if (field.ui_group_priority !== undefined && field.ui_group_priority < group.priority) {
                group.priority = field.ui_group_priority;
            }

            group.fields.push(field);
        });

        // FORCE IDENTITY STEP if somehow missing (though Universal should ensure it)
        if (!stepsMap.has('identity')) {
            stepsMap.set('identity', {
                id: 'identity',
                label: 'Identity',
                priority: 0,
                groups: []
            });
        }

        // 4. Sort
        const sortedSteps = Array.from(stepsMap.values()).sort((a, b) => a.priority - b.priority);

        sortedSteps.forEach(step => {
            step.groups.sort((a, b) => a.priority - b.priority);
        });

        return sortedSteps;
    }, [world, rulesets, targetKind]);
}

function capitalize(s: string) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
