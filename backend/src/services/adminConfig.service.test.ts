import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminConfigService } from './adminConfig.service.js';

// Mock Supabase admin client
const mockSupabaseAdmin = {
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

describe('AdminConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllConfig', () => {
    it('should return all configuration tables', async () => {
      const mockConfigData = {
        app: [
          { key: 'cookie_ttl_days', value: { value: 60 }, type: 'number', updated_at: '2023-01-01T00:00:00Z' },
        ],
        pricing: [
          { key: 'turn_cost_default', value: { value: 2 }, updated_at: '2023-01-01T00:00:00Z' },
        ],
        ai: [
          { key: 'active_model', value: { value: 'gpt-4' }, updated_at: '2023-01-01T00:00:00Z' },
        ],
      };

      // Mock the database responses
      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: mockConfigData[table as keyof typeof mockConfigData] || [],
                error: null,
              }),
            })),
          })),
        };
        return mockQuery;
      });

      const result = await AdminConfigService.getAllConfig();

      expect(result).toEqual({
        app: [
          { key: 'cookie_ttl_days', value: { value: 60 }, type: 'number', updated_at: '2023-01-01T00:00:00Z' },
        ],
        pricing: [
          { key: 'turn_cost_default', value: { value: 2 }, updated_at: '2023-01-01T00:00:00Z' },
        ],
        ai: [
          { key: 'active_model', value: { value: 'gpt-4' }, updated_at: '2023-01-01T00:00:00Z' },
        ],
      });
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

      await expect(AdminConfigService.getAllConfig()).rejects.toThrow('Database error');
    });
  });

  describe('updateConfigValue', () => {
    it('should update app config value and increment version', async () => {
      const mockUpdatedConfig = {
        key: 'cookie_ttl_days',
        value: { value: 90 },
        type: 'number',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'app_config') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpdatedConfig,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        } else if (table === 'config_meta') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { version: 2 },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await AdminConfigService.updateConfigValue('app', 'cookie_ttl_days', { value: 90 });

      expect(result).toEqual(mockUpdatedConfig);
    });

    it('should update pricing config value', async () => {
      const mockUpdatedConfig = {
        key: 'turn_cost_default',
        value: { value: 3 },
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'pricing_config') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpdatedConfig,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        } else if (table === 'config_meta') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { version: 2 },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {};
      });

      const result = await AdminConfigService.updateConfigValue('pricing', 'turn_cost_default', { value: 3 });

      expect(result).toEqual(mockUpdatedConfig);
    });

    it('should throw CONFIG_NOT_FOUND for non-existent config key', async () => {
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
        AdminConfigService.updateConfigValue('app', 'non_existent_key', { value: 'test' })
      ).rejects.toThrow('Config key not found: non_existent_key');
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
        AdminConfigService.updateConfigValue('app', 'cookie_ttl_days', { value: 90 })
      ).rejects.toThrow('Database error');
    });
  });

  describe('validateConfigType', () => {
    it('should validate app config types correctly', () => {
      expect(() => AdminConfigService.validateConfigType('app', 'cookie_ttl_days', { value: 60 })).not.toThrow();
      expect(() => AdminConfigService.validateConfigType('app', 'idempotency_required', { value: true })).not.toThrow();
      expect(() => AdminConfigService.validateConfigType('app', 'drifter_enabled', { value: 'true' })).toThrow('Invalid type for app config key');
    });

    it('should allow any value for pricing and ai config', () => {
      expect(() => AdminConfigService.validateConfigType('pricing', 'turn_cost_default', { value: 2 })).not.toThrow();
      expect(() => AdminConfigService.validateConfigType('pricing', 'turn_cost_default', { value: 'invalid' })).not.toThrow();
      expect(() => AdminConfigService.validateConfigType('ai', 'active_model', { value: 'gpt-4' })).not.toThrow();
    });
  });
});
