import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyAdventuresPage from './MyAdventuresPage';
import { getMyAdventures } from '@/lib/api';
import type { GameListDTO } from '@shared';
import type { AppError } from '@/lib/errors';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getMyAdventures: vi.fn(),
  };
});

const mockedGetMyAdventures = vi.mocked(getMyAdventures);

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
      <MemoryRouter>
        <MyAdventuresPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MyAdventuresPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows empty state when no adventures are available', async () => {
    mockedGetMyAdventures.mockResolvedValue({ ok: true, data: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('my-adventures-empty')).toBeInTheDocument();
    });
  });

  it('surfaces sign-in prompt when adventures cannot be loaded without auth', async () => {
    const error: AppError = {
      code: 'UNAUTHORIZED',
      http: 401,
      message: 'Authentication required',
    };
    mockedGetMyAdventures.mockResolvedValue({ ok: false, error });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('my-adventures-unauthorized')).toBeInTheDocument();
    });
  });

  it('lists active adventures with continue actions', async () => {
    const adventures: GameListDTO[] = [
      {
        id: 'game-1',
        adventureTitle: 'The Mystika Tutorial',
        characterName: 'Thorne Shifter',
        worldName: 'Mystika',
        turnCount: 3,
        status: 'active',
        lastPlayedAt: new Date().toISOString(),
      },
    ];
    mockedGetMyAdventures.mockResolvedValue({ ok: true, data: adventures });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('my-adventures-list')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /continue the mystika tutorial/i })).toBeInTheDocument();
  });
});

