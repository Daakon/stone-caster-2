import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { telemetryService } from './telemetry';
import { apiPost } from '../lib/api';

// Mock the API module
vi.mock('../lib/api', () => ({
  apiPost: vi.fn(),
}));

const mockApiPost = vi.mocked(apiPost);

describe('TelemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the service state
    (telemetryService as any).config = null;
    (telemetryService as any).configLoaded = false;
    (telemetryService as any).eventQueue = [];
    (telemetryService as any).isProcessing = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should load telemetry configuration successfully', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();

      expect(mockApiPost).toHaveBeenCalledWith('/api/telemetry/config');
      expect(telemetryService.getConfig()).toEqual(mockConfig);
    });

    it('should handle config loading failure gracefully', async () => {
      mockApiPost.mockResolvedValueOnce({
        ok: false,
        error: { code: 'INTERNAL_ERROR', http: 500, message: 'Config failed' },
      });

      await telemetryService.initialize();

      expect(telemetryService.getConfig()).toEqual({
        enabled: false,
        sampleRate: 0,
        features: {},
        environment: 'development',
      });
    });

    it('should not reload config if already loaded', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      await telemetryService.initialize(); // Second call

      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldRecord', () => {
    it('should return false when telemetry is disabled', async () => {
      const mockConfig = {
        enabled: false,
        sampleRate: 1.0,
        features: { telemetry_enabled: false },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      expect((telemetryService as any).shouldRecord()).toBe(false);
    });

    it('should return false when sample rate is 0', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      expect((telemetryService as any).shouldRecord()).toBe(false);
    });

    it('should apply sampling correctly', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 0.5,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();

      // Mock Math.random to return 0.3 (should be recorded)
      vi.spyOn(Math, 'random').mockReturnValue(0.3);
      expect((telemetryService as any).shouldRecord()).toBe(true);

      // Mock Math.random to return 0.7 (should not be recorded)
      vi.spyOn(Math, 'random').mockReturnValue(0.7);
      expect((telemetryService as any).shouldRecord()).toBe(false);
    });
  });

  describe('recordEvent', () => {
    it('should queue events when telemetry is enabled', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { ok: true },
        });

      const event = {
        name: 'turn_started' as const,
        props: { gameId: 'test-game-id' },
      };

      await telemetryService.recordEvent(event);

      expect((telemetryService as any).eventQueue).toContain(event);
    });

    it('should not queue events when telemetry is disabled', async () => {
      const mockConfig = {
        enabled: false,
        sampleRate: 1.0,
        features: { telemetry_enabled: false },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      const event = {
        name: 'turn_started' as const,
        props: { gameId: 'test-game-id' },
      };

      await telemetryService.recordEvent(event);

      expect((telemetryService as any).eventQueue).toHaveLength(0);
    });

    it('should handle API failures gracefully', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockRejectedValueOnce(new Error('API Error'));

      const event = {
        name: 'turn_started' as const,
        props: { gameId: 'test-game-id' },
      };

      // Should not throw
      await expect(telemetryService.recordEvent(event)).resolves.not.toThrow();
    });
  });

  describe('trackTurnStarted', () => {
    it('should record turn started event with correct props', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { ok: true },
        });

      await telemetryService.trackTurnStarted(
        'game-123',
        'char-456',
        'world-789',
        5
      );

      expect((telemetryService as any).eventQueue).toContainEqual({
        name: 'turn_started',
        props: {
          gameId: 'game-123',
          characterId: 'char-456',
          worldId: 'world-789',
          turnNumber: 5,
        },
      });
    });
  });

  describe('trackTurnCompleted', () => {
    it('should record turn completed event with duration', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { ok: true },
        });

      await telemetryService.trackTurnCompleted(
        'game-123',
        'char-456',
        'world-789',
        5,
        1500
      );

      expect((telemetryService as any).eventQueue).toContainEqual({
        name: 'turn_completed',
        props: {
          gameId: 'game-123',
          characterId: 'char-456',
          worldId: 'world-789',
          turnNumber: 5,
          duration: 1500,
        },
      });
    });
  });

  describe('trackTurnFailed', () => {
    it('should record turn failed event with error details', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { ok: true },
        });

      await telemetryService.trackTurnFailed(
        'game-123',
        'char-456',
        'world-789',
        5,
        'INSUFFICIENT_STONES',
        'Not enough stones to complete this action'
      );

      expect((telemetryService as any).eventQueue).toContainEqual({
        name: 'turn_failed',
        props: {
          gameId: 'game-123',
          characterId: 'char-456',
          worldId: 'world-789',
          turnNumber: 5,
          errorCode: 'INSUFFICIENT_STONES',
          errorMessage: 'Not enough stones to complete this action',
        },
      });
    });
  });

  describe('trackErrorShown', () => {
    it('should record error shown event', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 1.0,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          data: mockConfig,
        })
        .mockResolvedValueOnce({
          ok: true,
          data: { ok: true },
        });

      await telemetryService.trackErrorShown(
        'VALIDATION_FAILED',
        'Invalid input provided'
      );

      expect((telemetryService as any).eventQueue).toContainEqual({
        name: 'error_shown',
        props: {
          errorCode: 'VALIDATION_FAILED',
          errorMessage: 'Invalid input provided',
        },
      });
    });
  });

  describe('getConfig', () => {
    it('should return null when config not loaded', () => {
      expect(telemetryService.getConfig()).toBeNull();
    });

    it('should return config when loaded', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 0.8,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      expect(telemetryService.getConfig()).toEqual(mockConfig);
    });
  });

  describe('isEnabled', () => {
    it('should return false when config not loaded', () => {
      expect(telemetryService.isEnabled()).toBe(false);
    });

    it('should return config enabled status', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 0.8,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      expect(telemetryService.isEnabled()).toBe(true);
    });
  });

  describe('getSampleRate', () => {
    it('should return 0 when config not loaded', () => {
      expect(telemetryService.getSampleRate()).toBe(0);
    });

    it('should return config sample rate', async () => {
      const mockConfig = {
        enabled: true,
        sampleRate: 0.8,
        features: { telemetry_enabled: true },
        environment: 'test',
      };

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        data: mockConfig,
      });

      await telemetryService.initialize();
      expect(telemetryService.getSampleRate()).toBe(0.8);
    });
  });
});
