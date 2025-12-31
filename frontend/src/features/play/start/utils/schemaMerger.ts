
import { merge } from 'lodash';

// Define minimal types needed if not available globally
// We expect compiledStory to conform to a structure but we'll be defensive
interface Tier1Schema {
    definitions: Record<string, any>;
    form_hints: Record<string, any>;
}

interface CompiledStory {
    snapshot_world?: {
        character_schema_contributions?: {
            tier1_entity?: Partial<Tier1Schema>;
        };
    };
    config_engine?: {
        schema?: {
            tier1_entity?: Tier1Schema;
        };
    };
}

/**
 * Merges character schema contributions from World and Engine.
 * World contributions take precedence over Engine defaults.
 */
export function mergeCharacterSchema(compiledStory: any): Tier1Schema {
    // Cast to internal interface for safety checks
    const story = compiledStory as CompiledStory;

    const engineSchema = story.config_engine?.schema?.tier1_entity || { definitions: {}, form_hints: {} };
    const worldSchema = story.snapshot_world?.character_schema_contributions?.tier1_entity || {};

    // Clone to avoid mutation artifacts
    const base = JSON.parse(JSON.stringify(engineSchema));
    const override = JSON.parse(JSON.stringify(worldSchema));

    // Deep merge using lodash (or manual if lodash not available, but 'merge' is standard)
    // If we don't have lodash, we can do a simple deep merge for these two specific keys.
    // Assuming lodash is likely available in a project of this size. 
    // If not, we will fallback to a simple implementation.

    // Check if we need to implement a simple merger to avoid dependencies if 'lodash' isn't installed?
    // The user didn't explicitly forbid dependencies but let's be safe and write a helper if simple.
    // Actually, deep merging schemas can be tricky. Let's try to assume lodash or write a recursive merge.

    // MERGE ENGINE CONFIG CREATION FIELDS
    // V3 Schema stores wizard fields in config_engine.creation.fields
    const engineCreationFields = story.config_engine?.creation?.fields;
    if (Array.isArray(engineCreationFields)) {
        engineCreationFields.forEach((field: any) => {
            const key = field.key;
            if (!key) return;

            // 1. Definition (Schema)
            if (!base.definitions[key] && !override.definitions[key]) {
                base.definitions[key] = {
                    type: field.control === 'slider' || field.min !== undefined ? 'number' : 'string',
                    label: field.label,
                    description: field.description,
                    default: field.min // Heuristic default
                };
            }

            // 2. Form Hint (UI)
            if (!base.form_hints[key] && !override.form_hints[key]) {
                base.form_hints[key] = {
                    ui_widget: field.control,
                    section: field.category?.toLowerCase() || 'general',
                    min: field.min,
                    max: field.max,
                    options: field.options,
                    order: 100 // Default order
                };
            }
        });
    }

    return deepMerge(base, override);
}

function deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return source;

    const output = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
    }

    return output;
}
