import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase admin client first
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn(),
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
    rpc: vi.fn(),
  },
}));

import { CookieGroupService } from './cookieGroup.service.js';

describe('CookieGroupService', () => {
  let mockSupabaseAdmin: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked supabase
    const { supabaseAdmin } = await import('./supabase.js');
    mockSupabaseAdmin = vi.mocked(supabaseAdmin);
  });

  describe('createCookieGroupWithMember', () => {
    it('should create a new cookie group with a member and guest wallet', async () => {
      const mockGroupId = 'group-123';
      const mockCookieId = 'cookie-456';
      const mockDeviceLabel = 'iPhone 15';

      mockSupabaseAdmin.rpc.mockResolvedValue({
        data: mockGroupId,
        error: null,
      });

      const result = await CookieGroupService.createCookieGroupWithMember(
        mockCookieId,
        mockDeviceLabel
      );

      expect(result).toBe(mockGroupId);
      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith(
        'create_cookie_group_with_member',
        {
          p_cookie_id: mockCookieId,
          p_device_label: mockDeviceLabel,
        }
      );
    });

    it('should handle database errors during creation', async () => {
      mockSupabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await expect(
        CookieGroupService.createCookieGroupWithMember('cookie-123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getCookieGroupByCookieId', () => {
    it('should return the cookie group for a given cookie ID', async () => {
      const mockGroup = {
        id: 'group-123',
        user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockGroup,
              error: null,
            }),
          })),
        })),
      }));

      const result = await CookieGroupService.getCookieGroupByCookieId('cookie-123');

      expect(result).toEqual(mockGroup);
    });

    it('should return null if no group found', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      }));

      const result = await CookieGroupService.getCookieGroupByCookieId('nonexistent-cookie');

      expect(result).toBeNull();
    });
  });

  describe('getUserCanonicalGroup', () => {
    it('should return the canonical group for a user', async () => {
      const mockGroup = {
        id: 'group-123',
        user_id: 'user-456',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockGroup,
              error: null,
            }),
          })),
        })),
      }));

      const result = await CookieGroupService.getUserCanonicalGroup('user-456');

      expect(result).toEqual(mockGroup);
    });

    it('should return null if user has no canonical group', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      }));

      const result = await CookieGroupService.getUserCanonicalGroup('user-456');

      expect(result).toBeNull();
    });
  });

  describe('linkDeviceToUser', () => {
    it('should set device group as canonical for new user', async () => {
      const mockGroup = {
        id: 'group-123',
        user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockUpdatedGroup = {
        ...mockGroup,
        user_id: 'user-456',
      };

      // Mock getting the device's group
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'cookie_groups') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockGroup,
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpdatedGroup,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await CookieGroupService.linkDeviceToUser({
        userId: 'user-456',
        deviceCookieId: 'cookie-123',
      });

      expect(result).toEqual(mockUpdatedGroup);
    });

    it('should merge device group into existing canonical group', async () => {
      const mockDeviceGroup = {
        id: 'device-group-123',
        user_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockCanonicalGroup = {
        id: 'canonical-group-456',
        user_id: 'user-789',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Mock getting the device's group
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'cookie_groups') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockDeviceGroup,
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      });

      // Mock getting user's canonical group
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'cookie_groups') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCanonicalGroup,
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      });

      // Mock the merge RPC call
      mockSupabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await CookieGroupService.linkDeviceToUser({
        userId: 'user-789',
        deviceCookieId: 'cookie-123',
      });

      expect(result).toEqual(mockCanonicalGroup);
      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('merge_cookie_groups', {
        p_source_group_id: 'device-group-123',
        p_target_group_id: 'canonical-group-456',
      });
    });

    it('should be idempotent - running twice should not cause issues', async () => {
      const mockGroup = {
        id: 'group-123',
        user_id: 'user-456',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Mock getting the device's group (already linked)
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockGroup,
              error: null,
            }),
          })),
        })),
      }));

      const result = await CookieGroupService.linkDeviceToUser({
        userId: 'user-456',
        deviceCookieId: 'cookie-123',
      });

      expect(result).toEqual(mockGroup);
      // Should not call merge since group is already linked
      expect(mockSupabaseAdmin.rpc).not.toHaveBeenCalled();
    });

    it('should throw error if device group not found', async () => {
      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      }));

      await expect(
        CookieGroupService.linkDeviceToUser({
          userId: 'user-456',
          deviceCookieId: 'nonexistent-cookie',
        })
      ).rejects.toThrow('Device cookie group not found');
    });
  });

  describe('getGuestGamesForGroup', () => {
    it('should return guest games for a cookie group', async () => {
      const mockGames = [
        { game_id: 'game-1', cookie_id: 'cookie-1' },
        { game_id: 'game-2', cookie_id: 'cookie-2' },
      ];

      mockSupabaseAdmin.rpc.mockResolvedValue({
        data: mockGames,
        error: null,
      });

      const result = await CookieGroupService.getGuestGamesForGroup('group-123');

      expect(result).toEqual(mockGames);
      expect(mockSupabaseAdmin.rpc).toHaveBeenCalledWith('get_guest_games_for_group', {
        p_group_id: 'group-123',
      });
    });

    it('should handle database errors', async () => {
      mockSupabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      await expect(
        CookieGroupService.getGuestGamesForGroup('group-123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getGroupMembers', () => {
    it('should return all members of a cookie group', async () => {
      const mockMembers = [
        {
          cookie_id: 'cookie-1',
          group_id: 'group-123',
          device_label: 'iPhone 15',
          last_seen_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
        },
        {
          cookie_id: 'cookie-2',
          group_id: 'group-123',
          device_label: 'Chrome Browser',
          last_seen_at: '2023-01-01T00:00:00Z',
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: mockMembers,
                error: null,
              }),
            })),
          })),
        })),
      }));

      const result = await CookieGroupService.getGroupMembers('group-123');

      expect(result).toEqual(mockMembers);
    });
  });
});
