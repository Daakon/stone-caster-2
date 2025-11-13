/**
 * useSubmitForPublish Hook Tests
 * Phase 8: Test submit-for-publish hook behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitForPublish } from '../useSubmitForPublish';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useSubmitForPublish', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should call correct endpoint for world', async () => {
    (apiPost as any).mockResolvedValue({
      ok: true,
      data: { submitted: true, world: { id: 'world-1' } },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await result.current.submit('world-1');

    expect(apiPost).toHaveBeenCalledWith('/api/worlds/world-1/submit-for-publish', {});
    expect(toast.success).toHaveBeenCalledWith('Submitted for review.');
  });

  it('should call correct endpoint for story', async () => {
    (apiPost as any).mockResolvedValue({
      ok: true,
      data: { submitted: true, story: { id: 'story-1' } },
    });

    const { result } = renderHook(() => useSubmitForPublish('story'), { wrapper });

    await result.current.submit('story-1');

    expect(apiPost).toHaveBeenCalledWith('/api/stories/story-1/submit-for-publish', {});
    expect(toast.success).toHaveBeenCalledWith('Submitted for review.');
  });

  it('should call correct endpoint for npc', async () => {
    (apiPost as any).mockResolvedValue({
      ok: true,
      data: { submitted: true, npc: { id: 'npc-1' } },
    });

    const { result } = renderHook(() => useSubmitForPublish('npc'), { wrapper });

    await result.current.submit('npc-1');

    expect(apiPost).toHaveBeenCalledWith('/api/npcs/npc-1/submit-for-publish', {});
    expect(toast.success).toHaveBeenCalledWith('Submitted for review.');
  });

  it('should map QUOTA_EXCEEDED error to user-friendly message', async () => {
    (apiPost as any).mockResolvedValue({
      ok: false,
      error: {
        code: 'QUOTA_EXCEEDED',
        message: 'Quota exceeded',
        details: { type: 'world', limit: 1, current: 1 },
      },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await expect(result.current.submit('world-1')).rejects.toThrow();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("You've reached your limit for this type.");
    });
  });

  it('should map ALREADY_IN_REVIEW error to user-friendly message', async () => {
    (apiPost as any).mockResolvedValue({
      ok: false,
      error: {
        code: 'ALREADY_IN_REVIEW',
        message: 'Already in review',
      },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await expect(result.current.submit('world-1')).rejects.toThrow();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Already under review.');
    });
  });

  it('should map ALREADY_PUBLISHED error to user-friendly message', async () => {
    (apiPost as any).mockResolvedValue({
      ok: false,
      error: {
        code: 'ALREADY_PUBLISHED',
        message: 'Already published',
      },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await expect(result.current.submit('world-1')).rejects.toThrow();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Already published.');
    });
  });

  it('should map VALIDATION_FAILED with missing fields', async () => {
    (apiPost as any).mockResolvedValue({
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: {
          fieldsMissing: ['name', 'description'],
        },
      },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await expect(result.current.submit('world-1')).rejects.toThrow();
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Missing required fields: name, description');
    });
  });

  it('should invalidate query cache on success', async () => {
    (apiPost as any).mockResolvedValue({
      ok: true,
      data: { submitted: true, world: { id: 'world-1' } },
    });

    const { result } = renderHook(() => useSubmitForPublish('world'), { wrapper });

    await result.current.submit('world-1');

    // Verify query was invalidated (React Query will refetch)
    await waitFor(() => {
      expect(queryClient.getQueryState(['myWorlds'])?.isInvalidated).toBe(true);
    });
  });
});

