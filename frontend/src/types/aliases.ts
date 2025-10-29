/**
 * Temporary compatibility aliases for Phase 0 migration
 * These will be removed in Phase 2 when all references are updated
 */

// Re-export domain types for backward compatibility
export type { World, NPC, Ruleset, Story, StoryKind, StoryWithJoins, ID } from './domain';

// TEMP compatibility aliases - remove in Phase 2
export type EntryKind = 'scenario' | 'adventure';

/**
 * @deprecated Use Story instead. This alias will be removed in Phase 2.
 */
export type Entry = import('./domain').Story;

/**
 * @deprecated Use StoryKind instead. This alias will be removed in Phase 2.
 */
export type EntryType = import('./domain').StoryKind;
