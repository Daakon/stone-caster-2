/**
 * Tests for AWF Bundle i18n Compaction
 * Ensures locale overlays are applied in world/adventure compaction
 */

import { describe, it, expect } from 'vitest';
import { compactWorld, compactAdventure } from '../src/assemblers/world-adv-compact.js';

describe('AWF i18n Compaction', () => {
  describe('compactWorld', () => {
    it('should apply locale overlay for world name when locale is provided', () => {
      const worldDoc = {
        id: 'test-world',
        name: 'Test World',
        i18n: {
          'es-ES': {
            name: 'Mundo de Prueba',
          },
        },
      };

      const compacted = compactWorld(worldDoc, 'es-ES');
      expect(compacted.name).toBe('Mundo de Prueba');
    });

    it('should fallback to source name when locale overlay is absent', () => {
      const worldDoc = {
        id: 'test-world',
        name: 'Test World',
        i18n: {
          'fr-FR': {
            name: 'Monde de Test',
          },
        },
      };

      const compacted = compactWorld(worldDoc, 'es-ES');
      expect(compacted.name).toBe('Test World');
    });

    it('should use source name when locale is not provided', () => {
      const worldDoc = {
        id: 'test-world',
        name: 'Test World',
      };

      const compacted = compactWorld(worldDoc);
      expect(compacted.name).toBe('Test World');
    });
  });

  describe('compactAdventure', () => {
    it('should apply locale overlay for adventure name and synopsis', () => {
      const adventureDoc = {
        id: 'test-adventure',
        name: 'Test Adventure',
        synopsis: 'A test adventure',
        i18n: {
          'es-ES': {
            name: 'Aventura de Prueba',
            synopsis: 'Una aventura de prueba',
          },
        },
      };

      const compacted = compactAdventure(adventureDoc, 'es-ES');
      expect(compacted.name).toBe('Aventura de Prueba');
      expect(compacted.synopsis).toBe('Una aventura de prueba');
    });

    it('should fallback to source text when locale overlay is partial', () => {
      const adventureDoc = {
        id: 'test-adventure',
        name: 'Test Adventure',
        synopsis: 'A test adventure',
        i18n: {
          'es-ES': {
            name: 'Aventura de Prueba',
            // synopsis missing
          },
        },
      };

      const compacted = compactAdventure(adventureDoc, 'es-ES');
      expect(compacted.name).toBe('Aventura de Prueba');
      expect(compacted.synopsis).toBe('A test adventure');
    });

    it('should use source text when locale is not provided', () => {
      const adventureDoc = {
        id: 'test-adventure',
        name: 'Test Adventure',
        synopsis: 'A test adventure',
      };

      const compacted = compactAdventure(adventureDoc);
      expect(compacted.name).toBe('Test Adventure');
      expect(compacted.synopsis).toBe('A test adventure');
    });

    it('should preserve token targets even when locale is applied', () => {
      const adventureDoc = {
        id: 'test-adventure',
        name: 'Test Adventure',
        synopsis: 'A'.repeat(300), // Long synopsis
        i18n: {
          'es-ES': {
            name: 'Aventura',
            synopsis: 'Una'.repeat(150), // Long localized synopsis
          },
        },
      };

      const compacted = compactAdventure(adventureDoc, 'es-ES');
      // Synopsis should be truncated to 280 chars regardless of locale
      expect(compacted.synopsis.length).toBeLessThanOrEqual(280);
      expect(compacted.name).toBe('Aventura');
    });
  });
});

