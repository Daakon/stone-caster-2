import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StartStoryPage from './StartStoryPage';
import * as analytics from '@/lib/analytics';
import * as queries from '@/lib/queries';

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  trackStartStoryView: vi.fn(),
  trackStartStoryAuthChoice: vi.fn(),
  trackCharacterSelect: vi.fn(),
  trackCharacterCreate: vi.fn(),
  trackSessionCreated: vi.fn(),
  trackStartStoryError: vi.fn(),
}));

// Mock the queries module
vi.mock('@/lib/queries', () => ({
  useStoryQuery: vi.fn(),
  useCharactersQuery: vi.fn(),
  useCreateCharacter: vi.fn(),
  useCreateSession: vi.fn(),
  useCreateGuestToken: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('?story=1')],
    useNavigate: () => mockNavigate,
  };
});

const mockStory = {
  id: '1',
  title: 'Test Story',
  slug: 'test-story',
  short_desc: 'A test story description',
  hero_url: 'https://example.com/hero.jpg',
  world_id: 'world-1',
  kind: 'adventure' as const,
  ruleset_ids: ['ruleset-1'],
  tags: ['fantasy', 'action'],
  updated_at: '2023-01-01T00:00:00Z',
};

const mockCharacters = [
  {
    id: 'char-1',
    name: 'Test Character',
    portrait_seed: 'seed1',
    portrait_url: 'https://example.com/portrait1.jpg',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('StartStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for all queries to prevent undefined errors
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });
    (queries.useCreateGuestToken as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
    });
    (queries.useCreateCharacter as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: mockCharacters[0] }),
      isPending: false,
    });
    (queries.useCreateSession as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: { id: 'session-1' } }),
      isPending: false,
    });
  });

  it('renders loading state initially', () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StartStoryPage />);
    expect(screen.getByText('Loading story...')).toBeInTheDocument();
  });

  it('renders error state when story not found', () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Story not found'),
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StartStoryPage />);
    expect(screen.getByText('Story Not Found')).toBeInTheDocument();
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
  });

  it('renders intro step with story details', () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StartStoryPage />);
    
    expect(screen.getByText('Test Story')).toBeInTheDocument();
    expect(screen.getByText('A test story description')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('tracks analytics on view', () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StartStoryPage />);
    
    expect(analytics.trackStartStoryView).toHaveBeenCalledWith('1');
  });

  it('shows auth gate when continue is clicked', () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<StartStoryPage />);
    
    fireEvent.click(screen.getByText('Continue'));
    
    expect(screen.getByText('Choose How to Play')).toBeInTheDocument();
    expect(screen.getByText('Continue as Guest')).toBeInTheDocument();
  });

  it('shows character picker after guest selection', async () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: mockCharacters },
      isLoading: false,
      error: null,
    });
    (queries.useCreateGuestToken as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
    });
    (queries.useCreateCharacter as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: mockCharacters[0] }),
      isPending: false,
    });
    (queries.useCreateSession as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: { id: 'session-1' } }),
      isPending: false,
    });

    renderWithProviders(<StartStoryPage />);
    
    // Go through auth gate
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue as Guest'));
    
    await waitFor(() => {
      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
    });
    expect(screen.getByText('Test Character')).toBeInTheDocument();
    expect(screen.getByText('Create New Character')).toBeInTheDocument();
  });

  it('shows confirmation step after character selection', async () => {
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: mockCharacters },
      isLoading: false,
      error: null,
    });
    (queries.useCreateGuestToken as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
    });
    (queries.useCreateCharacter as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: mockCharacters[0] }),
      isPending: false,
    });
    (queries.useCreateSession as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: { id: 'session-1' } }),
      isPending: false,
    });

    renderWithProviders(<StartStoryPage />);
    
    // Go through auth gate
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue as Guest'));
    
    await waitFor(() => {
      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
    });
    
    // Select character
    fireEvent.click(screen.getByText('Test Character'));
    
    expect(screen.getByText('Ready to Begin')).toBeInTheDocument();
    expect(screen.getByText('Begin Story')).toBeInTheDocument();
  });

  it('handles session creation and redirects', async () => {
    const mockCreateSession = vi.fn().mockResolvedValue({ id: 'session-1' });

    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: mockCharacters },
      isLoading: false,
      error: null,
    });
    (queries.useCreateGuestToken as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
    });
    (queries.useCreateCharacter as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: mockCharacters[0] }),
      isPending: false,
    });
    (queries.useCreateSession as any).mockReturnValue({
      mutate: mockCreateSession,
      mutateAsync: mockCreateSession,
      isPending: false,
    });

    renderWithProviders(<StartStoryPage />);
    
    // Go through the flow
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue as Guest'));
    
    await waitFor(() => {
      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Test Character'));
    fireEvent.click(screen.getByText('Begin Story'));
    
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        story_id: '1',
        character_id: 'char-1',
      });
    });
  });

  it('handles session creation error with retry', async () => {
    const mockCreateSession = vi.fn().mockRejectedValue(new Error('Session creation failed'));
    
    (queries.useStoryQuery as any).mockReturnValue({
      data: { data: mockStory },
      isLoading: false,
      error: null,
    });
    (queries.useCharactersQuery as any).mockReturnValue({
      data: { data: mockCharacters },
      isLoading: false,
      error: null,
    });
    (queries.useCreateGuestToken as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
    });
    (queries.useCreateCharacter as any).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, data: mockCharacters[0] }),
      isPending: false,
    });
    (queries.useCreateSession as any).mockReturnValue({
      mutate: mockCreateSession,
      mutateAsync: mockCreateSession,
      isPending: false,
    });

    renderWithProviders(<StartStoryPage />);
    
    // Go through the flow
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue as Guest'));
    
    await waitFor(() => {
      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Test Character'));
    fireEvent.click(screen.getByText('Begin Story'));
    
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to start story. Please try again.')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
    
    expect(analytics.trackStartStoryError).toHaveBeenCalledWith('session_creation', 'Session creation failed');
  });
});
