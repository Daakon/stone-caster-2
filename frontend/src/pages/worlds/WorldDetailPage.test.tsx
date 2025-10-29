import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import WorldDetailPage from './WorldDetailPage';

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// Mock the queries
vi.mock('@/lib/queries', () => ({
  useWorldQuery: vi.fn(),
  useStoriesQuery: vi.fn(),
  useNPCsQuery: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('WorldDetailPage', () => {
  const mockWorld = {
    id: 'world-1',
    slug: 'mystika',
    name: 'Mystika',
    description: 'A mystical world of magic and wonder',
    cover_url: 'https://example.com/cover.jpg',
  };

  const mockStories = [
    {
      id: 'story-1',
      slug: 'the-veil',
      title: 'The Veil',
      short_desc: 'A mysterious story',
      hero_url: 'https://example.com/hero.jpg',
      world: mockWorld,
      rulesets: [],
    },
  ];

  const mockNPCs = [
    {
      id: 'npc-1',
      name: 'Elena',
      short_desc: 'A wise mage',
      portrait_url: 'https://example.com/portrait.jpg',
      world_id: 'world-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders world details with tabs', async () => {
    const { useWorldQuery, useStoriesQuery, useNPCsQuery } = await import('@/lib/queries');
    
    vi.mocked(useWorldQuery).mockReturnValue({
      data: { data: mockWorld },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useStoriesQuery).mockReturnValue({
      data: { data: mockStories },
      isLoading: false,
    } as any);

    vi.mocked(useNPCsQuery).mockReturnValue({
      data: { data: mockNPCs },
      isLoading: false,
    } as any);

    render(<WorldDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Mystika')).toBeInTheDocument();
    expect(screen.getByText('A mystical world of magic and wonder')).toBeInTheDocument();
    expect(screen.getByText('Stories (1)')).toBeInTheDocument();
    expect(screen.getByText('NPCs (1)')).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const { useWorldQuery, useStoriesQuery, useNPCsQuery } = await import('@/lib/queries');
    
    vi.mocked(useWorldQuery).mockReturnValue({
      data: { data: mockWorld },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useStoriesQuery).mockReturnValue({
      data: { data: mockStories },
      isLoading: false,
    } as any);

    vi.mocked(useNPCsQuery).mockReturnValue({
      data: { data: mockNPCs },
      isLoading: false,
    } as any);

    render(<WorldDetailPage />, { wrapper: createWrapper() });

    // Should show stories by default
    expect(screen.getByText('Stories in Mystika')).toBeInTheDocument();

    // Click NPCs tab
    const npcsTab = screen.getByText('NPCs (1)');
    npcsTab.click();

    await waitFor(() => {
      expect(screen.getByText('NPCs in Mystika')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    const { useWorldQuery } = await import('@/lib/queries');
    
    vi.mocked(useWorldQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<WorldDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading Story...')).toBeInTheDocument();
  });

  it('shows error state when world not found', async () => {
    const { useWorldQuery } = await import('@/lib/queries');
    
    vi.mocked(useWorldQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    } as any);

    render(<WorldDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('World not found')).toBeInTheDocument();
    expect(screen.getByText('Browse Worlds')).toBeInTheDocument();
  });
});
