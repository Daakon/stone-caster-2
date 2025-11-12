import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldValidationService } from './worldValidation.service.js';
import { ContentService } from './content.service.js';

vi.mock('./content.service.js', () => ({
  ContentService: {
    getWorlds: vi.fn(),
  },
}));

describe('Layer M1 - World Validation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WorldValidationService.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    WorldValidationService.clearCache();
  });

  describe('World Slug Validation', () => {
    it('should validate valid world slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' },
        { slug: 'voidreach', name: 'Voidreach' },
        { slug: 'whispercross', name: 'Whispercross Glade' },
        { slug: 'paragon-city', name: 'Paragon City' },
        { slug: 'veloria', name: 'Veloria - Court of Hearts' },
        { slug: 'noctis-veil', name: 'Noctis Veil' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.validateWorldSlug('mystika');
      expect(result.isValid).toBe(true);
      expect(result.world).toEqual({ slug: 'mystika', name: 'Mystika' });
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid world slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' },
        { slug: 'voidreach', name: 'Voidreach' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.validateWorldSlug('invalid-world');
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('Invalid world slug: invalid-world');
    });

    it('should reject empty world slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.validateWorldSlug('');
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('World slug is required');
    });

    it('should reject null world slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.validateWorldSlug(null as any);
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('World slug is required');
    });

    it('should reject undefined world slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.validateWorldSlug(undefined as any);
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('World slug is required');
    });

    it('should handle case sensitivity correctly', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      // Should reject uppercase
      const result1 = await WorldValidationService.validateWorldSlug('MYSTIKA');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toBe('Invalid world slug: MYSTIKA');

      // Should reject mixed case
      const result2 = await WorldValidationService.validateWorldSlug('Mystika');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toBe('Invalid world slug: Mystika');
    });

    it('should handle content service errors gracefully', async () => {
      vi.mocked(ContentService.getWorlds).mockRejectedValue(new Error('Failed to load worlds'));

      const result = await WorldValidationService.validateWorldSlug('mystika');
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('Failed to validate world slug: Failed to load worlds');
    });

    it('should handle empty worlds list', async () => {
      vi.mocked(ContentService.getWorlds).mockResolvedValue([]);

      const result = await WorldValidationService.validateWorldSlug('mystika');
      expect(result.isValid).toBe(false);
      expect(result.world).toBeUndefined();
      expect(result.error).toBe('Invalid world slug: mystika');
    });

    it('should validate all available world slugs', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' },
        { slug: 'voidreach', name: 'Voidreach' },
        { slug: 'whispercross', name: 'Whispercross Glade' },
        { slug: 'paragon-city', name: 'Paragon City' },
        { slug: 'veloria', name: 'Veloria - Court of Hearts' },
        { slug: 'noctis-veil', name: 'Noctis Veil' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      // Test all valid slugs
      for (const world of mockWorlds) {
        const result = await WorldValidationService.validateWorldSlug(world.slug);
        expect(result.isValid).toBe(true);
        expect(result.world).toEqual(world);
        expect(result.error).toBeUndefined();
      }
    });

    it('should cache world data for performance', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' },
        { slug: 'aetherium', name: 'Aetherium' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      // First call should fetch from content service
      const result1 = await WorldValidationService.validateWorldSlug('mystika');
      expect(result1.isValid).toBe(true);
      expect(ContentService.getWorlds).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await WorldValidationService.validateWorldSlug('aetherium');
      expect(result2.isValid).toBe(true);
      expect(ContentService.getWorlds).toHaveBeenCalledTimes(1); // cache hit
    });

    it('should handle special characters in world slugs', async () => {
      const mockWorlds = [
        { slug: 'paragon-city', name: 'Paragon City' },
        { slug: 'noctis-veil', name: 'Noctis Veil' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      // Should accept hyphens
      const result1 = await WorldValidationService.validateWorldSlug('paragon-city');
      expect(result1.isValid).toBe(true);
      expect(result1.world).toEqual({ slug: 'paragon-city', name: 'Paragon City' });

      // Should accept hyphens
      const result2 = await WorldValidationService.validateWorldSlug('noctis-veil');
      expect(result2.isValid).toBe(true);
      expect(result2.world).toEqual({ slug: 'noctis-veil', name: 'Noctis Veil' });
    });
  });

  describe('World Data Retrieval', () => {
    it('should return world data for valid slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika', description: 'A realm where the Veil between worlds has grown thin' },
        { slug: 'aetherium', name: 'Aetherium', description: 'In the sprawling neon-lit megacities of Aetherium' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.getWorldData('mystika');
      expect(result).toEqual({
        slug: 'mystika',
        name: 'Mystika',
        description: 'A realm where the Veil between worlds has grown thin'
      });
    });

    it('should return null for invalid slug', async () => {
      const mockWorlds = [
        { slug: 'mystika', name: 'Mystika' }
      ];

      vi.mocked(ContentService.getWorlds).mockResolvedValue(mockWorlds);

      const result = await WorldValidationService.getWorldData('invalid-world');
      expect(result).toBeNull();
    });

    it('should handle content service errors in getWorldData', async () => {
      vi.mocked(ContentService.getWorlds).mockRejectedValue(new Error('Failed to load worlds'));

      const result = await WorldValidationService.getWorldData('mystika');
      expect(result).toBeNull();
    });
  });
});
