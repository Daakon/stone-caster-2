import { describe, it, expect, vi, beforeEach } from 'vitest';
import { track, trackCatalogView, trackCatalogCardClick, trackFilterChange } from './analytics';

// Mock console.log to avoid noise in tests
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

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
});
