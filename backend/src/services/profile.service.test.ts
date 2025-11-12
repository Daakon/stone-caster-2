import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileService } from './profile.service.js';
import { supabaseAdmin } from './supabase.js';
import { createSupabaseQueryBuilder } from '../test-utils/supabase-mock.js';
import { UpdateProfileRequest } from '@shared';

const createCsrfTableMock = (options: {
  selectResult?: { data: any; error: any };
  insertResult?: { data: any; error: any };
}) => {
  const deleteChain = {
    eq: vi.fn(() => ({
      lt: vi.fn().mockResolvedValue({ error: null }),
    })),
  };

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(options.selectResult ?? { data: null, error: null }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(options.insertResult ?? { data: null, error: null }),
      })),
    })),
    delete: vi.fn(() => deleteChain),
  };
};

describe('ProfileService', () => {
  let mockSupabaseAdmin: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked services
    const { supabaseAdmin } = await import('./supabase.js');
    mockSupabaseAdmin = vi.mocked(supabaseAdmin);

    mockSupabaseAdmin.from.mockReset();
    mockSupabaseAdmin.from.mockImplementation(() => createSupabaseQueryBuilder());

    mockSupabaseAdmin.rpc.mockReset();
    mockSupabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

    mockSupabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'mock-user', email: 'test@example.com' } },
      error: null,
    });
  });

  describe('getProfile', () => {
    it('should return profile data with proper DTO redaction', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const mockProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        auth_user_id: mockAuthUserId,
        cookie_group_id: null,
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
        created_at: '2023-01-01T00:00:00Z',
        last_seen_at: '2023-01-02T00:00:00Z',
      };

      // Mock the RPC call for get_user_profile_by_auth_id
      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_user_profile_by_auth_id') {
          return {
            data: [mockProfile],
            error: null,
          };
        }
        if (fnName === 'update_user_last_seen') {
          return {
            data: null,
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await ProfileService.getProfile(mockAuthUserId);

      expect(result).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440001',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        lastSeen: '2023-01-02T00:00:00Z',
      });

      // Verify internal fields are not exposed
      expect(result).not.toHaveProperty('auth_user_id');
      expect(result).not.toHaveProperty('cookie_group_id');
    });

    it('should handle missing profile gracefully', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const mockProfile = {
        id: 'profile-123',
        display_name: 'New User',
        avatar_url: null,
        email: 'new.user@example.com',
        preferences: null,
        created_at: '2023-01-01T00:00:00Z',
        last_seen_at: '2023-01-02T00:00:00Z',
      };

      let profileFetchCount = 0;
      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_user_profile_by_auth_id') {
          profileFetchCount += 1;
          if (profileFetchCount === 1) {
            return { data: [], error: null };
          }
          return {
            data: [mockProfile],
            error: null,
          };
        }
        if (fnName === 'update_user_last_seen') {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });

      const result = await ProfileService.getProfile(mockAuthUserId);

      expect(result).toEqual({
        id: mockProfile.id,
        displayName: mockProfile.display_name,
        avatarUrl: mockProfile.avatar_url,
        email: mockProfile.email,
        preferences: {
          showTips: true,
          theme: 'auto',
          notifications: { email: true, push: false },
        },
        createdAt: mockProfile.created_at,
        lastSeen: mockProfile.last_seen_at,
      });
      expect(profileFetchCount).toBe(2);
    });

    it('should handle database errors', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'get_user_profile_by_auth_id') {
          return {
            data: null,
            error: new Error('Database connection failed'),
          };
        }
        return { data: null, error: null };
      });

      await expect(ProfileService.getProfile(mockAuthUserId)).rejects.toThrow('Failed to get profile: Database connection failed');
    });
  });

  describe('updateProfile', () => {
    it('should update profile with valid data', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const updateData: UpdateProfileRequest = {
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        preferences: {
          showTips: false,
          theme: 'light',
          notifications: {
            email: false,
            push: true,
          },
        },
      };

      const mockUpdatedProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        auth_user_id: mockAuthUserId,
        display_name: 'Updated Name',
        avatar_url: 'https://example.com/new-avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: false,
          theme: 'light',
          notifications: {
            email: false,
            push: true,
          },
        },
        created_at: '2023-01-01T00:00:00Z',
        last_seen_at: '2023-01-02T00:00:00Z',
      };

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'update_user_profile') {
          return {
            data: null,
            error: null,
          };
        }
        if (fnName === 'get_user_profile_by_auth_id') {
          return {
            data: [mockUpdatedProfile],
            error: null,
          };
        }
        if (fnName === 'update_user_last_seen') {
          return {
            data: null,
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await ProfileService.updateProfile(mockAuthUserId, updateData);

      expect(result).toEqual({
        id: '550e8400-e29b-41d4-a716-446655440001',
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: false,
          theme: 'light',
          notifications: {
            email: false,
            push: true,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        lastSeen: '2023-01-02T00:00:00Z',
      });
    });

    it('should validate display name length', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const updateData: UpdateProfileRequest = {
        displayName: 'a'.repeat(101), // Too long
      };

      await expect(ProfileService.updateProfile(mockAuthUserId, updateData)).rejects.toThrow('Display name must be between 1 and 100 characters');
    });

    it('should validate avatar URL format', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const updateData: UpdateProfileRequest = {
        avatarUrl: 'not-a-valid-url',
      };

      await expect(ProfileService.updateProfile(mockAuthUserId, updateData)).rejects.toThrow('Invalid avatar URL format');
    });

    it('should handle partial updates', async () => {
      const mockAuthUserId = '550e8400-e29b-41d4-a716-446655440000';
      const updateData: UpdateProfileRequest = {
        displayName: 'New Name',
        // Only updating display name, other fields should remain unchanged
      };

      const mockUpdatedProfile = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        auth_user_id: mockAuthUserId,
        display_name: 'New Name',
        avatar_url: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
        created_at: '2023-01-01T00:00:00Z',
        last_seen_at: '2023-01-02T00:00:00Z',
      };

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'update_user_profile') {
          return {
            data: null,
            error: null,
          };
        }
        if (fnName === 'get_user_profile_by_auth_id') {
          return {
            data: [mockUpdatedProfile],
            error: null,
          };
        }
        if (fnName === 'update_user_last_seen') {
          return {
            data: null,
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await ProfileService.updateProfile(mockAuthUserId, updateData);

      expect(result.displayName).toBe('New Name');
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg'); // Should remain unchanged
    });
  });

  describe('revokeOtherSessions', () => {
    it('should revoke all sessions except current one', async () => {
      const currentSessionId = 'current-session-123';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.auth.admin.signOut.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await ProfileService.revokeOtherSessions(authUserId, currentSessionId);

      expect(result).toEqual({
        revokedCount: 1,
        currentSessionPreserved: true,
      });
      expect(mockSupabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith(authUserId, 'others');

      expect(mockSupabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith(authUserId, 'others');
    });

    it('should handle session revocation errors', async () => {
      const currentSessionId = 'current-session-123';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.auth.admin.signOut.mockResolvedValue({
        data: { user: null },
        error: new Error('Session revocation failed'),
      });

      await expect(ProfileService.revokeOtherSessions(authUserId, currentSessionId)).rejects.toThrow('Session revocation failed');
    });

    it('should be idempotent - safe to repeat', async () => {
      const currentSessionId = 'current-session-123';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.auth.admin.signOut.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Call multiple times
      await ProfileService.revokeOtherSessions(authUserId, currentSessionId);
      await ProfileService.revokeOtherSessions(authUserId, currentSessionId);
      await ProfileService.revokeOtherSessions(authUserId, currentSessionId);

      expect(mockSupabaseAdmin.auth.admin.signOut).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate CSRF token format', async () => {
      const validToken = 'csrf-token-123';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock successful validation
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'csrf_tokens') {
          return createCsrfTableMock({
            selectResult: {
              data: { token: validToken, expires_at: new Date(Date.now() + 3600000).toISOString() },
              error: null,
            },
          });
        }
        return createSupabaseQueryBuilder();
      });

      const result = await ProfileService.validateCSRFToken(authUserId, validToken);
      expect(result).toBe(true);
    });

    it('should reject invalid CSRF token', async () => {
      const invalidToken = 'invalid-token';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'csrf_tokens') {
          return createCsrfTableMock({
            selectResult: {
              data: null,
              error: null,
            },
          });
        }
        return createSupabaseQueryBuilder();
      });

      const result = await ProfileService.validateCSRFToken(authUserId, invalidToken);
      expect(result).toBe(false);
    });

    it('should reject expired CSRF token', async () => {
      const expiredToken = 'expired-token';
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'csrf_tokens') {
          return createCsrfTableMock({
            selectResult: {
              data: { token: expiredToken, expires_at: new Date(Date.now() - 3600000).toISOString() },
              error: null,
            },
          });
        }
        return createSupabaseQueryBuilder();
      });

      const result = await ProfileService.validateCSRFToken(authUserId, expiredToken);
      expect(result).toBe(false);
    });
  });

  describe('generateCSRFToken', () => {
    it('should generate a valid CSRF token', async () => {
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'csrf_tokens') {
          return createCsrfTableMock({
            insertResult: {
              data: { token: 'generated-csrf-token-123' },
              error: null,
            },
          });
        }
        return createSupabaseQueryBuilder();
      });

      const result = await ProfileService.generateCSRFToken(authUserId);
      expect(result).toBe('generated-csrf-token-123');
    });

    it('should handle CSRF token generation errors', async () => {
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'csrf_tokens') {
          return createCsrfTableMock({
            insertResult: {
              data: null,
              error: new Error('Failed to generate CSRF token'),
            },
          });
        }
        return createSupabaseQueryBuilder();
      });

      await expect(ProfileService.generateCSRFToken(authUserId)).rejects.toThrow('Failed to generate CSRF token');
    });
  });

  describe('linkCookieGroupToUser', () => {
    it('should link cookie group to user profile', async () => {
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';
      const cookieGroupId = '550e8400-e29b-41d4-a716-446655440002';

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'link_guest_account_to_user') {
          return {
            data: [
              {
                success: true,
                characters_migrated: 2,
                games_migrated: 1,
                stones_migrated: 50,
                ledger_entries_created: 3,
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const result = await ProfileService.linkCookieGroupToUser(authUserId, cookieGroupId);
      expect(result).toEqual({
        success: true,
        charactersMigrated: 2,
        gamesMigrated: 1,
        stonesMigrated: 50,
        ledgerEntriesCreated: 3,
      });
    });

    it('should handle linking errors', async () => {
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';
      const cookieGroupId = '550e8400-e29b-41d4-a716-446655440002';

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'link_guest_account_to_user') {
          return {
            data: null,
            error: new Error('Link failure'),
          };
        }
        return { data: null, error: null };
      });

      await expect(ProfileService.linkCookieGroupToUser(authUserId, cookieGroupId)).rejects.toThrow('Failed to link guest account');
    });

    it('should error when linking function returns no data', async () => {
      const authUserId = '550e8400-e29b-41d4-a716-446655440000';
      const cookieGroupId = '550e8400-e29b-41d4-a716-446655440002';

      mockSupabaseAdmin.rpc.mockImplementation((fnName: string) => {
        if (fnName === 'link_guest_account_to_user') {
          return {
            data: [],
            error: null,
          };
        }
        return { data: null, error: null };
      });

      await expect(ProfileService.linkCookieGroupToUser(authUserId, cookieGroupId)).rejects.toThrow(
        'Failed to link guest account: Error: No data returned from guest linking function'
      );
    });
  });
});
