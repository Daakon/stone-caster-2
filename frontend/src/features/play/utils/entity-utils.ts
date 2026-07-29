export interface EntityDisplay {
    name: string;
    role: string;
    isUnknown: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveEntityDisplay(entity: any): EntityDisplay {
    if (!entity) {
        return { name: "Unknown Entity", role: "Unknown Role", isUnknown: true };
    }

    const props = entity.properties || {};
    const raw = entity.raw_data || {};
    const identity = raw.identity || {};
    const tiers = raw.tier1_entity || {};

    // 1. Name Resolution Priority
    let name = "Unknown Entity";
    if (entity.display_name) name = entity.display_name;
    else if (props.display_name) name = props.display_name;
    else if (props.name) name = props.name;
    else if (identity.name) name = identity.name;
    else if (entity.name) name = entity.name;

    // 2. Role/Archetype Resolution Priority
    let role = "Unknown Role";
    if (props.archetype) role = props.archetype;
    else if (props.occupation_tags?.length > 0) role = props.occupation_tags[0];
    else if (identity.species) role = identity.species;
    else if (props.race) role = props.race;
    else if (tiers.occupation_tags && tiers.occupation_tags.length > 0) role = tiers.occupation_tags[0];

    const isUnknown = name.toLowerCase().includes("unknown") || name.toLowerCase().includes("figure");

    return { name, role, isUnknown };
}

/** Resolve a human-readable description across the known entity shapes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveEntityDescription(entity: any): string | null {
    if (!entity) return null;
    const props = entity.properties || {};
    const raw = entity.raw_data || {};
    return props.description ||
        entity.description ||
        raw.identity?.description ||
        raw.tier1_entity?.description ||
        null;
}

export interface EntityVitals {
    hp: number | null;
    maxHp: number;
    stamina: number | null;
    combatCondition: string | null;
    physicalCondition: string | null;
}

/** Extract vitals + derived conditions; nulls mean "not tracked yet". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveEntityVitals(entity: any): EntityVitals {
    const props = entity?.properties || {};
    return {
        hp: typeof props.hp === 'number' ? props.hp : null,
        maxHp: typeof props.maxHp === 'number' ? props.maxHp
            : typeof props.max_hp === 'number' ? props.max_hp
                : 100,
        stamina: typeof props.current_stamina === 'number' ? props.current_stamina
            : typeof props.stamina === 'number' ? props.stamina
                : null,
        combatCondition: props.combat_condition || null,
        physicalCondition: props.physical_condition || null,
    };
}
