import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoriesPage from './StoriesPage';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/stories']}>
        <StoriesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StoriesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('offers a direct link to create a story', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /create your own story/i })).toHaveAttribute(
        'href',
        '/stories/compose'
      );
    });
  });
});
