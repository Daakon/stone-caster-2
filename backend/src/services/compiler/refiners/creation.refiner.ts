import { CreationManifest, CreationStep, CreationGroup, CreationField } from '../types';

export class CreationRefiner {
    static refine(rulesets: any[], targetKind: string = 'player'): CreationManifest {
        // 1. Universal Identity Baseline
        const stepsMap = new Map<string, CreationStep>();
        const groupsMap = new Map<string, Map<string, CreationGroup & { fieldsMap: Map<string, CreationField> }>>();

        // Helper to get or create step
        const getStep = (id: string, label: string, priority: number) => {
            if (!stepsMap.has(id)) {
                // Initialize step (groups will be added at the end from maps)
                stepsMap.set(id, { id, label, priority, groups: [] });
                // We keep a parallel map for groups to make lookup easier
                groupsMap.set(id, new Map());
            }
            // Update priority if new one is lower (optional, but ensures "Identity" stays 10 if defined elsewhere with same ID)
            const step = stepsMap.get(id)!;
            if (priority < step.priority && priority > 0) step.priority = priority;
            return step;
        };

        // Helper to get or create group
        const getGroup = (stepId: string, groupId: string, label: string, priority: number) => {
            // Ensure step exists (default to 50/Generic if not explicitly made yet)
            if (!stepsMap.has(stepId)) {
                const stepLabel = stepId.charAt(0).toUpperCase() + stepId.slice(1);
                getStep(stepId, stepLabel, 50);
            }

            const stepGroups = groupsMap.get(stepId)!;
            if (!stepGroups.has(groupId)) {
                // We add an internal 'fieldsMap' to track deduplication efficiently
                stepGroups.set(groupId, {
                    id: groupId,
                    label,
                    priority,
                    fields: [],
                    fieldsMap: new Map()
                });
            }
            // Update label/priority if we have a better one now
            const group = stepGroups.get(groupId)!;
            if (label && label !== groupId) group.label = label;
            if (priority < group.priority && priority > 0) group.priority = priority;

            return group;
        };

        // Initialize Universal Structure
        // Step: Identity (10)
        getStep('identity', 'Identity', 10);

        // Groups
        getGroup('identity', 'essentials', 'Essentials', 10);
        getGroup('identity', 'visuals', 'Visuals', 20);
        getGroup('identity', 'history', 'History', 30);
        getGroup('identity', 'background', 'Background & Origin', 40); // Standard place for Race/Class

        // Universal Fields (Hardcoded)
        // Note: These use 'ui_order' to sort within their groups
        const universalFields: Partial<CreationField>[] = [
            { key: 'name', label: 'Name', control: 'text', ui_order: 10, group: 'essentials' },
            { key: 'pronouns', label: 'Pronouns', control: 'text', ui_order: 20, group: 'essentials' },
            { key: 'age', label: 'Age', control: 'number', ui_order: 30, group: 'essentials' },
            { key: 'appearance', label: 'Appearance', control: 'textarea', ui_order: 10, group: 'visuals' },
            { key: 'backstory', label: 'Backstory', control: 'textarea', ui_order: 10, group: 'history' },
        ];

        universalFields.forEach(f => {
            // We know these go into 'identity' step
            const groupId = f.group as string;
            const group = getGroup('identity', groupId, '', 0);

            // Avoid duplicates (though this is fresh manifest)
            // We construct the field object
            const field: CreationField = {
                key: f.key!,
                label: f.label!,
                control: f.control!,
                ui_order: f.ui_order!,
                ...f // Spread any extras
            };
            delete field.group; // cleanup

            group.fieldsMap.set(field.key, field);
        });

        // 2. Iterate Rulesets
        rulesets.forEach(ruleset => {
            const def = ruleset.definition || {};

            // Security Filter: Exclude Rulesets specifically targeted at incompatible kinds
            // Default: ['player', 'npc'] (Universal)
            const rulesetTargets = def.state_contributions?.tier1_entity?.target_kind || ['player', 'npc'];

            // IF targets are defined AND targetKind is NOT in the allowed list -> SKIP
            if (Array.isArray(rulesetTargets) && !rulesetTargets.includes(targetKind)) {
                return;
            }

            const contributions = def.state_contributions?.tier1_entity || {};
            const formHints = contributions.form_hints || {};
            const definitions = contributions.definitions || {};

            Object.entries(formHints).forEach(([key, hint]: [string, any]) => {
                // Security Filter: Exclude Fields specifically targeted at incompatible kinds
                const fieldDef = definitions[key];

                // Check field-level target override
                if (fieldDef?.target_kind) {
                    const fieldTargets = fieldDef.target_kind;
                    if (Array.isArray(fieldTargets) && !fieldTargets.includes(targetKind)) {
                        return; // Skip this field
                    }
                }

                // Determine Placement
                let stepId = hint.ui_step;
                let groupId = hint.ui_group;
                let stepPriority = hint.ui_step_priority;
                let groupPriority = hint.ui_group_priority;
                let uiOrder = hint.ui_order ?? 99;

                // Heuristic Classification (Legacy Support)
                if (!stepId) {
                    const lowerKey = key.toLowerCase();
                    const lowerLabel = (hint.label || '').toLowerCase();

                    if (['race', 'species', 'archetype', 'class', 'origin'].some(k => lowerKey.includes(k) || lowerLabel.includes(k))) {
                        stepId = 'identity';
                        groupId = 'background';
                        if (!stepPriority) stepPriority = 10;
                        if (!groupPriority) groupPriority = 40;
                    } else {
                        stepId = 'attributes';
                        groupId = 'general';
                        if (!stepPriority) stepPriority = 20; // Default Attributes to step 2
                        if (!groupPriority) groupPriority = 10;
                    }
                }

                // Defaults if still missing
                if (!groupId) groupId = 'general';
                if (!stepPriority) stepPriority = 50;
                if (!groupPriority) groupPriority = 50;

                // Refine Labels
                // If the ruleset provides a Label for the step/group via some other mechanism, we'd use it.
                // For now, we capitalize ID if label is generic.
                const stepLabel = stepId.charAt(0).toUpperCase() + stepId.slice(1);
                const groupLabel = groupId.charAt(0).toUpperCase() + groupId.slice(1);

                // Add to Structure
                // Note: We use the Priority from the Ruleset if present, otherwise default
                getStep(stepId, stepLabel, stepPriority);
                const group = getGroup(stepId, groupId, groupLabel, groupPriority);

                // Add Field (LAST WRITE WINS DEDUPLICATION)
                // We simply set it in the map. If it exists, it gets overwritten.
                group.fieldsMap.set(key, {
                    key,
                    label: hint.label || key,
                    control: hint.control || 'text',
                    ui_order: uiOrder,
                    ...hint // spread other props like suggestions, options, etc.
                });
            });
        });

        // 3. Structural Organization & Sorting
        const manifest: CreationManifest = { steps: [] };

        // Sort Steps
        const sortedSteps = Array.from(stepsMap.values()).sort((a, b) => a.priority - b.priority);

        sortedSteps.forEach(step => {
            const stepGroups = groupsMap.get(step.id)!;
            const sortedGroups = Array.from(stepGroups.values()).sort((a, b) => a.priority - b.priority);

            // Convert Groups Map -> Array and cleanup internal fieldsMap
            const cleanGroups: CreationGroup[] = sortedGroups.map(g => {
                // Convert Fields Map -> Array and Sort
                const sortedFields = Array.from(g.fieldsMap.values()).sort((a, b) => a.ui_order - b.ui_order);

                return {
                    id: g.id,
                    label: g.label,
                    priority: g.priority,
                    fields: sortedFields
                };
            });

            step.groups = cleanGroups;
            manifest.steps.push(step);
        });

        return manifest;
    }
}
