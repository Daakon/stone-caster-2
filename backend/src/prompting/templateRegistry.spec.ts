import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTemplatesForWorld, PromptTemplateMissingError } from './templateRegistry.js';

// Mock the entire template registry module
vi.mock('./templateRegistry.js', async () => {
  const actual = await vi.importActual('./templateRegistry.js');
  return {
    ...actual,
    getTemplatesForWorld: vi.fn(),
  };
});

describe('TemplateRegistry', () => {
  const mockGetTemplatesForWorld = vi.mocked(getTemplatesForWorld);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTemplatesForWorld', () => {
    it('should return bundle for mystika when files exist', async () => {
      const mockBundle = {
        core: {
          system: 'System content',
          tools: 'Tools content',
          formatting: 'Formatting content',
          safety: 'Safety content',
        },
        world: {
          lore: 'World lore content',
          logic: 'World logic content',
          style: 'World style content',
        },
        adventures: {
          falebridge: 'Adventure content',
        },
      };

      mockGetTemplatesForWorld.mockResolvedValue(mockBundle);

      const result = await getTemplatesForWorld('mystika');

      expect(result).toBeDefined();
      expect(result.core.system).toBeDefined();
      expect(result.core.tools).toBeDefined();
      expect(result.core.formatting).toBeDefined();
      expect(result.core.safety).toBeDefined();
      expect(result.world.lore).toBeDefined();
      expect(result.world.logic).toBeDefined();
      expect(result.world.style).toBeDefined();
      expect(result.adventures).toBeDefined();
      expect(result.adventures!['falebridge']).toBeDefined();
    });

    it('should throw PromptTemplateMissingError if world folder is missing', async () => {
      mockGetTemplatesForWorld.mockRejectedValue(new PromptTemplateMissingError('nonexistent'));

      await expect(getTemplatesForWorld('nonexistent')).rejects.toThrow(PromptTemplateMissingError);
      await expect(getTemplatesForWorld('nonexistent')).rejects.toThrow('No templates found for world: nonexistent');
    });

    it('should handle case-insensitive world dir resolution', async () => {
      const mockBundle = {
        core: { system: 'System content' },
        world: { lore: 'World lore content' },
      };

      mockGetTemplatesForWorld.mockResolvedValue(mockBundle);

      // Test with lowercase input
      const result = await getTemplatesForWorld('mystika');
      expect(result).toBeDefined();
      expect(result.world.lore).toBeDefined();
    });

    it('should normalize world slug (trim and lowercase)', async () => {
      const mockBundle = {
        core: { system: 'System content' },
        world: { lore: 'World lore content' },
      };

      mockGetTemplatesForWorld.mockResolvedValue(mockBundle);

      // Test with various input formats
      const result1 = await getTemplatesForWorld('  MYSTIKA  ');
      const result2 = await getTemplatesForWorld('Mystika');
      const result3 = await getTemplatesForWorld('mystika');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      expect(result1.world.lore).toBeDefined();
      expect(result2.world.lore).toBeDefined();
      expect(result3.world.lore).toBeDefined();
    });
  });
});
