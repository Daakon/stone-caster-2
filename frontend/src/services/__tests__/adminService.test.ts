import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../adminService';

// Mock fetch
global.fetch = vi.fn();

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-key',
  VITE_API_BASE_URL: 'https://api.test.com'
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() => ({
        data: {
          session: {
            access_token: 'test-token'
          }
        }
      }))
    }
  }))
}));

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPrompts', () => {
    it('should fetch prompts with filters', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            id: '1',
            layer: 'core',
            content: 'Test prompt',
            turn_stage: 'any',
            sort_order: 0,
            version: '1.0.0',
            metadata: {},
            active: true,
            locked: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            tokenCount: 25
          } as any
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.getPrompts({
        layer: 'core',
        active: true,
        search: 'test'
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts?layer=core&active=true&search=test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle API errors', async () => {
      const mockError = {
        ok: false,
        error: 'Failed to fetch prompts'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockError)
      });

      const result = await adminService.getPrompts();
      expect(result).toEqual(mockError);
    });
  });

  describe('createPrompt', () => {
    it('should create a new prompt', async () => {
      const promptData = {
        layer: 'core',
        content: 'Test prompt',
        active: true,
        locked: false,
        turn_stage: 'any',
        sort_order: 0,
        version: '1.0.0',
        metadata: {}
      };

      const mockResponse = {
        ok: true,
        data: {
          id: '1',
          tokenCount: 12,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          ...promptData
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.createPrompt(promptData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(promptData)
        })
      );
    });
  });

  describe('updatePrompt', () => {
    it('should update an existing prompt', async () => {
      const updateData = {
        content: 'Updated prompt',
        active: false
      };

      const mockResponse = {
        ok: true,
        data: {
          id: '1',
          tokenCount: 30,
          layer: 'core',
          turn_stage: 'any',
          sort_order: 0,
          version: '1.0.0',
          metadata: {},
          active: false,
          locked: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:05:00Z',
          ...updateData
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.updatePrompt('1', updateData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
      );
    });
  });

  describe('deletePrompt', () => {
    it('should delete a prompt', async () => {
      const mockResponse = {
        ok: true,
        message: 'Prompt deleted successfully'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.deletePrompt('1');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('togglePromptActive', () => {
    it('should toggle prompt active status', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: '1',
          active: false,
          locked: false,
          layer: 'core',
          turn_stage: 'any',
          sort_order: 0,
          version: '1.0.0',
          content: 'Updated prompt',
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:10:00Z',
          tokenCount: 28
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.togglePromptActive('1');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/1/toggle-active',
        expect.objectContaining({
          method: 'PATCH'
        })
      );
    });
  });

  describe('togglePromptLocked', () => {
    it('should toggle prompt locked status', async () => {
      const mockResponse = {
        ok: true,
        data: {
          id: '1',
          active: true,
          locked: true,
          layer: 'core',
          turn_stage: 'any',
          sort_order: 0,
          version: '1.0.0',
          content: 'Locked prompt',
          metadata: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:15:00Z',
          tokenCount: 32
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.togglePromptLocked('1');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/1/toggle-locked',
        expect.objectContaining({
          method: 'PATCH'
        })
      );
    });
  });

  describe('getPromptStats', () => {
    it('should fetch prompt statistics', async () => {
      const mockResponse = {
        ok: true,
        data: {
          total_prompts: 10,
          active_prompts: 8,
          locked_prompts: 2,
          layers_count: { core: 5, world: 3 },
          worlds_count: 2
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.getPromptStats();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/stats',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('validateDependencies', () => {
    it('should validate prompt dependencies', async () => {
      const mockResponse = {
        ok: true,
        data: [
          {
            prompt_id: '1',
            missing_dependencies: ['dep1', 'dep2']
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.validateDependencies();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/validate-dependencies',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('bulkOperation', () => {
    it('should perform bulk operations', async () => {
      const mockResponse = {
        ok: true,
        data: [],
        message: 'Bulk activate completed successfully'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await adminService.bulkOperation('activate', ['1', '2']);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/admin/prompts/bulk',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'activate',
            promptIds: ['1', '2']
          })
        })
      );
    });
  });

  describe('JSON formatting utilities', () => {
    it('should format JSON for display', () => {
      const obj = { key: 'value', nested: { prop: 'test' } };
      const formatted = adminService.formatJsonForDisplay(obj);
      
      expect(formatted).toBe(JSON.stringify(obj, null, 2));
    });

    it('should minify JSON for storage', () => {
      const obj = { key: 'value', nested: { prop: 'test' } };
      const minified = adminService.minifyJsonForStorage(obj);
      
      expect(minified).toBe(JSON.stringify(obj));
    });

    it('should parse JSON from storage', () => {
      const obj = { key: 'value', nested: { prop: 'test' } };
      const jsonString = JSON.stringify(obj);
      const parsed = adminService.parseJsonFromStorage(jsonString);
      
      expect(parsed).toEqual(obj);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'invalid json';
      const parsed = adminService.parseJsonFromStorage(invalidJson);
      
      expect(parsed).toEqual({});
    });
  });
});






