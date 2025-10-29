import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import NPCDetailPage from './NPCDetailPage';

// Mock the analytics module
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// Mock the queries
vi.mock('@/lib/queries', () => ({
  useNPCQuery: vi.fn(),
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

describe('NPCDetailPage', () => {
  const mockNPC = {
    id: 'npc-1',
    name: 'Elena',
    short_desc: 'A wise mage',
    description: 'Elena is a powerful mage who has lived for centuries.',
    portrait_url: 'https://example.com/portrait.jpg',
    world_id: 'world-1',
    world: {
      id: 'world-1',
      slug: 'mystika',
      name: 'Mystika',
      description: 'A mystical world',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders NPC details with world chip', async () => {
    const { useNPCQuery } = await import('@/lib/queries');
    
    vi.mocked(useNPCQuery).mockReturnValue({
      data: { data: mockNPC },
      isLoading: false,
      error: null,
    } as any);

    render(<NPCDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Elena')).toBeInTheDocument();
    expect(screen.getByText('A wise mage')).toBeInTheDocument();
    expect(screen.getByText('Mystika')).toBeInTheDocument();
    expect(screen.getByText('View Stories with Elena')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    const { useNPCQuery } = await import('@/lib/queries');
    
    vi.mocked(useNPCQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<NPCDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading Story...')).toBeInTheDocument();
  });

  it('shows error state when NPC not found', async () => {
    const { useNPCQuery } = await import('@/lib/queries');
    
    vi.mocked(useNPCQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    } as any);

    render(<NPCDetailPage />, { wrapper: createWrapper() });

    expect(screen.getByText('NPC Not Found')).toBeInTheDocument();
    expect(screen.getByText('Back to NPCs')).toBeInTheDocument();
  });
});
