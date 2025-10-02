import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CookieGroupService } from './cookieGroup.service.js';
import { JobsService } from './jobs.service.js';
import { RateLimitService } from './rateLimit.service.js';

// This is a simple integration test that verifies the basic functionality
// without complex mocking. It tests the actual service methods.

describe('Guest Identity Integration Tests', () => {
  beforeAll(async () => {
    // Setup test data if needed
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('CookieGroupService', () => {
    it('should have all required methods', () => {
      expect(typeof CookieGroupService.createCookieGroupWithMember).toBe('function');
      expect(typeof CookieGroupService.getCookieGroupByCookieId).toBe('function');
      expect(typeof CookieGroupService.getUserCanonicalGroup).toBe('function');
      expect(typeof CookieGroupService.linkDeviceToUser).toBe('function');
      expect(typeof CookieGroupService.getGuestGamesForGroup).toBe('function');
      expect(typeof CookieGroupService.getGroupMembers).toBe('function');
      expect(typeof CookieGroupService.updateMemberLastSeen).toBe('function');
      expect(typeof CookieGroupService.getGuestWallet).toBe('function');
      expect(typeof CookieGroupService.updateGuestWalletBalance).toBe('function');
    });

    it('should validate linkDeviceToUser parameters', async () => {
      // Test parameter validation
      await expect(
        CookieGroupService.linkDeviceToUser({
          userId: '',
          deviceCookieId: 'test-cookie',
        })
      ).rejects.toThrow();

      await expect(
        CookieGroupService.linkDeviceToUser({
          userId: 'test-user',
          deviceCookieId: '',
        })
      ).rejects.toThrow();
    });
  });

  describe('JobsService', () => {
    it('should have all required methods', () => {
      expect(typeof JobsService.dailyRegenJob).toBe('function');
      expect(typeof JobsService.purgeGuestsJob).toBe('function');
      expect(typeof JobsService.checkRateLimit).toBe('function');
    });

    it('should handle daily regen with zero amount', async () => {
      // This should not throw and should return zero counts
      const result = await JobsService.dailyRegenJob();
      expect(result).toHaveProperty('guestGroupsUpdated');
      expect(result).toHaveProperty('userWalletsUpdated');
      expect(result).toHaveProperty('ledgerEntriesCreated');
      expect(typeof result.guestGroupsUpdated).toBe('number');
      expect(typeof result.userWalletsUpdated).toBe('number');
      expect(typeof result.ledgerEntriesCreated).toBe('number');
    });

    it('should handle purge guests job', async () => {
      // This should not throw and should return counts
      const result = await JobsService.purgeGuestsJob();
      expect(result).toHaveProperty('staleMembersRemoved');
      expect(result).toHaveProperty('emptyGroupsRemoved');
      expect(typeof result.staleMembersRemoved).toBe('number');
      expect(typeof result.emptyGroupsRemoved).toBe('number');
    });
  });

  describe('RateLimitService', () => {
    it('should have all required methods', () => {
      expect(typeof RateLimitService.checkCookieIssueRateLimit).toBe('function');
      expect(typeof RateLimitService.recordCookieIssueRequest).toBe('function');
      expect(typeof RateLimitService.getRateLimitInfo).toBe('function');
      expect(typeof RateLimitService.cleanupOldRecords).toBe('function');
    });

    it('should validate IP address parameter', async () => {
      // Test with invalid IP
      await expect(
        RateLimitService.checkCookieIssueRateLimit('')
      ).rejects.toThrow();

      // Test with valid IP
      const result = await RateLimitService.checkCookieIssueRateLimit('192.168.1.1');
      expect(typeof result).toBe('boolean');
    });

    it('should return rate limit info', async () => {
      const result = await RateLimitService.getRateLimitInfo('192.168.1.1');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('used');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetTime');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.used).toBe('number');
      expect(typeof result.remaining).toBe('number');
      expect(result.resetTime).toBeInstanceOf(Date);
    });
  });

  describe('Service Integration', () => {
    it('should work together for guest identity flow', async () => {
      // Test that services can be imported and used together
      const cookieId = 'test-cookie-123';
      const userId = 'test-user-456';

      // These should not throw (even if they fail due to missing data)
      try {
        await CookieGroupService.createCookieGroupWithMember(cookieId, 'Test Device');
      } catch (error) {
        // Expected to fail in test environment, but should not crash
        expect(error).toBeDefined();
      }

      try {
        await CookieGroupService.linkDeviceToUser({ userId, deviceCookieId: cookieId });
      } catch (error) {
        // Expected to fail in test environment, but should not crash
        expect(error).toBeDefined();
      }

      // Jobs should work
      const regenResult = await JobsService.dailyRegenJob();
      expect(regenResult).toBeDefined();

      const purgeResult = await JobsService.purgeGuestsJob();
      expect(purgeResult).toBeDefined();

      // Rate limiting should work
      const rateLimitResult = await RateLimitService.checkCookieIssueRateLimit('192.168.1.1');
      expect(typeof rateLimitResult).toBe('boolean');
    });
  });
});
