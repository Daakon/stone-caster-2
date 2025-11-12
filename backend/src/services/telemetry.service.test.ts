import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryService } from './telemetry.service.js';
import { createSupabaseAdminMock } from '../test-utils/supabase-mock.js';
import { createConfigServiceMock } from '../test-utils/config-mock.js';

type SupabaseAdminMock = ReturnType<typeof createSupabaseAdminMock>['mockSupabaseAdmin'];
type ConfigServiceMock = ReturnType<typeof createConfigServiceMock>['mockConfigService'];

const mockSupabaseAdmin = (globalThis as any).mockSupabaseAdmin as SupabaseAdminMock;
const mockConfigService = (globalThis as any).mockConfigService as ConfigServiceMock;

const baseAppConfig = {
  cookieTtlDays: 30,
  idempotencyRequired: false,
  allowAsyncTurnFallback: true,
  telemetrySampleRate: 1,
  drifterEnabled: false,
};

const enabledTelemetry = [{ key: 'telemetry_enabled', enabled: true, payload: {} }];

const buildInsertChain = (singleResult: { data: any; error: any }) => {
  const single = vi.fn().mockResolvedValue(singleResult);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { builder: { insert }, insert, select, single };
};

describe('TelemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseAdmin.from.mockReset();
    mockConfigService.getFeatures.mockReset?.();
    mockConfigService.getApp.mockReset?.();

    mockConfigService.getFeatures.mockReturnValue(enabledTelemetry);
    mockConfigService.getApp.mockReturnValue({ ...baseAppConfig, telemetrySampleRate: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordEvent', () => {
    it('should record telemetry event when enabled and sampled', async () => {
      const { builder, insert, select, single } = buildInsertChain({
        data: {
          id: 'event-123',
          name: 'test_event',
          props: { test: 'data' },
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabaseAdmin.from.mockReturnValue(builder as any);

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('event-123');
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('telemetry_events');
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_event',
          props: { test: 'data' },
          trace_id: 'trace-123',
          user_id: 'user-123',
          cookie_id: undefined,
        })
      );
      expect(select).toHaveBeenCalledWith('id');
      expect(single).toHaveBeenCalled();
    });

    it('should not record event when telemetry is disabled', async () => {
      mockConfigService.getFeatures.mockReturnValue([{ key: 'telemetry_enabled', enabled: false }]);

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result).toEqual({ success: true, eventId: 'disabled' });
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should not record event when not sampled', async () => {
      mockConfigService.getApp.mockReturnValue({ ...baseAppConfig, telemetrySampleRate: 0 });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result).toEqual({ success: true, eventId: 'sampled_out' });
      expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const { builder, single } = buildInsertChain({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabaseAdmin.from.mockReturnValue(builder as any);

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(single).toHaveBeenCalled();
    });

    it('should handle config service errors gracefully', async () => {
      mockConfigService.getFeatures.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Config error');
    });

    it('should handle cookieId context', async () => {
      const { builder, insert } = buildInsertChain({
        data: {
          id: 'event-123',
          name: 'test_event',
          props: { test: 'data' },
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      });
      mockSupabaseAdmin.from.mockReturnValue(builder as any);

      const result = await TelemetryService.recordEvent({
        name: 'test_event',
        props: { test: 'data' },
        traceId: 'trace-123',
        cookieId: 'cookie-456',
      });

      expect(result.success).toBe(true);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_event',
          props: { test: 'data' },
          trace_id: 'trace-123',
          user_id: undefined,
          cookie_id: 'cookie-456',
        })
      );
    });
  });

  describe('sampling', () => {
    it('should respect different sample rates', async () => {
      mockConfigService.getApp.mockReturnValue({ ...baseAppConfig, telemetrySampleRate: 0.5 });

      const { builder } = buildInsertChain({
        data: { id: 'event-123', name: 'test_event' },
        error: null,
      });
      mockSupabaseAdmin.from.mockReturnValue(builder as any);

      const randomSpy = vi.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.6); // sampled out
      randomSpy.mockReturnValueOnce(0.4); // recorded

      const skipped = await TelemetryService.recordEvent({
        name: 'test_event',
        props: {},
        traceId: 'trace-1',
      });

      const recorded = await TelemetryService.recordEvent({
        name: 'test_event',
        props: {},
        traceId: 'trace-2',
      });

      expect(skipped).toEqual({ success: true, eventId: 'sampled_out' });
      expect(recorded.success).toBe(true);
      expect(recorded.eventId).toBe('event-123');
    });
  });
});
