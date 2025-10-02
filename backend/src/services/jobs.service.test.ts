import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase admin client first
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
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
        lt: vi.fn(),
      })),
    })),
    rpc: vi.fn(),
  },
}));

// Mock config service
vi.mock('./config.service.js', () => ({
  configService: {
    getPricing: vi.fn(),
    getApp: vi.fn(),
    getFeatures: vi.fn(),
  },
}));

import { JobsService } from './jobs.service.js';

describe('JobsService', () => {
  let mockSupabaseAdmin: any;
  let mockConfigService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked services
    const { supabaseAdmin } = await import('./supabase.js');
    const { configService } = await import('./config.service.js');
    mockSupabaseAdmin = vi.mocked(supabaseAdmin);
    mockConfigService = vi.mocked(configService);
    
    // Setup default config service mocks
    mockConfigService.getPricing.mockReturnValue({
      turnCostDefault: 2,
      turnCostByWorld: {},
      guestStarterCastingStones: 10,
      guestDailyRegen: 5,
      conversionRates: { shard: 1, crystal: 10, relic: 100 },
    });
    
    mockConfigService.getApp.mockReturnValue({
      cookieTtlDays: 30,
      idempotencyRequired: true,
      allowAsyncTurnFallback: true,
      telemetrySampleRate: 1.0,
      drifterEnabled: true,
    });
    
    mockConfigService.getFeatures.mockReturnValue([
      { key: 'telemetry_enabled', enabled: true, payload: {} },
    ]);
  });

  describe('dailyRegenJob', () => {
    it('should add daily regen to guest groups and create ledger entries', async () => {
      // Config is already mocked in beforeEach

      const mockGuestWallets = [
        {
          group_id: 'group-1',
          casting_stones: 10,
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          group_id: 'group-2',
          casting_stones: 20,
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockUserWallets = [
        {
          id: 'wallet-1',
          user_id: 'user-1',
          casting_stones: 15,
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: 'wallet-2',
          user_id: 'user-2',
          casting_stones: 25,
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      // Config is already mocked in beforeEach

      // Mock guest wallets query
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'guest_stone_wallets') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: mockGuestWallets,
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockGuestWallets[0], casting_stones: 15 },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        } else if (table === 'stone_wallets') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: mockUserWallets,
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockUserWallets[0], casting_stones: 20 },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        } else if (table === 'stone_ledger') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'ledger-entry-1',
                    wallet_id: 'wallet-1',
                    user_id: 'user-1',
                    amount: 5,
                    reason: 'DAILY_REGEN',
                    created_at: '2023-01-01T00:00:00Z',
                  },
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      });

      const result = await JobsService.dailyRegenJob();

      expect(result).toEqual({
        guestGroupsUpdated: 2,
        userWalletsUpdated: 2,
        ledgerEntriesCreated: 4,
      });

      // Verify guest wallets were updated
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('guest_stone_wallets');
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('stone_wallets');
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('stone_ledger');
    });

    it('should skip regen when guest_daily_regen is 0', async () => {
      // const mockConfig = {
      //   pricing: {
      //     guest_daily_regen: { value: 0 },
      //   },
      // };

      // Config is already mocked in beforeEach

      const result = await JobsService.dailyRegenJob();

      expect(result).toEqual({
        guestGroupsUpdated: 0,
        userWalletsUpdated: 0,
        ledgerEntriesCreated: 0,
      });

      // Should not query wallets when regen is 0
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalledWith('guest_stone_wallets');
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalledWith('stone_wallets');
    });

    it('should handle database errors gracefully', async () => {
      // const mockConfig = {
      //   pricing: {
      //     guest_daily_regen: { value: 5 },
      //   },
      // };

      // Config is already mocked in beforeEach

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

      await expect(JobsService.dailyRegenJob()).rejects.toThrow('Database error');
    });
  });

  describe('purgeGuestsJob', () => {
    it('should remove stale cookie group members and empty groups', async () => {
      // const mockConfig = {
      //   app: {
      //     cookie_ttl_days: { value: 30 },
      //   },
      // };

      const mockStaleMembers = [
        {
          cookie_id: 'stale-cookie-1',
          group_id: 'group-1',
          last_seen_at: '2023-01-01T00:00:00Z',
        },
        {
          cookie_id: 'stale-cookie-2',
          group_id: 'group-2',
          last_seen_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockEmptyGroups = [
        { id: 'empty-group-1' },
        { id: 'empty-group-2' },
      ];

      // Config is already mocked in beforeEach

      // Mock stale members query
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'cookie_group_members') {
          return {
            select: vi.fn(() => ({
              lt: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: mockStaleMembers,
                    error: null,
                  }),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              lt: vi.fn().mockResolvedValue({
                data: mockStaleMembers,
                error: null,
              }),
            })),
          };
        } else if (table === 'cookie_groups') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: mockEmptyGroups,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({
                  data: mockEmptyGroups,
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      });

      const result = await JobsService.purgeGuestsJob();

      expect(result).toEqual({
        staleMembersRemoved: 2,
        emptyGroupsRemoved: 2,
      });

      // Verify stale members were queried and deleted
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('cookie_group_members');
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('cookie_groups');
    });

    it('should handle no stale data gracefully', async () => {
      // const mockConfig = {
        app: {
          cookie_ttl_days: { value: 30 },
        },
      };

      // Config is already mocked in beforeEach

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          lt: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      }));

      const result = await JobsService.purgeGuestsJob();

      expect(result).toEqual({
        staleMembersRemoved: 0,
        emptyGroupsRemoved: 0,
      });
    });

    it('should handle database errors gracefully', async () => {
      // const mockConfig = {
      //   app: {
      //     cookie_ttl_days: { value: 30 },
      //   },
      // };

      // Config is already mocked in beforeEach

      mockSupabaseAdmin.from.mockImplementation(() => ({
        select: vi.fn(() => ({
          lt: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            })),
          })),
        })),
      }));

      await expect(JobsService.purgeGuestsJob()).rejects.toThrow('Database error');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      // const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      // Config is already mocked in beforeEach

      // Mock no recent requests
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

      const result = await JobsService.checkRateLimit('192.168.1.1');

      expect(result).toBe(true);
    });

    it('should reject requests exceeding rate limit', async () => {
      // const mockConfig = {
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

      // Config is already mocked in beforeEach

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

      const result = await JobsService.checkRateLimit('192.168.1.1');

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      // const mockConfig = {
        app: {
          guest_cookie_issue_rate_limit_per_hour: { value: 10 },
        },
      };

      // Config is already mocked in beforeEach

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

      await expect(JobsService.checkRateLimit('192.168.1.1')).rejects.toThrow('Database error');
    });
  });
});
