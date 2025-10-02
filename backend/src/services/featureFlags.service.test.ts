import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagsService } from './featureFlags.service.js';

// Mock Supabase admin client
const mockSupabaseAdmin = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
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
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

vi.mock('./supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllFlags', () => {
    it('should return all feature flags', async () => {
      const mockFlags = [
        { key: 'stones_show_guest_pill', enabled: true, payload: {}, updated_at: '2023-01-01T00:00:00Z' },
        { key: 'drifter_onboarding', enabled: false, payload: { step: 1 }, updated_at: '2023-01-01T00:00:00Z' },
      ];

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({
              data: mockFlags,
              error: null,
            }),
          })),
        })),
      }));

      const result = await FeatureFlagsService.getAllFlags();

      expect(result).toEqual(mockFlags);
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

      await expect(FeatureFlagsService.getAllFlags()).rejects.toThrow('Database error');
    });
  });

  describe('updateFlag', () => {
    it('should update flag enabled status', async () => {
      const mockUpdatedFlag = {
        key: 'stones_show_guest_pill',
        enabled: false,
        payload: {},
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedFlag,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await FeatureFlagsService.updateFlag('stones_show_guest_pill', { enabled: false });

      expect(result).toEqual(mockUpdatedFlag);
    });

    it('should update flag payload', async () => {
      const mockUpdatedFlag = {
        key: 'drifter_onboarding',
        enabled: true,
        payload: { step: 2, completed: true },
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedFlag,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await FeatureFlagsService.updateFlag('drifter_onboarding', { 
        payload: { step: 2, completed: true } 
      });

      expect(result).toEqual(mockUpdatedFlag);
    });

    it('should update both enabled and payload', async () => {
      const mockUpdatedFlag = {
        key: 'ws_push_enabled',
        enabled: true,
        payload: { endpoint: 'wss://example.com' },
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockUpdatedFlag,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await FeatureFlagsService.updateFlag('ws_push_enabled', { 
        enabled: true,
        payload: { endpoint: 'wss://example.com' }
      });

      expect(result).toEqual(mockUpdatedFlag);
    });

    it('should throw FLAG_NOT_FOUND for non-existent flag', async () => {
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
        FeatureFlagsService.updateFlag('non_existent_flag', { enabled: true })
      ).rejects.toThrow('Feature flag not found: non_existent_flag');
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
        FeatureFlagsService.updateFlag('stones_show_guest_pill', { enabled: false })
      ).rejects.toThrow('Database error');
    });
  });

  describe('createFlag', () => {
    it('should create a new feature flag', async () => {
      const mockNewFlag = {
        key: 'new_feature',
        enabled: false,
        payload: {},
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockNewFlag,
              error: null,
            }),
          })),
        })),
      }));

      const result = await FeatureFlagsService.createFlag('new_feature', false, {});

      expect(result).toEqual(mockNewFlag);
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
        FeatureFlagsService.createFlag('new_feature', false, {})
      ).rejects.toThrow('Database error');
    });
  });
});
