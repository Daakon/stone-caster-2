import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileService } from './profile';

// Mock the API functions
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

import { apiFetch, apiPost, apiPut } from '../lib/api';

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAccess', () => {
    it('should return access info when user can access', async () => {
      const mockAccessInfo = {
        canAccess: true,
        isGuest: false,
        userId: 'user-123',
        requiresAuth: false,
      };

      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        data: mockAccessInfo,
      });

      const result = await ProfileService.checkAccess();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockAccessInfo);
      }
      expect(apiFetch).toHaveBeenCalledWith('/api/profile/access');
    });

    it('should return error when access check fails', async () => {
      const mockError = {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        http: 401,
      };

      vi.mocked(apiFetch).mockResolvedValue({
        ok: false,
        error: mockError,
      });

      const result = await ProfileService.checkAccess();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });
  });

  describe('getProfile', () => {
    it('should return profile data when successful', async () => {
      const mockProfile = {
        id: 'profile-123',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'auto' as const,
          notifications: {
            email: true,
            push: false,
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        lastSeen: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiFetch).mockResolvedValue({
        ok: true,
        data: mockProfile,
      });

      const result = await ProfileService.getProfile();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockProfile);
      }
      expect(apiFetch).toHaveBeenCalledWith('/api/profile');
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updateData = {
        displayName: 'Updated Name',
        preferences: {
          theme: 'dark' as const,
        },
      };

      const updatedProfile = {
        id: 'profile-123',
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        preferences: {
          showTips: true,
          theme: 'dark' as const,
          notifications: {
            email: true,
            push: false,
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        lastSeen: '2024-01-01T00:00:00Z',
      };

      vi.mocked(apiPut).mockResolvedValue({
        ok: true,
        data: updatedProfile,
      });

      const result = await ProfileService.updateProfile(updateData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(updatedProfile);
      }
      expect(apiPut).toHaveBeenCalledWith('/api/profile', updateData);
    });
  });

  describe('generateCSRFToken', () => {
    it('should generate CSRF token successfully', async () => {
      const mockToken = {
        csrfToken: 'csrf-token-123',
      };

      vi.mocked(apiPost).mockResolvedValue({
        ok: true,
        data: mockToken,
      });

      const result = await ProfileService.generateCSRFToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockToken);
      }
      expect(apiPost).toHaveBeenCalledWith('/api/profile/csrf-token', {});
    });
  });

  describe('revokeOtherSessions', () => {
    it('should revoke sessions successfully', async () => {
      const csrfToken = 'csrf-token-123';
      const mockResult = {
        revokedCount: 2,
        currentSessionPreserved: true,
      };

      vi.mocked(apiPost).mockResolvedValue({
        ok: true,
        data: mockResult,
      });

      const result = await ProfileService.revokeOtherSessions(csrfToken);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockResult);
      }
      expect(apiPost).toHaveBeenCalledWith('/api/profile/revoke-sessions', { csrfToken });
    });
  });

  describe('linkGuestAccount', () => {
    it('should link guest account successfully', async () => {
      const cookieGroupId = 'cookie-group-123';
      const mockResult = {
        success: true,
        alreadyLinked: false,
        message: 'Guest account successfully linked',
      };

      vi.mocked(apiPost).mockResolvedValue({
        ok: true,
        data: mockResult,
      });

      const result = await ProfileService.linkGuestAccount(cookieGroupId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockResult);
      }
      expect(apiPost).toHaveBeenCalledWith('/api/profile/link-guest', { cookieGroupId });
    });

    it('should handle already linked account', async () => {
      const cookieGroupId = 'cookie-group-123';
      const mockResult = {
        success: true,
        alreadyLinked: true,
        message: 'Guest account already linked to this user',
      };

      vi.mocked(apiPost).mockResolvedValue({
        ok: true,
        data: mockResult,
      });

      const result = await ProfileService.linkGuestAccount(cookieGroupId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.alreadyLinked).toBe(true);
      }
    });
  });
});
