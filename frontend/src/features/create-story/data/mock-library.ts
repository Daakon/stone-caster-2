/**
 * Mock Library Data
 * Simulates the user's existing database of assets (worlds, entities, and contextual lore)
 * 
 * Architecture: Lore is contextual memory attached to Worlds, Entities, or Stories
 */

import type { EntityTemplate, WorldDefinition } from '@/types/chimera-domain';

/**
 * Mock User Worlds
 * Pre-existing worlds in the user's library
 */
export interface UserWorld extends WorldDefinition {
  world_id: string;
  created_at: string;
  updated_at: string;
  lore_count: number; // Number of lore fragments attached to this world
  // Note: Worlds use 'title' from WorldDefinition, not 'name'
}

export const MOCK_USER_WORLDS: UserWorld[] = [
  {
    world_id: 'world-aetheria-001',
    title: 'Aetheria',
    summary: 'A high-fantasy realm where magic flows through ley lines and ancient guilds control trade routes.',
    genre_tags: ['fantasy', 'magic', 'guilds'],
    safety_filters: ['pg13'],
    ruleset_keys: ['foundation-d100-5-pillars'],
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T14:15:00Z',
    lore_count: 12,
  },
  {
    world_id: 'world-voidreach-002',
    title: 'Voidreach',
    summary: 'A sci-fi setting where humanity explores the void between dimensions, encountering strange entities.',
    genre_tags: ['sci-fi', 'horror', 'exploration'],
    safety_filters: ['pg13'],
    ruleset_keys: ['foundation-d100-lite'],
    created_at: '2024-02-01T08:00:00Z',
    updated_at: '2024-02-10T16:45:00Z',
    lore_count: 8,
  },
  {
    world_id: 'world-mystika-003',
    title: 'Mystika',
    summary: 'A world where crystal magic and veil storms reshape reality, with three warring factions.',
    genre_tags: ['fantasy', 'crystals', 'factions'],
    safety_filters: ['pg'],
    ruleset_keys: ['foundation-d100-5-pillars'],
    created_at: '2024-01-10T12:00:00Z',
    updated_at: '2024-01-18T09:30:00Z',
    lore_count: 15,
  },
];

/**
 * Mock User Entities
 * Pre-existing entities in the user's library
 */
export interface UserEntity extends EntityTemplate {
  entity_id: string;
  created_at: string;
  updated_at: string;
  lore_count: number; // Number of lore fragments (memories/bio) attached to this entity
}

export const MOCK_USER_ENTITIES: UserEntity[] = [
  {
    entity_id: 'entity-kiera-001',
    name: 'Kiera',
    is_player: true,
    stats: {
      root_force: 40,
      root_finesse: 60,
      root_awareness: 55,
      root_insight: 45,
      root_influence: 50,
    },
    personality: {
      core_traits: ['Brave', 'Stoic', 'Resourceful'],
      core_values: ['Honor', 'Freedom'],
      quirks: ['Taps fingers when thinking', 'Always checks exits'],
    },
    created_at: '2024-01-16T10:30:00Z',
    updated_at: '2024-01-20T14:15:00Z',
    lore_count: 3,
  },
  {
    entity_id: 'entity-arven-002',
    name: 'Arven',
    is_player: false,
    stats: {
      root_force: 70,
      root_finesse: 45,
      root_awareness: 50,
      root_insight: 55,
      root_influence: 60,
    },
    personality: {
      core_traits: ['Noble', 'Protective', 'Loyal'],
      core_values: ['Duty', 'Justice'],
      quirks: ['Polishes armor when nervous', 'Speaks formally'],
    },
    created_at: '2024-01-17T11:00:00Z',
    updated_at: '2024-01-19T13:20:00Z',
    lore_count: 5,
  },
  {
    entity_id: 'entity-mara-003',
    name: 'Mara',
    is_player: false,
    stats: {
      root_force: 35,
      root_finesse: 50,
      root_awareness: 70,
      root_insight: 75,
      root_influence: 65,
    },
    personality: {
      core_traits: ['Wise', 'Curious', 'Mysterious'],
      core_values: ['Knowledge', 'Balance'],
      quirks: ['Mutters to herself', 'Collects strange objects'],
    },
    created_at: '2024-01-18T09:15:00Z',
    updated_at: '2024-01-21T10:00:00Z',
    lore_count: 7,
  },
];

/**
 * Mock User Lore
 * Contextual memory fragments attached to Worlds, Entities, or Stories
 * 
 * Architecture: Lore is NOT a standalone silo - it belongs to a parent
 */
