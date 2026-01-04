
export const LEGACY_PREMADES = [
    {
        id: 'warrior',
        name: 'The Mercenary',
        tagline: 'A mostly honorable sword for hire',
        description: 'Hardened by years of border skirmishes, you rely on steel and grit.',
        portrait_key: 'warrior_portrait',
        base_traits: JSON.stringify({
            class: 'fighter',
            stats: { strength: 4, agility: 2, magic: 0 },
            essence: ['brave', 'pragmatic']
        })
    },
    {
        id: 'rogue',
        name: 'The Scoundrel',
        tagline: 'Quick with a knife, quicker with a lie',
        description: 'You survived the city slums by being smarter and faster than the rest.',
        portrait_key: 'rogue_portrait',
        base_traits: JSON.stringify({
            class: 'rogue',
            stats: { strength: 1, agility: 4, magic: 1 },
            essence: ['cunning', 'lucky']
        })
    },
    {
        id: 'mage',
        name: 'The Scholar',
        tagline: 'Seeker of forbidden arts',
        description: 'You have spent your life deciphering the old scrolls.',
        portrait_key: 'mage_portrait',
        base_traits: JSON.stringify({
            class: 'wizard',
            stats: { strength: 0, agility: 1, magic: 5 },
            essence: ['curious', 'obsessive']
        })
    }
];

export function mapPremadeToTemplate(premade: typeof LEGACY_PREMADES[0]) {
    let parsedTraits = {};
    try {
        parsedTraits = JSON.parse(premade.base_traits);
    } catch (e) {
        console.warn('Failed to parse premade traits', e);
    }

    const { class: classHandle, stats, essence, ...rest } = parsedTraits as any;

    return {
        name: premade.name,
        backstory: premade.description,
        // Map legacy "class" to "archetype_handle"
        archetype_handle: classHandle,
        // Map stats if schema supports it, for now just pass as overrides
        ...rest,
        // Flatten specific keys if known
        ...stats,
        core_values: essence
    };
}
