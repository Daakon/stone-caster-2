/**
 * Unit tests for AWF Admin Service
 * Phase 2: Admin UI - Service layer testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { awfAdminService } from '../awfAdminService';

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { access_token: 'mock-token', user: { id: 'mock-user' } } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { role: 'prompt_admin' },
            error: null
          }))
        }))
      }))
    }))
  }
}));

describe('AWF Admin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Contracts', () => {
    it('should fetch core contracts', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            id: 'core.contract.v4',
            version: 'v4',
            doc: { contract: 'test' },
            hash: 'abc123',
            active: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.getCoreContracts();
      expect(result).toEqual(mockResponse);
    });

    it('should create core contract', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: 'core.contract.v4',
          version: 'v4',
          doc: { contract: 'test' },
          hash: 'abc123',
          active: true
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.createCoreContract({
        id: 'core.contract.v4',
        version: 'v4',
        doc: { contract: 'test' },
        active: true
      });

      expect(result).toEqual(mockResponse);
    });

    it('should activate core contract', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: 'core.contract.v4',
          version: 'v4',
          active: true
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.activateCoreContract('core.contract.v4', 'v4');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Worlds', () => {
    it('should fetch worlds', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            id: 'world.mystika',
            version: 'v1',
            doc: { name: 'Mystika' },
            hash: 'abc123',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.getWorlds();
      expect(result).toEqual(mockResponse);
    });

    it('should create world', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: 'world.mystika',
          version: 'v1',
          doc: { name: 'Mystika' },
          hash: 'abc123'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.createWorld({
        id: 'world.mystika',
        version: 'v1',
        doc: { name: 'Mystika' }
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Adventures', () => {
    it('should fetch adventures', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            id: 'adv.whispercross',
            world_ref: 'world.mystika',
            version: 'v1',
            doc: { name: 'Whispercross' },
            hash: 'abc123',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.getStories();
      expect(result).toEqual(mockResponse);
    });

    it('should create adventure', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: 'adv.whispercross',
          world_ref: 'world.mystika',
          version: 'v1',
          doc: { name: 'Whispercross' },
          hash: 'abc123'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.createAdventure({
        id: 'adv.whispercross',
        world_ref: 'world.mystika',
        version: 'v1',
        doc: { name: 'Whispercross' }
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Adventure Starts', () => {
    it('should fetch adventure starts', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            adventure_ref: 'adv.whispercross',
            doc: { start: { scene: 'intro' } },
            use_once: true,
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.getAdventureStarts();
      expect(result).toEqual(mockResponse);
    });

    it('should create adventure start', async () => {
      const mockResponse = {
        ok: true,
        data: {
          adventure_ref: 'adv.whispercross',
          doc: { start: { scene: 'intro' } },
          use_once: true
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await awfAdminService.createAdventureStart({
        adventure_ref: 'adv.whispercross',
        doc: { start: { scene: 'intro' } },
        use_once: true
      });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Utility Methods', () => {
    it('should format JSON for display', () => {
      const obj = { test: 'value' };
      const result = awfAdminService.formatJsonForDisplay(obj);
      expect(result).toBe('{\n  "test": "value"\n}');
    });

    it('should parse JSON from storage', () => {
      const jsonString = '{"test": "value"}';
      const result = awfAdminService.parseJsonFromStorage(jsonString);
      expect(result).toEqual({ test: 'value' });
    });

    it('should handle invalid JSON parsing', () => {
      const invalidJson = 'invalid json';
      const result = awfAdminService.parseJsonFromStorage(invalidJson);
      expect(result).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: 'Validation failed' })
      });

      await expect(awfAdminService.getCoreContracts()).rejects.toThrow('Validation failed');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(awfAdminService.getCoreContracts()).rejects.toThrow('Network error');
    });
  });
});