export interface LoreFragment {
  id: string;
  title: string;
  content: string;
  parent_type: 'world' | 'entity' | 'story';
  parent_id: string;
  parent_name: string; // For display purposes
  created_at: string;
}

export const MOCK_USER_LORE: LoreFragment[] = [
  // World Lore (Aetheria)
  {
    id: 'lore-guild-wars-001',
    title: 'The Guild Wars',
    content: 'A century ago, the great merchant guilds clashed in a brutal conflict that reshaped the political landscape. The war ended with the signing of the Concord of Shadows, but tensions still simmer beneath the surface.',
    parent_type: 'world',
    parent_id: 'world-aetheria-001',
    parent_name: 'Aetheria',
    created_at: '2024-01-16T10:30:00Z',
  },
  {
    id: 'lore-ley-lines-002',
    title: 'Ley Line Networks',
    content: 'Magic flows through invisible ley lines that crisscross Aetheria. Guilds have built their strongholds at ley line intersections, giving them control over magical resources.',
    parent_type: 'world',
    parent_id: 'world-aetheria-001',
    parent_name: 'Aetheria',
    created_at: '2024-01-17T11:00:00Z',
  },
  // Entity Lore (Kiera)
  {
    id: 'lore-kiera-debt-003',
    title: 'Secret Debt',
    content: 'Kiera owes a significant debt to the Shadow Guild, a secret she keeps from her companions. The debt stems from a failed heist that went wrong years ago.',
    parent_type: 'entity',
    parent_id: 'entity-kiera-001',
    parent_name: 'Kiera',
    created_at: '2024-01-19T14:20:00Z',
  },
  {
    id: 'lore-kiera-mentor-004',
    title: 'The Old Mentor',
    content: 'Kiera was trained by an enigmatic figure known only as "The Raven", who disappeared mysteriously after teaching her the art of shadow-stepping.',
    parent_type: 'entity',
    parent_id: 'entity-kiera-001',
    parent_name: 'Kiera',
    created_at: '2024-01-20T09:15:00Z',
  },
  // World Lore (Voidreach)
  {
    id: 'lore-void-magic-005',
    title: 'Magic of the Void',
    content: 'Void magic is a forbidden art that draws power from the spaces between worlds. Practitioners risk their sanity and their souls, but the power they wield is unmatched.',
    parent_type: 'world',
    parent_id: 'world-voidreach-002',
    parent_name: 'Voidreach',
    created_at: '2024-02-02T08:30:00Z',
  },
  // Entity Lore (Arven)
  {
    id: 'lore-arven-knight-006',
    title: 'The Knight\'s Oath',
    content: 'Arven swore an oath to protect the innocent after witnessing the destruction of his village. This oath drives all his actions and decisions.',
    parent_type: 'entity',
    parent_id: 'entity-arven-002',
    parent_name: 'Arven',
    created_at: '2024-01-18T15:00:00Z',
  },
];

/**
 * Mock User Stories
 * Stories (drafts and published) for the dashboard
 */
export interface StoryItem {
  id: string;
  title: string;
  status: 'draft' | 'published';
  lastEdited?: string;
  publishedAt?: string;
  step?: number; // For drafts: current step (0-4)
  turnCount?: number; // For published: current turn count
  plays?: number; // For published: total plays
}

export const MOCK_USER_STORIES: StoryItem[] = [
  // Drafts
  {
    id: 'draft-iron-city-001',
    title: 'The Iron City',
    status: 'draft',
    lastEdited: new Date(Date.now() - 2 * 60000).toISOString(), // 2 minutes ago
    step: 2, // Step 3 of 5 (0-indexed)
  },
  {
    id: 'draft-voidreach-002',
    title: 'Voidreach Chronicles',
    status: 'draft',
    lastEdited: new Date(Date.now() - 60 * 60000).toISOString(), // 1 hour ago
    step: 1, // Step 2 of 5
  },
  {
    id: 'draft-mystika-003',
    title: 'Mystika Awakening',
    status: 'draft',
    lastEdited: new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString(), // 3 days ago
    step: 0, // Step 1 of 5
  },
  // Published
  {
    id: 'story-guild-wars-001',
    title: 'The Guild Wars',
    status: 'published',
    publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60000).toISOString(), // 2 weeks ago
    turnCount: 12,
    plays: 42,
  },
  {
    id: 'story-shadows-veil-002',
    title: 'Shadows of the Veil',
    status: 'published',
    publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60000).toISOString(), // 1 month ago
    turnCount: 8,
    plays: 128,
  },
];
