/**
 * Tests for HTTP client with activeOnly=1 enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpGet, buildURL } from './http';

// Mock the api module
vi.mock('./api', () => ({
  apiGet: vi.fn(),
}));

// Mock the env module
vi.mock('./env', () => ({
  PUBLIC_API_MODE: true,
}));

describe('http client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildURL', () => {
    it('should add activeOnly=1 for catalog list endpoints in public mode', () => {
      const url = buildURL('/catalog/worlds', { q: 'test' });
      expect(url).toBe('/catalog/worlds?activeOnly=1&q=test');
    });

    it('should NOT add activeOnly=1 for catalog detail endpoints', () => {
      const url = buildURL('/catalog/stories/some-slug');
      expect(url).toBe('/catalog/stories/some-slug');
    });

    it('should NOT add activeOnly=1 for catalog detail endpoints with UUID', () => {
      const url = buildURL('/catalog/stories/123e4567-e89b-12d3-a456-426614174000');
      expect(url).toBe('/catalog/stories/123e4567-e89b-12d3-a456-426614174000');
    });

    it('should not add activeOnly=1 for non-catalog endpoints', () => {
      const url = buildURL('/api/games', { q: 'test' });
      expect(url).toBe('/api/games?q=test');
    });

    it('should handle array parameters correctly', () => {
      const url = buildURL('/catalog/stories', { tags: ['fantasy', 'adventure'] });
      expect(url).toBe('/catalog/stories?activeOnly=1&tags=fantasy&tags=adventure');
    });

    it('should filter out undefined and null values', () => {
      const url = buildURL('/catalog/worlds', { 
        q: 'test', 
        world: undefined, 
        kind: null,
        tags: []
      });
      expect(url).toBe('/catalog/worlds?activeOnly=1&q=test');
    });

    it('should handle empty parameters object', () => {
      const url = buildURL('/catalog/worlds');
      expect(url).toBe('/catalog/worlds?activeOnly=1');
    });
  });

  describe('httpGet', () => {
    it('should call apiGet with built URL', async () => {
      const mockApiGet = vi.mocked(await import('./api')).apiGet;
      mockApiGet.mockResolvedValue({ ok: true, data: [] });

      await httpGet('/catalog/worlds', { q: 'test' });

      expect(mockApiGet).toHaveBeenCalledWith('/catalog/worlds?activeOnly=1&q=test');
    });
  });
});
