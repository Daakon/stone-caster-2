/**
 * My Stories Page Tests
 * Phase 8: Test My Stories page rendering and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import MyStoriesPage from '../stories';
import { apiGet, apiPost } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('@/hooks/useSubmitForPublish', () => ({
  useSubmitForPublish: () => ({
    submit: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

describe('MyStoriesPage', () => {
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

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MyStoriesPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should render quota info', async () => {
    (apiGet as any).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        total: 0,
        quotas: {
          limit: 3,
          used: 1,
          remaining: 2,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Stories: 1 \/ 3/)).toBeInTheDocument();
      expect(screen.getByText(/2 slot.*remaining/)).toBeInTheDocument();
    });
  });

  it('should disable Create button when quota is reached', async () => {
    (apiGet as any).mockResolvedValue({
      ok: true,
      data: {
        items: [],
        total: 0,
        quotas: {
          limit: 3,
          used: 3,
          remaining: 0,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /Create Story/i });
      expect(createButton).toBeDisabled();
    });
  });

  it('should render stories with status chips', async () => {
    (apiGet as any).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: 'story-1',
            title: 'Test Story',
            description: 'Test description',
            publish_status: 'draft',
            updated_at: new Date().toISOString(),
          },
          {
            id: 'story-2',
            title: 'Published Story',
            publish_status: 'published',
            updated_at: new Date().toISOString(),
          },
        ],
        total: 2,
        quotas: {
          limit: 3,
          used: 2,
          remaining: 1,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Story')).toBeInTheDocument();
      expect(screen.getByText('Published Story')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Published')).toBeInTheDocument();
    });
  });

  it('should show Edit button for draft stories', async () => {
    (apiGet as any).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: 'story-1',
            title: 'Draft Story',
            publish_status: 'draft',
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
        quotas: {
          limit: 3,
          used: 1,
          remaining: 2,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit for Publish/i })).toBeInTheDocument();
    });
  });

  it('should hide Edit button for in_review stories', async () => {
    (apiGet as any).mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: 'story-1',
            title: 'In Review Story',
            publish_status: 'in_review',
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
        quotas: {
          limit: 3,
          used: 1,
          remaining: 2,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
      expect(screen.getByText('Under review')).toBeInTheDocument();
    });
  });
});

