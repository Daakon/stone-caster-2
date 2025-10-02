import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptsService } from './prompts.service.js';

// Mock Supabase admin client
const mockSupabaseAdmin = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
};

vi.mock('./supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('PromptsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllPrompts', () => {
    it('should return all prompts with filters', async () => {
      const mockPrompts = [
        {
          id: 'prompt-1',
          slug: 'world-intro',
          scope: 'world',
          version: 1,
          hash: 'abc123',
          content: 'Welcome to the world...',
          active: true,
          metadata: {},
          created_by: 'admin-123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'prompt-2',
          slug: 'scenario-start',
          scope: 'scenario',
          version: 1,
          hash: 'def456',
          content: 'The scenario begins...',
          active: false,
          metadata: {},
          created_by: 'admin-123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: mockPrompts,
              error: null,
            }),
          })),
        })),
      }));

      const result = await PromptsService.getAllPrompts();

      expect(result).toEqual(mockPrompts);
    });

    it('should filter prompts by scope', async () => {
      const mockPrompts = [
        {
          id: 'prompt-1',
          slug: 'world-intro',
          scope: 'world',
          version: 1,
          hash: 'abc123',
          content: 'Welcome to the world...',
          active: true,
          metadata: {},
          created_by: 'admin-123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: mockPrompts,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await PromptsService.getAllPrompts({ scope: 'world' });

      expect(result).toEqual(mockPrompts);
    });

    it('should handle database errors', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          })),
        })),
      }));

      await expect(PromptsService.getAllPrompts()).rejects.toThrow('Database error');
    });
  });

  describe('createPrompt', () => {
    it('should create a new prompt version and deactivate previous versions', async () => {
      const mockNewPrompt = {
        id: 'prompt-2',
        slug: 'world-intro',
        scope: 'world',
        version: 2,
        hash: 'newhash123',
        content: 'Updated world intro...',
        active: true,
        metadata: { author: 'admin' },
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockNewPrompt,
              error: null,
            }),
          })),
        })),
      }));

      const result = await PromptsService.createPrompt({
        slug: 'world-intro',
        scope: 'world',
        content: 'Updated world intro...',
        metadata: { author: 'admin' },
        active: true,
      });

      expect(result).toEqual(mockNewPrompt);
    });

    it('should handle database errors during creation', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          })),
        })),
      }));

      await expect(
        PromptsService.createPrompt({
          slug: 'world-intro',
          scope: 'world',
          content: 'New content...',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('updatePrompt', () => {
    it('should update prompt metadata and active status', async () => {
      const mockUpdatedPrompt = {
        id: 'prompt-1',
        slug: 'world-intro',
        scope: 'world',
        version: 1,
        hash: 'abc123',
        content: 'Welcome to the world...',
        active: false,
        metadata: { updated: true },
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedPrompt,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await PromptsService.updatePrompt('prompt-1', {
        active: false,
        metadata: { updated: true },
      });

      expect(result).toEqual(mockUpdatedPrompt);
    });

    it('should throw PROMPT_NOT_FOUND for non-existent prompt', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      }));

      await expect(
        PromptsService.updatePrompt('non-existent-id', { active: false })
      ).rejects.toThrow('Prompt not found: non-existent-id');
    });

    it('should handle database errors during update', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            })),
          })),
        })),
      }));

      await expect(
        PromptsService.updatePrompt('prompt-1', { active: false })
      ).rejects.toThrow('Database error');
    });
  });

  describe('deletePrompt', () => {
    it('should soft delete a prompt by setting active to false', async () => {
      const mockDeletedPrompt = {
        id: 'prompt-1',
        slug: 'world-intro',
        scope: 'world',
        version: 1,
        hash: 'abc123',
        content: 'Welcome to the world...',
        active: false,
        metadata: {},
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockDeletedPrompt,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await PromptsService.deletePrompt('prompt-1');

      expect(result).toEqual(mockDeletedPrompt);
    });

    it('should throw PROMPT_NOT_FOUND for non-existent prompt', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      }));

      await expect(
        PromptsService.deletePrompt('non-existent-id')
      ).rejects.toThrow('Prompt not found: non-existent-id');
    });
  });

  describe('getActivePrompt', () => {
    it('should return the active prompt for a given slug and scope', async () => {
      const mockActivePrompt = {
        id: 'prompt-1',
        slug: 'world-intro',
        scope: 'world',
        version: 1,
        hash: 'abc123',
        content: 'Welcome to the world...',
        active: true,
        metadata: {},
        created_by: 'admin-123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockActivePrompt,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await PromptsService.getActivePrompt('world-intro', 'world');

      expect(result).toEqual(mockActivePrompt);
    });

    it('should return null if no active prompt found', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' }, // No rows returned
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await PromptsService.getActivePrompt('non-existent', 'world');

      expect(result).toBeNull();
    });
  });
});
