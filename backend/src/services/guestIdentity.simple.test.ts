import { describe, it, expect } from 'vitest';

// Simple test to verify the services can be imported and have the right methods
describe('Guest Identity Services - Simple Import Test', () => {
  it('should import CookieGroupService with all required methods', async () => {
    const { CookieGroupService } = await import('./cookieGroup.service.js');
    
    expect(CookieGroupService).toBeDefined();
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

  it('should import JobsService with all required methods', async () => {
    const { JobsService } = await import('./jobs.service.js');
    
    expect(JobsService).toBeDefined();
    expect(typeof JobsService.dailyRegenJob).toBe('function');
    expect(typeof JobsService.purgeGuestsJob).toBe('function');
    expect(typeof JobsService.checkRateLimit).toBe('function');
  });

  it('should import RateLimitService with all required methods', async () => {
    const { RateLimitService } = await import('./rateLimit.service.js');
    
    expect(RateLimitService).toBeDefined();
    expect(typeof RateLimitService.checkCookieIssueRateLimit).toBe('function');
    expect(typeof RateLimitService.recordCookieIssueRequest).toBe('function');
    expect(typeof RateLimitService.getRateLimitInfo).toBe('function');
    expect(typeof RateLimitService.cleanupOldRecords).toBe('function');
  });

  it('should import config service', async () => {
    const { configService } = await import('./config.service.js');
    
    expect(configService).toBeDefined();
    expect(typeof configService.getApp).toBe('function');
  });
});
