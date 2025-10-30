/**
 * Tests for ID utilities
 */

import { describe, it, expect } from 'vitest';
import { isUUID, isSlug, getIdType, normalizeIdForDisplay } from './id';

describe('id utilities', () => {
  describe('isUUID', () => {
    it('should identify valid UUIDs', () => {
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
      expect(isUUID('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('123e4567-e89b-12d3-a456')).toBe(false);
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false);
      expect(isUUID('')).toBe(false);
    });
  });

  describe('isSlug', () => {
    it('should identify valid slugs', () => {
      expect(isSlug('hello-world')).toBe(true);
      expect(isSlug('test123')).toBe(true);
      expect(isSlug('a-b-c-1-2-3')).toBe(true);
      expect(isSlug('single')).toBe(true);
    });

    it('should reject invalid slugs', () => {
      expect(isSlug('Hello World')).toBe(false);
      expect(isSlug('hello_world')).toBe(false);
      expect(isSlug('hello.world')).toBe(false);
      expect(isSlug('hello world')).toBe(false);
      expect(isSlug('')).toBe(false);
    });
  });

  describe('getIdType', () => {
    it('should identify UUIDs', () => {
      expect(getIdType('123e4567-e89b-12d3-a456-426614174000')).toBe('uuid');
    });

    it('should identify slugs', () => {
      expect(getIdType('hello-world')).toBe('slug');
    });

    it('should identify unknown types', () => {
      expect(getIdType('Hello World')).toBe('unknown');
      expect(getIdType('hello_world')).toBe('unknown');
      expect(getIdType('')).toBe('unknown');
    });
  });

  describe('normalizeIdForDisplay', () => {
    it('should truncate UUIDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(normalizeIdForDisplay(uuid)).toBe('123e4567...');
      expect(normalizeIdForDisplay(uuid, 4)).toBe('123e...');
    });

    it('should keep slugs as-is', () => {
      expect(normalizeIdForDisplay('hello-world')).toBe('hello-world');
      expect(normalizeIdForDisplay('test123')).toBe('test123');
    });
  });
});
