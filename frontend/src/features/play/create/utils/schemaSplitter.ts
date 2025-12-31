


// Define types broadly to accommodate the schema structure
interface SchemaField {
    type?: string;
    label?: string;
    format?: string;
    description?: string;
    ui_category?: string;
    enum?: string[];
    default?: any;
    minimum?: number;
    maximum?: number;
    [key: string]: any;
}

interface Tier1Schema {
    definitions: Record<string, SchemaField>;
    form_hints?: Record<string, {
        ui_widget?: string;
        order?: number;
        hidden?: boolean;
        section?: string;
    }>;
}

export interface SplittedSchema {
    identity: {
        specialFields: Record<string, SchemaField>; // race_handle, archetype_handle
        otherFields: Record<string, SchemaField>;
    };
    capabilities: Record<string, SchemaField>;
    personality: Record<string, SchemaField>;
}

// Keys that are hardcoded/handled explicitly in Step 1
const UNIVERSAL_IDENTITY_KEYS = new Set([
    'name', 'moniker', 'pronouns', 'gender', 'appearance', 'portrait', 'backstory', 'history'
]);

// Keys that trigger "Special" UI in Step 1 (Selection Cards)
const SPECIAL_IDENTITY_KEYS = new Set(['race_handle', 'species', 'archetype_handle', 'class', 'role', 'spirit_animal_handle']);

// Heuristics for placing fields into steps
const CAPABILITY_KEYWORDS = [
    'stat', 'skill', 'resource', 'power', 'spell', 'force', 'finesse', 'resilience', 'logic', 'will',
    'strength', 'agility', 'stamina', 'intellect', 'charisma', 'spirit', 'dexterity', 'constitution', 'wisdom'
];

const PERSONALITY_KEYWORDS = [
    'essence', 'alignment', 'trait', 'value', 'goal', 'fear', 'phobia', 'quirk', 'drive', 'flaw'
];

export function splitSchema(schema: Tier1Schema | null): SplittedSchema {
    const output: SplittedSchema = {
        identity: { specialFields: {}, otherFields: {} },
        capabilities: {},
        personality: {}
    };

    if (!schema || !schema.definitions) return output;

    Object.entries(schema.definitions).forEach(([key, paramDef]) => {
        const def = paramDef as SchemaField;
        const hint = schema.form_hints?.[key];

        // Merge definition and hint for downstream consumption
        const mergedDef = { ...def, ...hint };

        // 1. Skip if hidden or private
        if (hint?.hidden) return;

        // 2. Identify Special Identity Fields
        if (SPECIAL_IDENTITY_KEYS.has(key)) {
            output.identity.specialFields[key] = mergedDef;
            return;
        }

        // 3. Skip Universal Identity Fields (they are hardcoded in UI, but we don't need them in the dynamic split unless they have custom constraints?)
        // The prompt says "Hardcode the following fields...". If the schema defines constraints for "name" (e.g. max length), we might want to know.
        // But typically the UI hardcodes the input. Let's ignore them in the dynamic sections to avoid duplication.
        if (UNIVERSAL_IDENTITY_KEYS.has(key)) return;

        // 4. Categorize by UI Hint (Explicit overrides)
        if (hint?.section === 'capabilities' || hint?.section === 'stats') {
            output.capabilities[key] = mergedDef;
            return;
        }
        if (hint?.section === 'personality' || hint?.section === 'soul') {
            output.personality[key] = mergedDef;
            return;
        }

        // 5. Categorize by Key Heuristics
        const lowerKey = key.toLowerCase();
        if (CAPABILITY_KEYWORDS.some(k => lowerKey.includes(k))) {
            output.capabilities[key] = mergedDef;
            return;
        }
        if (PERSONALITY_KEYWORDS.some(k => lowerKey.includes(k))) {
            output.personality[key] = mergedDef;
            return;
        }

        // 6. Fallback (Default to Personality if narrative, Capabilities if numeric? Or just dump in Personality?)
        // Let's look at type.
        if (def.type === 'number' || def.type === 'integer') {
            output.capabilities[key] = mergedDef;
        } else {
            // Strings/Arrays often map better to traits/biography stuff
            output.personality[key] = mergedDef;
        }
    });

    return output;
}
