import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { track, trackCatalogView, trackCatalogCardClick, trackFilterChange, trackFunnelStage, startSessionHeartbeat, stopSessionHeartbeat } from './analytics';
import * as analytics from './analytics';

// Mock console.log to avoid noise in tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	stopSessionHeartbeat();
	vi.useRealTimers();
});

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('track', () => {
    it('should call console.log with event and properties', () => {
      track('test_event', { key: 'value' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Analytics]',
        'test_event',
        expect.objectContaining({
          key: 'value',
          timestamp: expect.any(Number),
          url: expect.any(String),
          userAgent: expect.any(String)
        })
      );
    });

    it('should handle events without properties', () => {
      track('simple_event');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Analytics]',
        'simple_event',
        expect.objectContaining({
          timestamp: expect.any(Number),
          url: expect.any(String),
          userAgent: expect.any(String)
        })
      );
    });

    it('should handle errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock a scenario that would cause an error
      const originalConsole = console.log;
      console.log = vi.fn().mockImplementation(() => {
        throw new Error('Analytics error');
      });
      
      track('error_event');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Analytics] Failed to track event:',
        'error_event',
        expect.any(Error)
      );
      
      // Restore console.log
      console.log = originalConsole;
      consoleErrorSpy.mockRestore();
    });
  });

  describe('trackCatalogView', () => {
    it('should track catalog view with correct entity', () => {
      trackCatalogView('stories');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Analytics]',
        'catalog_view',
        expect.objectContaining({
          entity: 'stories',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should work with all entity types', () => {
      const entities = ['stories', 'worlds', 'npcs', 'rulesets'] as const;
      
      entities.forEach(entity => {
        trackCatalogView(entity);
        
        expect(mockConsoleLog).toHaveBeenCalledWith(
          '[Analytics]',
          'catalog_view',
          expect.objectContaining({
            entity,
            timestamp: expect.any(Number)
          })
        );
      });
    });
  });

  describe('trackCatalogCardClick', () => {
    it('should track card click with entity and id', () => {
      trackCatalogCardClick('stories', 'story-123');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Analytics]',
        'catalog_card_click',
        expect.objectContaining({
          entity: 'stories',
          id_or_slug: 'story-123',
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('trackFilterChange', () => {
    it('should track filter changes with entity and filters', () => {
      const filters = { q: 'test', world: 'world-1', tags: ['romance'] };
      trackFilterChange('stories', filters);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Analytics]',
        'filter_change',
        expect.objectContaining({
          entity: 'stories',
          filters,
          timestamp: expect.any(Number)
        })
      );
    });
  });

	it('emits funnel_stage payload', () => {
		const spy = vi.spyOn(analytics as any, 'track').mockImplementation(() => {});
		trackFunnelStage({ stage: 'view', ms_since_prev: 0, session_id: 's1' } as any);
		expect(spy).toHaveBeenCalledWith('funnel_stage', expect.objectContaining({ stage: 'view', ms_since_prev: 0, session_id: 's1' }));
		spy.mockRestore();
	});

	it('heartbeat sends while visible and pauses when hidden', () => {
		const spy = vi.spyOn(analytics as any, 'track').mockImplementation(() => {});
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		startSessionHeartbeat('s1');
		vi.advanceTimersByTime(30_000);
		expect(spy).toHaveBeenCalledWith('session_heartbeat', expect.any(Object));
		spy.mockClear();
		Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
		vi.advanceTimersByTime(30_000);
		expect(spy).not.toHaveBeenCalled();
	});
});
