import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuestLinkingService } from './guestLinking';

// Mock dependencies
vi.mock('./profile', () => ({
  ProfileService: {
    linkGuestAccount: vi.fn(),
  },
}));

vi.mock('./guestCookie', () => ({
  GuestCookieService: {
    getGuestCookieForApi: vi.fn(),
    hasGuestCookie: vi.fn(),
    clearGuestCookie: vi.fn(),
  },
}));

import { ProfileService } from './profile';
import { GuestCookieService } from './guestCookie';

describe('GuestLinkingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('linkGuestAccount', () => {
    it('should link guest account successfully', async () => {
      const mockCookieId = 'guest-cookie-123';
      const mockResult = {
        success: true,
        alreadyLinked: false,
        message: 'Guest account successfully linked',
      };

      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(mockCookieId);
      vi.mocked(ProfileService.linkGuestAccount).mockResolvedValue({
        ok: true,
        data: mockResult,
      });

      const result = await GuestLinkingService.linkGuestAccount();

      expect(result.success).toBe(true);
      expect(result.alreadyLinked).toBe(false);
      expect(result.message).toBe('Guest account successfully linked');
      expect(ProfileService.linkGuestAccount).toHaveBeenCalledWith(mockCookieId);
    });

    it('should handle no guest cookie', async () => {
      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(null);

      const result = await GuestLinkingService.linkGuestAccount();

      expect(result.success).toBe(true);
      expect(result.alreadyLinked).toBe(false);
      expect(result.message).toBe('No guest account to link');
      expect(ProfileService.linkGuestAccount).not.toHaveBeenCalled();
    });

    it('should handle already linked account', async () => {
      const mockCookieId = 'guest-cookie-123';
      const mockResult = {
        success: true,
        alreadyLinked: true,
        message: 'Guest account already linked to this user',
      };

      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(mockCookieId);
      vi.mocked(ProfileService.linkGuestAccount).mockResolvedValue({
        ok: true,
        data: mockResult,
      });

      const result = await GuestLinkingService.linkGuestAccount();

      expect(result.success).toBe(true);
      expect(result.alreadyLinked).toBe(true);
      expect(result.message).toBe('Guest account already linked to this user');
    });

    it('should handle linking failure', async () => {
      const mockCookieId = 'guest-cookie-123';
      const mockError = {
        code: 'LINKING_FAILED',
        message: 'Failed to link guest account',
        http: 500,
        traceId: 'trace-123',
      };

      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(mockCookieId);
      vi.mocked(ProfileService.linkGuestAccount).mockResolvedValue({
        ok: false,
        error: mockError,
      });

      const result = await GuestLinkingService.linkGuestAccount();

      expect(result.success).toBe(false);
      expect(result.alreadyLinked).toBe(false);
      expect(result.message).toBe('Failed to link guest account');
      expect(result.traceId).toBe('trace-123');
    });

    it('should handle unexpected errors', async () => {
      const mockCookieId = 'guest-cookie-123';

      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(mockCookieId);
      vi.mocked(ProfileService.linkGuestAccount).mockRejectedValue(new Error('Network error'));

      const result = await GuestLinkingService.linkGuestAccount();

      expect(result.success).toBe(false);
      expect(result.alreadyLinked).toBe(false);
      expect(result.message).toBe('Network error');
    });
  });

  describe('hasGuestAccountToLink', () => {
    it('should return true when guest cookie exists', () => {
      vi.mocked(GuestCookieService.hasGuestCookie).mockReturnValue(true);

      const result = GuestLinkingService.hasGuestAccountToLink();

      expect(result).toBe(true);
      expect(GuestCookieService.hasGuestCookie).toHaveBeenCalled();
    });

    it('should return false when no guest cookie exists', () => {
      vi.mocked(GuestCookieService.hasGuestCookie).mockReturnValue(false);

      const result = GuestLinkingService.hasGuestAccountToLink();

      expect(result).toBe(false);
    });
  });

  describe('getGuestCookieId', () => {
    it('should return guest cookie ID when available', () => {
      const mockCookieId = 'guest-cookie-123';
      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(mockCookieId);

      const result = GuestLinkingService.getGuestCookieId();

      expect(result).toBe(mockCookieId);
      expect(GuestCookieService.getGuestCookieForApi).toHaveBeenCalled();
    });

    it('should return null when no guest cookie exists', () => {
      vi.mocked(GuestCookieService.getGuestCookieForApi).mockReturnValue(null);

      const result = GuestLinkingService.getGuestCookieId();

      expect(result).toBe(null);
    });
  });

  describe('clearGuestCookie', () => {
    it('should clear guest cookie', () => {
      GuestLinkingService.clearGuestCookie();

      expect(GuestCookieService.clearGuestCookie).toHaveBeenCalled();
    });
  });
});
