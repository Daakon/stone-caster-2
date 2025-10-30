import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import RulesetDetailPage from './RulesetDetailPage';

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// Mock the queries
vi.mock('@/lib/queries', () => ({
  useRulesetQuery: vi.fn(),
  useStoriesQuery: vi.fn(),
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

describe('RulesetDetailPage', () => {
  const mockRuleset = {
    id: 'ruleset-1',
    name: 'Magic System',
    description: 'A comprehensive magic system for fantasy stories',
  };

  const mockStories = [
    {
      id: 'story-1',
      slug: 'the-veil',
      title: 'The Veil',
      short_desc: 'A mysterious story',
      hero_url: 'https://example.com/hero.jpg',
      world: {
        id: 'world-1',
        name: 'Mystika',
      },
      rulesets: [mockRuleset],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ruleset details with stories', async () => {
    const { useRulesetQuery, useStoriesQuery } = await import('@/lib/queries');
    
    vi.mocked(useRulesetQuery).mockReturnValue({
      data: { data: mockRuleset },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useStoriesQuery).mockReturnValue({
      data: { data: mockStories },
      isLoading: false,
    } as any);

    render(<RulesetDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Magic System')).toBeInTheDocument();
    expect(screen.getByText('A comprehensive magic system for fantasy stories')).toBeInTheDocument();
    expect(screen.getByText('Stories Using This Ruleset')).toBeInTheDocument();
    expect(screen.getByText('1 Stories')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    const { useRulesetQuery } = await import('@/lib/queries');
    
    vi.mocked(useRulesetQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<RulesetDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading Story...')).toBeInTheDocument();
  });

  it('shows error state when ruleset not found', async () => {
    const { useRulesetQuery } = await import('@/lib/queries');
    
    vi.mocked(useRulesetQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    } as any);

    render(<RulesetDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Ruleset Not Found')).toBeInTheDocument();
    expect(screen.getByText('Back to Rulesets')).toBeInTheDocument();
  });

  it('shows empty state when no stories use the ruleset', async () => {
    const { useRulesetQuery, useStoriesQuery } = await import('@/lib/queries');
    
    vi.mocked(useRulesetQuery).mockReturnValue({
      data: { data: mockRuleset },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useStoriesQuery).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    } as any);

    render(<RulesetDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('No stories yet')).toBeInTheDocument();
    expect(screen.getByText('Browse All Stories')).toBeInTheDocument();
  });
});
