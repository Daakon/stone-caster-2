/**
 * usePendingMedia Hook Tests
 * Phase 3c: Unit tests for pending media hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePendingMedia } from '@/hooks/usePendingMedia';
import { listPendingMedia } from '@/services/admin.media';

// Mock the service
vi.mock('@/services/admin.media', () => ({
  listPendingMedia: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePendingMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch pending media with default params', async () => {
    const mockItems = [
      {
        id: 'media-1',
        owner_user_id: 'user-123',
        kind: 'world',
        provider: 'cloudflare_images',
        provider_key: 'cf-123',
        visibility: 'private',
        status: 'ready',
        image_review_status: 'pending',
        width: 1920,
        height: 1080,
        sha256: null,
        created_at: new Date().toISOString(),
        ready_at: new Date().toISOString(),
      },
    ];

    (listPendingMedia as any).mockResolvedValueOnce({
      ok: true,
      data: {
        items: mockItems,
        nextCursor: 'cursor-123',
      },
    });

    const { result } = renderHook(() => usePendingMedia(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(mockItems);
    expect(result.current.nextCursor).toBe('cursor-123');
    expect(listPendingMedia).toHaveBeenCalledWith({
      limit: 25,
      cursor: undefined,
      kind: undefined,
      owner: undefined,
    });
  });

  it('should pass filters to service', async () => {
    (listPendingMedia as any).mockResolvedValueOnce({
      ok: true,
      data: { items: [], nextCursor: undefined },
    });

    const { result } = renderHook(
      () => usePendingMedia({ kind: 'world', owner: 'user-123', limit: 50 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(listPendingMedia).toHaveBeenCalledWith({
      limit: 50,
      cursor: undefined,
      kind: 'world',
      owner: 'user-123',
    });
  });

  it('should handle cursor pagination', async () => {
    (listPendingMedia as any).mockResolvedValueOnce({
      ok: true,
      data: {
        items: [],
        nextCursor: 'cursor-next',
      },
    });

    const { result } = renderHook(
      () => usePendingMedia({ cursor: 'cursor-123' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(listPendingMedia).toHaveBeenCalledWith({
      limit: 25,
      cursor: 'cursor-123',
      kind: undefined,
      owner: undefined,
    });
    expect(result.current.nextCursor).toBe('cursor-next');
  });

  it('should handle errors', async () => {
    (listPendingMedia as any).mockResolvedValueOnce({
      ok: false,
      error: { message: 'Failed to fetch' },
    });

    const { result } = renderHook(() => usePendingMedia(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('Failed to fetch');
    expect(result.current.items).toEqual([]);
  });

  it('should respect enabled flag', () => {
    const { result } = renderHook(
      () => usePendingMedia({ enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.loading).toBe(false);
    expect(listPendingMedia).not.toHaveBeenCalled();
  });
});


