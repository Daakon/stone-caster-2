import { Zap, BookOpen, Ghost, Building2, Landmark, Sword, Skull, Cpu, Radiation } from 'lucide-react';

export interface WorldPreset {
    id: string;
    label: string;
    description: string;
    icon: any; // Lucide icon component
    defaultRulesetKeys: string[];
    genre?: string; // For Settings mapped to Genres
}

export const GENRES: WorldPreset[] = [
    {
        id: 'fantasy',
        label: 'Fantasy',
        description: 'Magic, mythical creatures, and epic adventures in realms of wonder.',
        icon: Sword,
        defaultRulesetKeys: [],
    },
    {
        id: 'scifi',
        label: 'Sci-Fi',
        description: 'Futuristic technology, space exploration, and advanced civilizations.',
        icon: Cpu,
        defaultRulesetKeys: [],
    },
    {
        id: 'horror',
        label: 'Horror',
        description: 'Fear, suspense, and supernatural forces lurking in the shadows.',
        icon: Ghost,
        defaultRulesetKeys: [],
    },
    {
        id: 'modern',
        label: 'Modern',
        description: 'Contemporary settings reflecting the world as we know it today.',
        icon: Building2,
        defaultRulesetKeys: [],
    },
    {
        id: 'historical',
        label: 'Historical',
        description: 'Periods from the past, recreated with authenticity and detail.',
        icon: Landmark,
        defaultRulesetKeys: [],
    }
];

export const SETTINGS: WorldPreset[] = [
    // Fantasy Settings
    {
        id: 'high-fantasy',
        genre: 'fantasy',
        label: 'High Fantasy (Mystika)',
        description: 'A world of abundant magic, diverse races, and ancient prophecies.',
        icon: Zap,
        defaultRulesetKeys: ['d20-core-fantasy', 'magic-vancian', 'vitality-stamina-system'],
    },
    {
        id: 'low-magic',
        genre: 'fantasy',
        label: 'Low Magic',
        description: 'A gritty world where magic is rare, dangerous, or feared.',
        icon: BookOpen,
        defaultRulesetKeys: ['d100-5-pillars', 'gritty-realism-combat'],
    },
    {
        id: 'dark-fantasy',
        genre: 'fantasy',
        label: 'Dark Fantasy',
        description: 'A grim world where heroes are flawed and victory comes at a heavy cost.',
        icon: Skull,
        defaultRulesetKeys: ['d100-5-pillars', 'sanity-madness', 'corruption-mechanic'],
    },

    // Sci-Fi Settings
    {
        id: 'space-opera',
        genre: 'scifi',
        label: 'Space Opera',
        description: 'Interstellar empires, laser battles, and melodramatic adventures in space.',
        icon: Zap, // Reusing Zap for energy weapons vibe
        defaultRulesetKeys: ['d20-scifi-core', 'psionics-system', 'starship-combat'],
    },
    {
        id: 'cyberpunk',
        genre: 'scifi',
        label: 'Cyberpunk',
        description: 'High tech, low life in dystopian megacities ruled by corporations.',
        icon: Cpu,
        defaultRulesetKeys: ['d100-cyber-ops', 'cybernetics-augmentations', 'hacking-netrun'],
    },
    {
        id: 'post-apoc',
        genre: 'scifi',
        label: 'Post-Apocalyptic',
        description: 'Survival in the ruins of civilization after a global catastrophe.',
        icon: Radiation,
        defaultRulesetKeys: ['d20-survival-core', 'scavenging-crafting', 'mutation-system'],
    }
];
