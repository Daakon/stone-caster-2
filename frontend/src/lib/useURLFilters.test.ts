import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useURLFilters } from './useURLFilters';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = {
  pathname: '/stories',
  search: ''
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  };
});

// Helper to render hook with router
const renderHookWithRouter = (defaults: any, options?: any) => {
  return renderHook(() => useURLFilters(defaults, options), {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>
  });
};

describe('useURLFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
  });

  describe('initialization', () => {
    it('should initialize with default values when no URL params', () => {
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      expect(result.current.filters).toEqual(defaults);
    });

    it('should merge URL params with defaults', () => {
      mockLocation.search = '?q=test&world=w1&tags=romance&tags=mystery';
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      expect(result.current.filters).toEqual({
        q: 'test',
        world: 'w1',
        tags: ['romance', 'mystery']
      });
    });

    it('should handle single values correctly', () => {
      mockLocation.search = '?q=test&world=w1';
      const defaults = { q: '', world: undefined };
      const { result } = renderHookWithRouter(defaults);
      
      expect(result.current.filters).toEqual({
        q: 'test',
        world: 'w1'
      });
    });
  });

  describe('filter updates', () => {
    it('should update filters immediately for non-search changes', () => {
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      act(() => {
        result.current.updateFilters({ world: 'w1' });
      });
      
      expect(result.current.filters.world).toBe('w1');
      expect(mockNavigate).toHaveBeenCalledWith('/stories?world=w1', { replace: true });
    });

    it('should debounce search query updates', async () => {
      vi.useFakeTimers();
      const defaults = { q: '', world: undefined };
      const { result } = renderHookWithRouter(defaults, { debounceMs: 300 });
      
      act(() => {
        result.current.updateFilters({ q: 'test' });
      });
      
      // Should update state immediately
      expect(result.current.filters.q).toBe('test');
      
      // Should not navigate yet
      expect(mockNavigate).not.toHaveBeenCalled();
      
      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      // Should navigate now
      expect(mockNavigate).toHaveBeenCalledWith('/stories?q=test', { replace: true });
      
      vi.useRealTimers();
    });

    it('should handle multiple rapid search updates with debouncing', async () => {
      vi.useFakeTimers();
      const defaults = { q: '', world: undefined };
      const { result } = renderHookWithRouter(defaults, { debounceMs: 300 });
      
      act(() => {
        result.current.updateFilters({ q: 't' });
      });
      
      act(() => {
        result.current.updateFilters({ q: 'te' });
      });
      
      act(() => {
        result.current.updateFilters({ q: 'test' });
      });
      
      // Should only navigate once after debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });
      
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/stories?q=test', { replace: true });
      
      vi.useRealTimers();
    });
  });

  describe('array handling', () => {
    it('should sort and deduplicate arrays', () => {
      const defaults = { tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      act(() => {
        result.current.updateFilters({ tags: ['mystery', 'romance', 'mystery', 'adventure'] });
      });
      
      expect(result.current.filters.tags).toEqual(['adventure', 'mystery', 'romance']);
    });

    it('should handle empty arrays', () => {
      const defaults = { tags: ['existing'] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      act(() => {
        result.current.updateFilters({ tags: [] });
      });
      
      expect(result.current.filters.tags).toEqual([]);
      expect(mockNavigate).toHaveBeenCalledWith('/stories', { replace: true });
    });

    it('should filter out empty strings from arrays', () => {
      const defaults = { tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      act(() => {
        result.current.updateFilters({ tags: ['romance', '', 'mystery', '   '] });
      });
      
      expect(result.current.filters.tags).toEqual(['mystery', 'romance']);
    });
  });

  describe('reset functionality', () => {
    it('should reset filters to defaults', () => {
      mockLocation.search = '?q=test&world=w1&tags=romance';
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.filters).toEqual(defaults);
      expect(mockNavigate).toHaveBeenCalledWith('/stories', { replace: true });
    });
  });

  describe('URL parsing edge cases', () => {
    it('should handle malformed URL params gracefully', () => {
      mockLocation.search = '?q=test&world=&tags=romance&invalid';
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      expect(result.current.filters).toEqual({
        q: 'test',
        world: '',
        tags: ['romance']
      });
    });

    it('should handle URL with no search params', () => {
      mockLocation.search = '';
      const defaults = { q: '', world: undefined };
      const { result } = renderHookWithRouter(defaults);
      
      expect(result.current.filters).toEqual(defaults);
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain consistency between set and read operations', () => {
      const defaults = { q: '', world: undefined, tags: [] as string[] };
      const { result } = renderHookWithRouter(defaults);
      
      const testFilters = {
        q: 'test query',
        world: 'world-1',
        tags: ['romance', 'mystery', 'adventure']
      };
      
      act(() => {
        result.current.updateFilters(testFilters);
      });
      
      expect(result.current.filters).toEqual(testFilters);
    });
  });
});
