import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { usePrefetch } from './usePrefetch';

// Mock the API functions
vi.mock('@/lib/api', () => ({
  getWorld: vi.fn(),
  getNPC: vi.fn(),
  getRuleset: vi.fn(),
  getStory: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePrefetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides prefetch functions', () => {
    const { result } = renderHook(() => usePrefetch(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.prefetchWorld).toBe('function');
    expect(typeof result.current.prefetchNPC).toBe('function');
    expect(typeof result.current.prefetchRuleset).toBe('function');
    expect(typeof result.current.prefetchStory).toBe('function');
  });

  it('prefetches world data', async () => {
    const { getWorld } = await import('@/lib/api');
    vi.mocked(getWorld).mockResolvedValue({ data: { id: 'world-1', name: 'Test World' } });

    const { result } = renderHook(() => usePrefetch(), {
      wrapper: createWrapper(),
    });

    result.current.prefetchWorld('world-1');

    // Wait for the prefetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(getWorld).toHaveBeenCalledWith('world-1');
  });

  it('prefetches NPC data', async () => {
    const { getNPC } = await import('@/lib/api');
    vi.mocked(getNPC).mockResolvedValue({ data: { id: 'npc-1', name: 'Test NPC' } });

    const { result } = renderHook(() => usePrefetch(), {
      wrapper: createWrapper(),
    });

    result.current.prefetchNPC('npc-1');

    // Wait for the prefetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(getNPC).toHaveBeenCalledWith('npc-1');
  });

  it('prefetches ruleset data', async () => {
    const { getRuleset } = await import('@/lib/api');
    vi.mocked(getRuleset).mockResolvedValue({ data: { id: 'ruleset-1', name: 'Test Ruleset' } });

    const { result } = renderHook(() => usePrefetch(), {
      wrapper: createWrapper(),
    });

    result.current.prefetchRuleset('ruleset-1');

    // Wait for the prefetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(getRuleset).toHaveBeenCalledWith('ruleset-1');
  });

  it('prefetches story data', async () => {
    const { getStory } = await import('@/lib/api');
    vi.mocked(getStory).mockResolvedValue({ data: { id: 'story-1', title: 'Test Story' } });

    const { result } = renderHook(() => usePrefetch(), {
      wrapper: createWrapper(),
    });

    result.current.prefetchStory('story-1');

    // Wait for the prefetch to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(getStory).toHaveBeenCalledWith('story-1');
  });
});
