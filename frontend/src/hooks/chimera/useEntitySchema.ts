import { useMemo } from 'react';
import type { WorldDefinition, RulesetDefinition } from '@shared/types/chimera-authoring';
import type { FormHint } from '../../types/chimera-form';
import { UNIVERSAL_IDENTITY_RULESET } from '../../data/rulesets/core-identity';

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

    const activeRulesets = useMemo(() => {
        // Cast UNIVERSAL_IDENTITY_RULESET to any to avoid strict type mismatch if RulesetDefinition differs slightly
        // We know it provides the necessary structure.
        return [UNIVERSAL_IDENTITY_RULESET as any, ...(rulesets || [])];
    }, [rulesets]);

    return useMemo(() => {
        const rawFields: Record<string, StepField> = {};

        // Helper: safe merge
        const mergeField = (key: string, source: any, sourceName: string) => {
            const existing = rawFields[key];

            // 1. Extract or Heuristic for Group
            let group = source.ui_group || source.group;
            if (!group && source.section) group = source.section;
            if (existing && !group) group = existing.ui_group; // Keep existing if source has none

            // 2. Extract or Heuristic for Step
            let step = source.ui_step;
            if (!step && source.step) step = source.step;
            if (existing && !step) step = existing.ui_step; // Keep existing if source has none

            // HEURISTICS: If Step is still missing, guess based on key
            if (!step) {
                const lowerKey = key.toLowerCase();
                if (
                    lowerKey.includes('race') ||
                    lowerKey.includes('species') ||
                    lowerKey.includes('archetype') ||
                    lowerKey.includes('class')
                ) {
                    step = 'identity';
                    if (!group) group = 'Background & Origin';
                } else {
                    step = 'attributes';
                    // Default group for attributes if missing
                    if (!group) group = 'General';
                }
            }

            // Fallback group if still missing after heuristics
            if (!group) {
                group = sourceName; // Default to Source Name
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
                ui_order: source.ui_order ?? existing?.ui_order ?? 999, // Added ui_order
                default: source.default ?? existing?.default,
                options: source.options || existing?.options,
                min: source.min ?? existing?.min,
                max: source.max ?? existing?.max,
                description: source.description || existing?.description,
                ...source
            };

            rawFields[key] = merged;
        };

        // 1. Process RuleSets (including Universal Identity)
        activeRulesets.forEach(ruleset => {
            // Handle both flat structure (RulesetDefinition) and nested structure (RulesetTemplate)
            const contributions =
                // Priority 1: Direct contributions (RulesetDefinition)
                ruleset.character_schema_contributions?.tier1_entity
                || ruleset.state_contributions?.tier1_entity
                || ruleset.state_contributions
                // Priority 2: Nested in definition (RulesetTemplate)
                || ruleset.definition?.state_contributions?.tier1_entity
                || {};

            const definitions = contributions.definitions || {};
            const hints = contributions.form_hints || {};

            Object.entries(definitions).forEach(([key, val]) => {
                mergeField(key, val, ruleset.name || ruleset.definition?.name || 'Ruleset');
            });

            Object.entries(hints).forEach(([key, val]) => {
                mergeField(key, val, ruleset.name || ruleset.definition?.name || 'Ruleset');
            });
        });

        // 2. Process World Extensions (overrides rulesets)
        if (world?.character_schema_extensions) {
            Object.entries(world?.character_schema_extensions || {}).forEach(([key, val]) => {
                mergeField(key, val, 'Core Rules');
            });
        }

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

        // FORCE IDENTITY STEP if somehow missing
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
            // Sort Groups by priority
            step.groups.sort((a, b) => a.priority - b.priority);

            // Sort Fields by ui_order
            step.groups.forEach(group => {
                group.fields.sort((a, b) => (a.ui_order ?? 999) - (b.ui_order ?? 999));
            });
        });

        return sortedSteps;
    }, [world, activeRulesets, targetKind]);
}

function capitalize(s: string) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
