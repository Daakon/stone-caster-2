/**
 * StoryKind utilities and guards
 */

import type { StoryKind } from '@/types/domain';

/**
 * Valid story kinds
 */
export const VALID_STORY_KINDS: StoryKind[] = ['adventure', 'scenario'];

/**
 * Default story kind fallback
 */
export const DEFAULT_STORY_KIND: StoryKind = 'adventure';

/**
 * Check if a value is a valid StoryKind
 */
export const isValidStoryKind = (value: any): value is StoryKind => {
  return typeof value === 'string' && VALID_STORY_KINDS.includes(value as StoryKind);
};

/**
 * Guard function that ensures a StoryKind is valid, falling back to default
 * This prevents UI crashes from unexpected values
 */
export const guardStoryKind = (value: any): StoryKind => {
  if (isValidStoryKind(value)) {
    return value;
  }
  return DEFAULT_STORY_KIND;
};

/**
 * Get display label for a StoryKind
 */
export const getStoryKindLabel = (kind: StoryKind): string => {
  switch (kind) {
    case 'adventure':
      return 'Adventure';
    case 'scenario':
      return 'Scenario';
    default:
      return 'Story';
  }
};

/**
 * Get plural display label for a StoryKind
 */
export const getStoryKindLabelPlural = (kind: StoryKind): string => {
  switch (kind) {
    case 'adventure':
      return 'Adventures';
    case 'scenario':
      return 'Scenarios';
    default:
      return 'Stories';
  }
};
