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

    // 2. Role/Archetype Resolution Priority
    let role = "Unknown Role";
    if (props.archetype) role = props.archetype;
    else if (identity.species) role = identity.species;
    else if (tiers.occupation_tags && tiers.occupation_tags.length > 0) role = tiers.occupation_tags[0];

    const isUnknown = name.toLowerCase().includes("unknown") || name.toLowerCase().includes("figure");

    return { name, role, isUnknown };
}
