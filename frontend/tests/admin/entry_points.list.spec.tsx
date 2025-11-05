/**
 * Entry Points List Tests
 * Phase 3: Tests for the entry points list view
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EntryPointsAdmin from '@/pages/admin/entry-points/index';
import { entryPointsService } from '@/services/admin.entryPoints';

// Mock the services
vi.mock('@/services/admin.entryPoints', () => ({
  entryPointsService: {
    listEntryPoints: vi.fn(),
    getWorlds: vi.fn(),
    submitForReview: vi.fn()
  }
}));

// Mock the admin route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: true,
    isModerator: false,
    isAdmin: false,
    roles: ['creator'],
    isLoading: false,
    error: null
  })
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockEntryPoints = [
  {
    id: 'entry-1',
    title: 'Test Adventure',
    type: 'adventure',
    world_id: 'world-1',
    lifecycle: 'draft',
    visibility: 'private',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'entry-2',
    title: 'Another Adventure',
    type: 'scenario',
    world_id: 'world-2',
    lifecycle: 'pending_review',
    visibility: 'public',
    updated_at: '2024-01-02T00:00:00Z'
  }
];

const mockWorlds = [
  { id: 'world-1', name: 'Fantasy World' },
  { id: 'world-2', name: 'Sci-Fi World' }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Entry Points List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(entryPointsService.listEntryPoints).mockResolvedValue({
      data: mockEntryPoints,
      count: 2,
      hasMore: false
    });
    
    vi.mocked(entryPointsService.getWorlds).mockResolvedValue(mockWorlds);
  });

  it('renders entry points list with data', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Entry Points')).toBeInTheDocument();
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
      expect(screen.getByText('Another Adventure')).toBeInTheDocument();
    });
  });

  it('shows create button for creators', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Create Entry Point')).toBeInTheDocument();
    });
  });

  it('filters entry points by lifecycle', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Entry Points')).toBeInTheDocument();
    });

    // Test lifecycle filter
    const lifecycleSelect = screen.getByDisplayValue('All lifecycles');
    fireEvent.click(lifecycleSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Draft'));

    expect(entryPointsService.listEntryPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycle: ['draft']
      }),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('filters entry points by visibility', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Entry Points')).toBeInTheDocument();
    });

    // Test visibility filter
    const visibilitySelect = screen.getByDisplayValue('All visibility');
    fireEvent.click(visibilitySelect);
    
    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Public'));

    expect(entryPointsService.listEntryPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: ['public']
      }),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('searches entry points by text', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Entry Points')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search entry points...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Wait for debounced search
    await waitFor(() => {
      expect(entryPointsService.listEntryPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'test'
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  it('shows submit for review button for draft entries', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Should show submit button for draft entries
    const submitButtons = screen.getAllByRole('button', { name: /submit/i });
    expect(submitButtons.length).toBeGreaterThan(0);
  });

  it('handles submit for review action', async () => {
    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    const submitButton = screen.getAllByRole('button', { name: /submit/i })[0];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(entryPointsService.submitForReview).toHaveBeenCalledWith('entry-1');
    });
  });

  it('shows moderation buttons for pending review entries', async () => {
    // Mock moderator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: false,
      isModerator: true,
      isAdmin: false,
      roles: ['moderator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Another Adventure')).toBeInTheDocument();
    });

    // Should show moderation buttons for pending review entries
    const moderationButtons = screen.getAllByRole('button', { name: /approve|reject/i });
    expect(moderationButtons.length).toBeGreaterThan(0);
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(entryPointsService.listEntryPoints).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<EntryPointsAdmin />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(entryPointsService.listEntryPoints).mockRejectedValue(
      new Error('Failed to load')
    );

    renderWithRouter(<EntryPointsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load entry points')).toBeInTheDocument();
    });
  });
});














