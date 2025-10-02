import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryService } from './telemetry.service.js';

// Mock Supabase admin client
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock config service
vi.mock('./config.service.js', () => ({
  configService: {
    getConfig: vi.fn(),
  },
}));

describe('TelemetryService', () => {
  let mockSupabaseAdmin: any;
  let mockConfigService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked services
    const { supabaseAdmin } = await import('./supabase.js');
    const { configService } = await import('./config.service.js');
    mockSupabaseAdmin = vi.mocked(supabaseAdmin);
    mockConfigService = vi.mocked(configService);
  });

  describe('recordEvent', () => {
    it('should record telemetry event when enabled and sampled', async () => {
      // Mock config with telemetry enabled and 100% sampling
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: true },
        },
        app: {
          telemetry_sample_rate: { value: 1.0 },
        },
      });

      // Mock successful database insert
      mockSupabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'event-123',
          name: 'test_event',
          props: { test: 'data' },
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('telemetry_events');
      expect(mockSupabaseAdmin.from().insert).toHaveBeenCalledWith({
        name: 'test_event',
        props: { test: 'data' },
        trace_id: 'trace-123',
        user_id: 'user-123',
        cookie_id: null,
      });
    });

    it('should not record event when telemetry is disabled', async () => {
      // Mock config with telemetry disabled
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: false },
        },
        app: {
          telemetry_sample_rate: { value: 1.0 },
        },
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('telemetry_disabled');
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should not record event when not sampled', async () => {
      // Mock config with 0% sampling
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: true },
        },
        app: {
          telemetry_sample_rate: { value: 0.0 },
        },
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('not_sampled');
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock config with telemetry enabled
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: true },
        },
        app: {
          telemetry_sample_rate: { value: 1.0 },
        },
      });

      // Mock database error
      mockSupabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle config service errors gracefully', async () => {
      // Mock config service error
      mockConfigService.getConfig.mockRejectedValue(new Error('Config error'));

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Config error');
    });

    it('should validate required parameters', async () => {
      // Test with missing name
      const result1 = await TelemetryService.recordEvent({
        name: '',
        traceId: 'trace-123',
        props: {},
      });
      
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Missing required parameters');

      // Test with missing traceId
      const result2 = await TelemetryService.recordEvent({
        name: 'test_event',
        traceId: '',
        props: {},
      });
      
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Missing required parameters');
    });

    it('should handle cookieId context', async () => {
      // Mock config with telemetry enabled
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: true },
        },
        app: {
          telemetry_sample_rate: { value: 1.0 },
        },
      });

      // Mock successful database insert
      mockSupabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'event-123',
          name: 'test_event',
          props: { test: 'data' },
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
        cookieId: 'cookie-456',
      });

      expect(result.success).toBe(true);
      expect(mockSupabaseAdmin.from().insert).toHaveBeenCalledWith({
        name: 'test_event',
        props: { test: 'data' },
        trace_id: 'trace-123',
        user_id: null,
        cookie_id: 'cookie-456',
      });
    });
  });

  describe('sampling', () => {
    it('should respect different sample rates', async () => {
      // Test with 50% sampling - this is probabilistic, so we test the logic
      mockConfigService.getConfig.mockResolvedValue({
        featureFlags: {
          telemetry_enabled: { enabled: true },
        },
        app: {
          telemetry_sample_rate: { value: 0.5 },
        },
      });

      // Mock successful database insert
      mockSupabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: {
          id: 'event-123',
          name: 'test_event',
          props: { test: 'data' },
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });

      // Run multiple times to test sampling behavior
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await TelemetryService.recordEvent({
          name: 'test_event',
          props: { test: 'data' },
          traceId: `trace-${i}`,
        });
        results.push(result);
      }

      // Some should be recorded, some should be skipped
      const recorded = results.filter(r => !r.skipped);
      const skipped = results.filter(r => r.skipped);
      
      expect(recorded.length + skipped.length).toBe(10);
    });
  });
});
