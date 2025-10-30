/**
 * Tests for API client story functions and parameter serialization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listStories, listWorlds, listNPCs, listRulesets, getStory } from './api';

// Mock the http module
vi.mock('./http', () => ({
  httpGet: vi.fn(),
}));

describe('API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listStories', () => {
    it('should call httpGet with correct parameters', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: [] });

      await listStories({ 
        q: 'fantasy', 
        world: 'world-123', 
        kind: 'adventure',
        ruleset: 'ruleset-456',
        tags: ['fantasy', 'adventure']
      });

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/stories', {
        q: 'fantasy',
        world: 'world-123',
        kind: 'adventure',
        ruleset: 'ruleset-456',
        tags: ['fantasy', 'adventure']
      });
    });

    it('should handle empty parameters', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: [] });

      await listStories();

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/stories', undefined);
    });
  });

  describe('listWorlds', () => {
    it('should call httpGet with correct parameters', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: [] });

      await listWorlds({ q: 'mystika' });

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/worlds', { q: 'mystika' });
    });
  });

  describe('listNPCs', () => {
    it('should call httpGet with correct parameters', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: [] });

      await listNPCs({ q: 'wizard', world: 'world-123' });

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/npcs', { 
        q: 'wizard', 
        world: 'world-123' 
      });
    });
  });

  describe('listRulesets', () => {
    it('should call httpGet with correct parameters', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: [] });

      await listRulesets({ q: 'dnd' });

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/rulesets', { q: 'dnd' });
    });
  });

  describe('getStory', () => {
    it('should call httpGet with story ID', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: {} });

      await getStory('story-123');

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/stories/story-123');
    });

    it('should call httpGet with story slug', async () => {
      const mockHttpGet = vi.mocked(await import('./http')).httpGet;
      mockHttpGet.mockResolvedValue({ ok: true, data: {} });

      await getStory('mystika-tutorial');

      expect(mockHttpGet).toHaveBeenCalledWith('/api/catalog/stories/mystika-tutorial');
    });
  });
});
