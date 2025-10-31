/**
 * Clean domain types for the new product model
 * No status fields - only active content is exposed publicly
 */

export type ID = string;

export interface World {
  id: ID;
  name: string;
  slug: string;
  description?: string;
  cover_url?: string;
  updated_at: string;
}

export interface NPC {
  id: ID;
  name: string;
  world_id: ID;
  short_desc?: string;
  portrait_url?: string;
  updated_at: string;
}

export interface Ruleset {
  id: ID;
  name: string;
  slug: string;
  description?: string;
}

export type StoryKind = 'scenario' | 'adventure';

export interface Story {
  id: ID;
  title: string;
  slug: string;
  world_id: ID;
  world_slug?: string;  // World slug for premade characters query
  kind: StoryKind;
  ruleset_ids: ID[];
  tags: string[];
  short_desc?: string;
  hero_url?: string;
  updated_at: string;
}

export interface StoryWithJoins extends Story {
  world?: Pick<World, 'id' | 'name' | 'slug'>;
  rulesets?: Ruleset[];
  featured_npcs?: Pick<NPC, 'id' | 'name' | 'portrait_url'>[];
}

export interface Character {
  id: ID;
  name: string;
  portrait_seed?: string;
  portrait_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: ID;
  story_id: ID;
  character_id: ID;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}
