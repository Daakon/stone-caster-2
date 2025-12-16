/**
 * Mock Worlds Data
 * Specific worlds that can be selected after choosing a genre
 */

export interface WorldDefinition {
    id: string;
    name: string;
    description_short: string;
    description_long: string;
    genre_key: string; // key to match with WorldPreset.id (or a new genre key)
    image_url?: string;
    tags: string[];
}

export const MOCK_WORLDS: WorldDefinition[] = [
    // High Fantasy Worlds
    {
        id: 'world-eldoria',
        name: 'Eldoria',
        description_short: 'A classic kingdom of knights and dragons.',
        description_long: 'Eldoria is a land of high adventure, where the Golden King rules from the Sun Spire. Ancient dragonflights nest in the jagged peaks to the north, while the elven forests of Myrist weave spells of protection around their borders.',
        genre_key: 'preset-high-fantasy',
        tags: ['classic', 'magic', 'dragons'],
    },
    {
        id: 'world-crystal-shards',
        name: 'The Crystal Shards',
        description_short: 'Floating islands amidst an etheric sea.',
        description_long: 'The world was shattered eons ago. Now, civilization clings to floating archipelagoes held aloft by giant mana crystals. Sky-ships sail the currents of the Ether, battling sky-pirates and storm elementals.',
        genre_key: 'preset-high-fantasy',
        tags: ['skyships', 'high-magic', 'exploration'],
    },

    // Grim Dark Worlds
    {
        id: 'world-iron-covenant',
        name: 'The Iron Covenant',
        description_short: 'A theorcratic empire ruled by steel and blood.',
        description_long: 'In the Iron Covenant, faith is mandatory and mercy is heresy. The Inquisitors roam the smog-choked streets, hunting for witches and mutants. Life is hard, brutal, and short.',
        genre_key: 'preset-grim-dark',
        tags: ['low-magic', 'brutal', 'theocracy'],
    },
    {
        id: 'world-shadow-fen',
        name: 'Shadow Fen',
        description_short: 'A cursed swamp where the sun never fully rises.',
        description_long: 'The Shadow Fen is a place of rot and decay. The few settlements are built on stilts above the black water, constantly besieged by the undead and twistlings that spawn from the bog.',
        genre_key: 'preset-grim-dark',
        tags: ['horror', 'survival', 'undead'],
    },

    // Cyber Sprawl Worlds
    {
        id: 'world-neo-babylon',
        name: 'Neo Babylon',
        description_short: 'The city that never sleeps, nor disconnects.',
        description_long: 'A sprawling mega-city covering the entire eastern seaboard. The corporations are the new gods, and data is the new currency. Samurai of the streets fight for scraps while the orbital elites look down from their space elevators.',
        genre_key: 'preset-cyber-sprawl',
        tags: ['cybernetics', 'corporations', 'hacking'],
    },
    {
        id: 'world-rust-belt',
        name: 'The Rust Belt',
        description_short: 'A post-industrial wasteland of scavengers.',
        description_long: 'Outside the domes, the air is toxic and the machines act on their own accord. Scavenger clans fight over ancient tech in the ruins of the old factories.',
        genre_key: 'preset-cyber-sprawl',
        tags: ['post-apoc', 'scavenging', 'robots'],
    },

    // Cosmic Horror Worlds
    {
        id: 'world-whisper-cross',
        name: 'Whisper Cross',
        description_short: 'A victorian city plagued by madness.',
        description_long: 'Gaslights flicker in the fog as unseen things chitter in the alleyways. The University holds secrets that should not be learned, and the stars are beginning to align in patterns that hurt the eyes.',
        genre_key: 'preset-cosmic-horror',
        tags: ['investigation', 'insanity', 'cults'],
    },
];
