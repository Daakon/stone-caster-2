
import { useQuery } from '@tanstack/react-query';
import { useWorldDetail, getRulesets } from '@/services/chimera-api';
// @ts-ignore - The type is available in the workspace but TS might complain without restart
import { type RulesetDefinition } from '@shared/types/chimera-authoring';
import { useMemo } from 'react';

// Simple deep merge utility
function deepMerge(target: any, source: any): any {
    const isObject = (obj: any) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            // Concat and unique
            target[key] = Array.from(new Set(targetValue.concat(sourceValue)));
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

interface UseRulesetSchemaProps {
    worldId: string;
    targetType: string; // 'NPC', 'LOCATION', 'PLAYER', 'STORY'
    manualKeys?: string[];
}

interface UseRulesetSchemaResult {
    schema: Record<string, any>;
    availableOptionalRulesets: RulesetDefinition[];
    isLoading: boolean;
    error: Error | null;
}

export function useRulesetSchema({ worldId, targetType, manualKeys = [] }: UseRulesetSchemaProps): UseRulesetSchemaResult {
    // 1. Fetch World Details to get active rulesets
    const { data: world, isLoading: isWorldLoading, error: worldError } = useWorldDetail(worldId || '');

    // 2. Fetch ALL Ruleset Definitions (Bulk Fetch)
    // We fetch all because filtering client-side for "active" ones is more reliable 
    // given we have the IDs in the world object locally.
    const { data: allRulesets, isLoading: isLoadingRulesets, error: rulesetError } = useQuery({
        queryKey: ['rulesets', 'all'],
        queryFn: () => getRulesets(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Helper to extract state_contributions from various potential structures
    function getContributions(ruleset: any): any {
        return ruleset.state_contributions || ruleset.definition?.state_contributions || {};
    }

    // 3. Compute Merged Schema & Available Optionals
    const { schema: mergedSchema, availableOptionalRulesets } = useMemo(() => {
        if (!world || !allRulesets) return { schema: {}, availableOptionalRulesets: [] };

        const worldAny = world as any;

        // A. Robust "Required" Extraction
        // Extract IDs
        const worldRulesetIds: string[] = [
            ...(worldAny.ruleset_template_ids || []),
            ...(worldAny.definition?.ruleset_template_ids || []),
            ...(worldAny.metadata?.ruleset_keys || []), // Legacy fallback
            ...(worldAny.ruleset_keys || [])            // Legacy fallback
        ];
        // Deduplicate IDs
        const uniqueWorldRulesetIds = Array.from(new Set(worldRulesetIds));

        // DEBUG LOGGING
        console.log('[SchemaEngine] World Ruleset IDs:', uniqueWorldRulesetIds);
        console.log('[SchemaEngine] All Rulesets Count:', allRulesets.length);
        if (allRulesets.length > 0) {
            console.log('[SchemaEngine] Sample Ruleset ID:', allRulesets[0].id);
            console.log('[SchemaEngine] Sample Ruleset keys:', Object.keys(allRulesets[0]));
        }

        // Extract Base Schema (character_schema_contributions)
        // Ensure we deep copy it to avoid mutation issues
        // If the worldBaseSchema has explicit 'tier1_entity' then great.
        const worldBaseSchema = deepMerge({}, worldAny.character_schema_contributions ||
            worldAny.definition?.character_schema_contributions || {});

        console.log('[SchemaEngine] World Base Schema Keys:', Object.keys(worldBaseSchema));

        // B. Categorize Rulesets
        const requiredRulesets: RulesetDefinition[] = [];
        const manualRulesets: RulesetDefinition[] = [];
        const availableOptionalRulesets: RulesetDefinition[] = [];

        for (const r of allRulesets) {
            const contributions = getContributions(r);
            const tier1 = contributions.tier1_entity; // Common structure check

            // Check Matching Target Type (Case-Insensitive)
            let matchesTarget = false;

            if (tier1 && Array.isArray(tier1.target_kind)) {
                const targets = tier1.target_kind.map((t: string) => t.toLowerCase());
                const normalizedType = targetType.toLowerCase();
                matchesTarget = targets.includes(normalizedType);
            } else {
                // Fallback
                const rTarget = (r as any).target || 'GLOBAL';
                if (rTarget === targetType || rTarget === 'GLOBAL') {
                    matchesTarget = true;
                }
            }

            // Classification
            const isRequired = uniqueWorldRulesetIds.includes(r.id);
            const isManual = manualKeys.includes(r.id);

            if (isRequired) {
                requiredRulesets.push(r);
            } else if (isManual) {
                manualRulesets.push(r);
            } else if (matchesTarget) {
                // Only available if it matches AND isn't already active
                availableOptionalRulesets.push(r);
            }
        }

        console.log('[SchemaEngine] Detected Required Rulesets:', requiredRulesets.map(r => r.id));

        console.log('[SchemaEngine] Required Set:', requiredRulesets.map(r => r.name || r.id));

        // C. Merge Logic (Order Matters)
        // 1. Start with World Base Schema
        // We use the base schema as the foundation.
        let schema: Record<string, any> = deepMerge({}, worldBaseSchema);

        const mergeRuleset = (ruleset: any) => {
            const contributions = getContributions(ruleset);
            const tier1 = contributions.tier1_entity;

            if (tier1) {
                // Strategy: Instead of putting it under a Ruleset Name key, we merge strictly into the structure.
                // IF the ruleset has form_hints, we might want to respect that structure.
                // The previous logic enforced `schema[categoryName] = ...` which isolated the ruleset.
                // The NEW logic should perform a deep merge of the entire contribution into the schema.
                // HOWEVER, to prevent collisions or to ensure grouping, we might want some namespacing ONLY if conflicts arise?
                // The User Request says: "Merge Logic: Ensure that when merging rulesets, we are Deep Merging state_contributions."
                // "If the World has form_hints and a Ruleset has form_hints, both must appear."

                // If we treat `schema` as the root of the "Contributions Union":
                schema = deepMerge(schema, contributions);

                // If we want to ensure visual separation, we rely on the `DynamicSchemaForm` to render sections based on `form_hints` keys.
                // If `form_hints` keys are generic (e.g. 'attributes'), they will merge.
                // If the user WANTS them to be separate (e.g. World Attributes vs Ruleset Attributes), 
                // the Ruleset Definition should probably use unique keys OR we assume merging is DESIRED (e.g. adding a new attribute to the "Attributes" list).

                // For now, true Deep Merge of the raw contributions is the standard "Engine" behavior.
            } else if (contributions && Object.keys(contributions).length > 0) {
                // Fallback: Merge whatever is there
                schema = deepMerge(schema, contributions);
            }
        };

        // Merge Required
        requiredRulesets.forEach(mergeRuleset);

        // Merge Manual
        manualRulesets.forEach(mergeRuleset);

        return { schema, availableOptionalRulesets };

    }, [world, allRulesets, targetType, manualKeys]);

    return {
        schema: mergedSchema,
        availableOptionalRulesets,
        isLoading: isWorldLoading || isLoadingRulesets,
        error: (worldError as Error) || (rulesetError as Error) || null,
    };
}
