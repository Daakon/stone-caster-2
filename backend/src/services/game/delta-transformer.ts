/**
 * Delta Transformer
 * Converts nested delta structures into flat, frontend-expected format
 * 
 * Input (Bad - Deep Nesting):
 * {
 *   "mechanical": {
 *     "entities": {
 *       "playerId": {
 *         "properties": {
 *           "stamina": 75
 *         }
 *       }
 *     }
 *   },
 *   "tier1_world": {
 *     "narrative": {
 *       "atmosphere": "Tense"
 *     }
 *   }
 * }
 * 
 * OR dot-notation paths:
 * {
 *   "tier1_mechanical.entities.playerId.properties.stamina": -5,
 *   "tier1_world.narrative.atmosphere": "Tense"
 * }
 * 
 * Output (Required - Flat with entities and world):
 * {
 *   "entities": {
 *     "playerId": { "satiety": 81, "current_stamina": 75 }, // Properties merged directly
 *     "GUARD_ID": { "combat_condition": "Minor Injury" }      // Target updates here
 *   },
 *   "world": { "narrative": { "atmosphere": "Tense" } }
 * }
 */

/**
 * Transform nested delta into flat structure with entities and world keys
 */
export function transformDeltaToEntityKeyed(delta: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {
        entities: {},
        world: {}
    };

    // Helper to merge properties directly into entity object (unwrap properties)
    const mergeEntityChanges = (entityId: string, changes: any): void => {
        if (!result.entities[entityId]) {
            result.entities[entityId] = {};
        }

        // If changes has a "properties" key, unwrap it and merge directly
        if (changes.properties && typeof changes.properties === 'object') {
            Object.assign(result.entities[entityId], changes.properties);
            // Also merge any other keys (like combat_condition) that aren't in properties
            for (const [key, value] of Object.entries(changes)) {
                if (key !== 'properties') {
                    result.entities[entityId][key] = value;
                }
            }
        } else {
            // No properties wrapper, merge directly
            Object.assign(result.entities[entityId], changes);
        }
    };

    // Case 1: Nested structure with mechanical.entities or tier1_mechanical.entities
    const entitiesPath = delta.mechanical?.entities || 
                        delta.tier1_mechanical?.entities ||
                        delta.mechanical_state?.entities;
    
    if (entitiesPath) {
        for (const [entityId, entityChanges] of Object.entries(entitiesPath)) {
            if (entityId && entityChanges && typeof entityChanges === 'object') {
                mergeEntityChanges(entityId, entityChanges);
            }
        }
    }

    // Case 2: Direct entities structure
    if (delta.entities && typeof delta.entities === 'object') {
        for (const [entityId, entityChanges] of Object.entries(delta.entities)) {
            if (entityId && entityChanges && typeof entityChanges === 'object') {
                mergeEntityChanges(entityId, entityChanges);
            }
        }
    }

    // Case 3: Dot-notation paths for entities
    for (const [path, value] of Object.entries(delta)) {
        // Handle entity paths: "entities.playerId.properties.stamina" or "tier1_mechanical.entities.playerId.properties.stamina"
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            let entityId: string | null = null;
            let propPath: string | null = null;

            // Pattern 1: "entities.playerId.properties.stamina"
            if (path.startsWith('entities.')) {
                const pathParts = path.split('.');
                if (pathParts.length >= 3) {
                    entityId = pathParts[1];
                    propPath = pathParts.slice(2).join('.');
                }
            }
            // Pattern 2: "tier1_mechanical.entities.playerId.properties.stamina" or "mechanical.entities.playerId.properties.stamina"
            else if (path.includes('.entities.')) {
                const pathParts = path.split('.');
                const entitiesIndex = pathParts.indexOf('entities');
                if (entitiesIndex >= 0 && entitiesIndex < pathParts.length - 1) {
                    entityId = pathParts[entitiesIndex + 1];
                    propPath = pathParts.slice(entitiesIndex + 2).join('.');
                }
            }

            if (entityId && propPath) {
                // Initialize entity if not present
                if (!result.entities[entityId]) {
                    result.entities[entityId] = {};
                }

                // If path contains "properties.", unwrap it
                if (propPath.startsWith('properties.')) {
                    const actualProp = propPath.replace(/^properties\./, '');
                    result.entities[entityId][actualProp] = value;
                } else {
                    // Set nested property value (for non-properties paths like combat_condition)
                    setNestedProperty(result.entities[entityId], propPath, value);
                }
            }
        }
    }

    // Case 4: Extract world/global changes (tier1_world, world, narrative, etc.)
    const worldPaths = [
        delta.tier1_world,
        delta.world,
        delta.narrative,
        delta.tier0_narrative
    ].filter(Boolean);

    for (const worldData of worldPaths) {
        if (typeof worldData === 'object') {
            Object.assign(result.world, worldData);
        }
    }

    // Case 5: Dot-notation paths for world
    for (const [path, value] of Object.entries(delta)) {
        if (path.startsWith('tier1_world.') || path.startsWith('world.') || path.startsWith('narrative.')) {
            const worldPath = path.replace(/^(tier1_world|world|narrative)\./, '');
            setNestedProperty(result.world, worldPath, value);
        }
    }

    // Clean up empty objects
    if (Object.keys(result.entities).length === 0) {
        delete result.entities;
    }
    if (Object.keys(result.world).length === 0) {
        delete result.world;
    }

    return result;
}

/**
 * Set a nested property value using dot-notation path
 * Creates intermediate objects as needed
 */
function setNestedProperty(obj: Record<string, any>, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    // Navigate/create path except for the last part
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }

    // Set the final value
    const finalKey = parts[parts.length - 1];
    current[finalKey] = value;
}
