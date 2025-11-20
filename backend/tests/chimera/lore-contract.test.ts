/**
 * Tests for Chimera Lore Entry Data Contract
 * Phase 1: Pure RAG Lore System - Data Foundation
 * 
 * This test serves as a compile-time check to ensure our Types and our mental model
 * of the DB schema are aligned.
 */

import { describe, it, expect } from 'vitest';
import type { ChimeraLoreEntry } from '../../../shared/src/types/chimera-lore';
import { isChimeraLoreEntry } from '../../../shared/src/types/chimera-lore';

describe('ChimeraLoreEntry Data Contract', () => {
  describe('Valid Lore Entry', () => {
    it('should match the ChimeraLoreEntry interface', () => {
      // Create a valid mock lore entry that matches the DB schema
      const mockLoreEntry: ChimeraLoreEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'The Ancient Prophecy',
        entry_text: 'Long ago, the ancient seers foretold of a chosen one who would unite the fractured realms. The prophecy speaks of three sacred artifacts that must be gathered before the final confrontation.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      // TypeScript compile-time check: this should compile without errors
      expect(mockLoreEntry).toBeDefined();
      expect(mockLoreEntry.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockLoreEntry.story_id).toBe('chimera_story_1234567890_abc123');
      expect(mockLoreEntry.display_name).toBe('The Ancient Prophecy');
      expect(mockLoreEntry.entry_text).toBeTruthy();
      expect(mockLoreEntry.entry_text.length).toBeGreaterThan(0);
    });

    it('should pass the type guard validation', () => {
      const validEntry: ChimeraLoreEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(validEntry)).toBe(true);
    });
  });

  describe('Required Fields Validation', () => {
    it('should reject object missing id field', () => {
      const invalidEntry = {
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object missing story_id field', () => {
      const invalidEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object missing display_name field', () => {
      const invalidEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object missing entry_text field', () => {
      const invalidEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object missing created_at field', () => {
      const invalidEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object missing updated_at field', () => {
      const invalidEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject object with wrong field types', () => {
      const invalidEntry = {
        id: 123, // Should be string
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(isChimeraLoreEntry(invalidEntry)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(isChimeraLoreEntry(null)).toBe(false);
      expect(isChimeraLoreEntry(undefined)).toBe(false);
    });

    it('should reject non-object types', () => {
      expect(isChimeraLoreEntry('string')).toBe(false);
      expect(isChimeraLoreEntry(123)).toBe(false);
      expect(isChimeraLoreEntry([])).toBe(false);
    });
  });

  describe('Field Type Validation', () => {
    it('should ensure all string fields are strings', () => {
      const validEntry: ChimeraLoreEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        story_id: 'chimera_story_1234567890_abc123',
        display_name: 'Test Lore Entry',
        entry_text: 'This is the entry text content.',
        created_at: '2025-11-15T15:30:00.000Z',
        updated_at: '2025-11-15T15:30:00.000Z'
      };

      expect(typeof validEntry.id).toBe('string');
      expect(typeof validEntry.story_id).toBe('string');
      expect(typeof validEntry.display_name).toBe('string');
      expect(typeof validEntry.entry_text).toBe('string');
      expect(typeof validEntry.created_at).toBe('string');
      expect(typeof validEntry.updated_at).toBe('string');
    });
  });
});

