import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitService } from './rateLimit.service.js';
import { ApiErrorCode } from 'shared';

// Mock Supabase admin client
const mockSupabaseAdmin = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
};

// Mock config service
const mockConfigService = {
  getConfig: vi.fn(),
};

vi.mock('./supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock('../config/index.js', () => ({
  configService: mockConfigService,
}));

describe('RateLimitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkCookieIssueRateLimit', () => {
    it('should allow cookie issuance within rate limit', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      const mockRecentRequests = [
        { id: 'req-1', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-2', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
      ];

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentRequests,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await RateLimitService.checkCookieIssueRateLimit('192.168.1.1');

      expect(result).toBe(true);
    });

    it('should reject cookie issuance exceeding rate limit', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 5 },
        },
      };

      const mockRecentRequests = [
        { id: 'req-1', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-2', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-3', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-4', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-5', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-6', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
      ];

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentRequests,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await RateLimitService.checkCookieIssueRateLimit('192.168.1.1');

      expect(result).toBe(false);
    });

    it('should handle no recent requests', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await RateLimitService.checkCookieIssueRateLimit('192.168.1.1');

      expect(result).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Database error'),
                }),
              })),
            })),
          })),
        })),
      }));

      await expect(
        RateLimitService.checkCookieIssueRateLimit('192.168.1.1')
      ).rejects.toThrow('Database error');
    });
  });

  describe('recordCookieIssueRequest', () => {
    it('should record a cookie issue request', async () => {
      const mockRecord = {
        id: 'req-123',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0...',
        created_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockRecord,
              error: null,
            }),
          })),
        })),
      }));

      const result = await RateLimitService.recordCookieIssueRequest({
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      });

      expect(result).toEqual(mockRecord);
    });

    it('should handle database errors during recording', async () => {
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
        RateLimitService.recordCookieIssueRequest({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit information for an IP', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      const mockRecentRequests = [
        { id: 'req-1', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
        { id: 'req-2', ip_address: '192.168.1.1', created_at: '2023-01-01T00:00:00Z' },
      ];

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentRequests,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await RateLimitService.getRateLimitInfo('192.168.1.1');

      expect(result).toEqual({
        limit: 10,
        used: 2,
        remaining: 8,
        resetTime: expect.any(Date),
      });
    });

    it('should handle no recent requests', async () => {
      const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      mockConfigService.getConfig.mockResolvedValue(mockConfig);

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      }));

      const result = await RateLimitService.getRateLimitInfo('192.168.1.1');

      expect(result).toEqual({
        limit: 10,
        used: 0,
        remaining: 10,
        resetTime: expect.any(Date),
      });
    });
  });
});
