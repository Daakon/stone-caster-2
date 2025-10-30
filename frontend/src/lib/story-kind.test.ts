/**
 * Tests for StoryKind utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  isValidStoryKind, 
  guardStoryKind, 
  getStoryKindLabel, 
  getStoryKindLabelPlural,
  VALID_STORY_KINDS,
  DEFAULT_STORY_KIND
} from './story-kind';

describe('story-kind utilities', () => {
  describe('isValidStoryKind', () => {
    it('should validate correct story kinds', () => {
      expect(isValidStoryKind('adventure')).toBe(true);
      expect(isValidStoryKind('scenario')).toBe(true);
    });

    it('should reject invalid story kinds', () => {
      expect(isValidStoryKind('story')).toBe(false);
      expect(isValidStoryKind('adventures')).toBe(false);
      expect(isValidStoryKind('')).toBe(false);
      expect(isValidStoryKind(null)).toBe(false);
      expect(isValidStoryKind(undefined)).toBe(false);
      expect(isValidStoryKind(123)).toBe(false);
    });
  });

  describe('guardStoryKind', () => {
    it('should return valid story kinds as-is', () => {
      expect(guardStoryKind('adventure')).toBe('adventure');
      expect(guardStoryKind('scenario')).toBe('scenario');
    });

    it('should fallback to default for invalid values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(guardStoryKind('invalid')).toBe(DEFAULT_STORY_KIND);
      expect(guardStoryKind('')).toBe(DEFAULT_STORY_KIND);
      expect(guardStoryKind(null)).toBe(DEFAULT_STORY_KIND);
      expect(guardStoryKind(undefined)).toBe(DEFAULT_STORY_KIND);
      
      expect(consoleSpy).toHaveBeenCalledTimes(4);
      consoleSpy.mockRestore();
    });
  });

  describe('getStoryKindLabel', () => {
    it('should return correct labels', () => {
      expect(getStoryKindLabel('adventure')).toBe('Adventure');
      expect(getStoryKindLabel('scenario')).toBe('Scenario');
    });
  });

  describe('getStoryKindLabelPlural', () => {
    it('should return correct plural labels', () => {
      expect(getStoryKindLabelPlural('adventure')).toBe('Adventures');
      expect(getStoryKindLabelPlural('scenario')).toBe('Scenarios');
    });
  });

  describe('constants', () => {
    it('should have correct valid story kinds', () => {
      expect(VALID_STORY_KINDS).toEqual(['adventure', 'scenario']);
    });

    it('should have correct default story kind', () => {
      expect(DEFAULT_STORY_KIND).toBe('adventure');
    });
  });
});
