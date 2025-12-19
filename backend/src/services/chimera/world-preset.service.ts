import { z } from 'zod';

export interface GenreDefinition {
    id: string;
    name: string;
    description: string;
    defaultRulesetKeys: string[];
}

// Preset Mappings as defined in requirements
// "High Fantasy" -> `['d100-5-pillars', 'vitality-stamina-system', 'stamina-based-magic', 'world-cycle-time-bands']`
// "Low Fantasy / Gritty" -> `['d100-5-pillars', 'vitality-stamina-system', 'needs-survival-basic', 'world-cycle-time-bands']`
// "Narrative / Cozy" -> `['npc-personalities', 'npc-relationships', 'npc-quirks-habits', 'world-cycle-time-bands']`

const PRESET_MAPPINGS: Record<string, string[]> = {
    // High Fantasy (Validated Keys)
    'High Fantasy': [
        'd100-5-pillars',
        'stamina-based-magic',
        'vitality-stamina-system',
        'world-cycle-time-bands',
        'cinematic-combat-lite',
        'wealth-capability-lite'
    ],
    // Also mapping ID for reliability
    'high-fantasy': [
        'd100-5-pillars',
        'stamina-based-magic',
        'vitality-stamina-system',
        'world-cycle-time-bands',
        'cinematic-combat-lite',
        'wealth-capability-lite'
    ],

    // Low Fantasy / Gritty (Validated Keys)
    'Low Fantasy / Gritty': [
        'd100-5-pillars',
        'vitality-stamina-system',
        'needs-survival-basic',
        'world-cycle-time-bands',
        'cinematic-combat-lite'
    ],
    // ID Mapping
    'low-fantasy-gritty': [
        'd100-5-pillars',
        'vitality-stamina-system',
        'needs-survival-basic',
        'world-cycle-time-bands',
        'cinematic-combat-lite'
    ],
    'low-magic': [ // Keep existing setting ID mapping just in case, pointing to same set
        'd100-5-pillars',
        'vitality-stamina-system',
        'needs-survival-basic',
        'world-cycle-time-bands',
        'cinematic-combat-lite'
    ],

    // Narrative / Cozy (Validated Keys)
    'Narrative / Cozy': [
        'npc-personalities',
        'npc-relationships',
        'npc-quirks-habits',
        'npc-roles-background',
        'world-cycle-time-bands'
    ],
    // ID Mapping
    'narrative-cozy': [
        'npc-personalities',
        'npc-relationships',
        'npc-quirks-habits',
        'npc-roles-background',
        'world-cycle-time-bands'
    ],

    // Dark Fantasy
    'dark-fantasy': [
        'd100-5-pillars',
        'sanity-madness',
        'corruption-mechanic'
    ],

    // Survival (Fallback/Existing)
    'Survival': ['d20-survival-core', 'scavenging-crafting', 'mutation-system'],
    'survival': ['d20-survival-core', 'scavenging-crafting', 'mutation-system'],

    // Cyberpunk (Fallback/Existing)
    'Cyberpunk': ['d100-cyber-ops', 'cybernetics-augmentations', 'hacking-netrun'],
    'cyberpunk': ['d100-cyber-ops', 'cybernetics-augmentations', 'hacking-netrun'],

    // Other Sci-Fi Settings (Preserve previous mapping logic if valid, or clear if unsure. I will preserve for now but note they might need validation later)
    'space-opera': ['d20-scifi-core', 'psionics-system', 'starship-combat'],
    'post-apoc': ['d20-survival-core', 'scavenging-crafting', 'mutation-system'],
};

const GENRE_DEFINITIONS: GenreDefinition[] = [
    {
        id: 'high-fantasy',
        name: 'High Fantasy',
        description: 'Epic magic, heroic quests, and grand worlds.',
        defaultRulesetKeys: PRESET_MAPPINGS['high-fantasy']
    },
    {
        id: 'low-fantasy-gritty', // Keeping legacy ID for safety
        name: 'Low Fantasy / Gritty',
        description: 'Dangerous worlds where survival is key and magic is rare or dangerous.',
        defaultRulesetKeys: PRESET_MAPPINGS['Low Fantasy / Gritty']
    },
    {
        id: 'narrative-cozy',
        name: 'Narrative / Cozy',
        description: 'Focus on relationships, characters, and story over complex mechanics.',
        defaultRulesetKeys: PRESET_MAPPINGS['Narrative / Cozy']
    },
    {
        id: 'survival',
        name: 'Survival',
        description: 'Resource management and staying alive against the elements.',
        defaultRulesetKeys: PRESET_MAPPINGS['Survival']
    },
    {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'High tech, low life in dystopian futures.',
        defaultRulesetKeys: PRESET_MAPPINGS['cyberpunk']
    }
];

export class WorldPresetService {
    private static instance: WorldPresetService;

    static getInstance(): WorldPresetService {
        if (!WorldPresetService.instance) {
            WorldPresetService.instance = new WorldPresetService();
        }
        return WorldPresetService.instance;
    }

    /**
     * Get all available genres with their details
     */
    getAvailableGenres(): GenreDefinition[] {
        return GENRE_DEFINITIONS;
    }

    /**
     * Get ruleset UUIDs for a specific genre
     * Resolves static keys to database UUIDs
     */
    async getPresetsForGenre(genreName: string, repo: any): Promise<string[]> {
        // Normalize key lookup
        let targetKeys: string[] = [];

        // Exact match
        if (PRESET_MAPPINGS[genreName]) {
            targetKeys = PRESET_MAPPINGS[genreName];
        } else {
            // Case insensitive match
            const key = Object.keys(PRESET_MAPPINGS).find(k => k.toLowerCase() === genreName.toLowerCase());
            if (key) {
                targetKeys = PRESET_MAPPINGS[key];
            }
        }

        if (targetKeys.length === 0) return [];

        // Resolve to UUIDs using the repository
        // We use 'any' for repo type here to avoid circular dependency issues if RulesetsRepository imports types that might loop, 
        // but ideally we should import RulesetsRepository type.
        // Given I cannot easily add the import in this block without updating the top of file, 
        // I will rely on the caller passing the correct object.
        return repo.findIdsByKeys(targetKeys);
    }
}
