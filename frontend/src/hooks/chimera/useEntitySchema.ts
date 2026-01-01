import { useMemo } from 'react';

// Re-export compatible interfaces to avoid breaking EntityAttributesForm
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

export interface StepField {
    key: string;
    label: string;
    control: string;
    ui_order?: number;
    default?: any;
    // Extra properties
    options?: string[];
    suggestions?: string[];
    min?: number;
    max?: number;
    description?: string;
    [key: string]: any;
}

/**
 * Aggregates and structures the schema for an entity.
 * NOW: Simply extracts the pre-compiled creation manifest from the story.
 */
export function useEntitySchema(story: any) {
    return useMemo(() => {
        // Fix: creation_manifest is a sibling of config_engine, not a child
        // Check both locations just in case, but prefer root
        const manifest = story?.creation_manifest || story?.config_engine?.creation_manifest;

        if (!manifest?.steps) {
            return [];
        }

        // Return the pre-compiled steps directly
        // The backend guarantees the structure matches StepDefinition[]
        return manifest.steps as StepDefinition[];
    }, [story]);
}
