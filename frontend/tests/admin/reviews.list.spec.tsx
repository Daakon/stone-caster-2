/**
 * Reviews List Tests
 * Phase 5: Tests for the reviews queue and moderation workflow
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReviewsAdmin from '@/pages/admin/reviews/index';
import { reviewsService } from '@/services/admin.reviews';

// Mock the services
vi.mock('@/services/admin.reviews', () => ({
  reviewsService: {
    listReviews: vi.fn(),
    attachReviewer: vi.fn(),
    updateReviewState: vi.fn()
  }
}));

// Mock the admin route guard
vi.mock('@/admin/routeGuard', () => ({
  useAppRoles: () => ({
    isCreator: false,
    isModerator: true,
    isAdmin: false,
    roles: ['moderator'],
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

const mockReviews = [
  {
    id: 'review-1',
    target_type: 'entry_point',
    target_id: 'entry-1',
    state: 'open',
    submitted_by: 'user-1',
    reviewer_id: null,
    notes: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    submitter_name: 'John Doe',
    reviewer_name: 'Unassigned',
    target_title: 'Test Adventure'
  },
  {
    id: 'review-2',
    target_type: 'prompt_segment',
    target_id: 'segment-1',
    state: 'approved',
    submitted_by: 'user-2',
    reviewer_id: 'moderator-1',
    notes: ['Great content!'],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    submitter_name: 'Jane Smith',
    reviewer_name: 'Moderator One',
    target_title: 'System Prompt'
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Reviews List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API calls
    vi.mocked(reviewsService.listReviews).mockResolvedValue({
      data: mockReviews,
      hasMore: false,
      nextCursor: undefined
    });
  });

  it('renders reviews list with data', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Content Reviews')).toBeInTheDocument();
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
    });
  });

  it('shows pending count badge', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('1 pending')).toBeInTheDocument();
    });
  });

  it('filters reviews by state', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Content Reviews')).toBeInTheDocument();
    });

    // Test state filter
    const stateSelect = screen.getByDisplayValue('All states');
    fireEvent.click(stateSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Open'));

    expect(reviewsService.listReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        state: ['open']
      })
    );
  });

  it('filters reviews by target type', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Content Reviews')).toBeInTheDocument();
    });

    // Test target type filter
    const typeSelect = screen.getByDisplayValue('All types');
    fireEvent.click(typeSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Entry Point')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Entry Point'));

    expect(reviewsService.listReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        target_type: ['entry_point']
      })
    );
  });

  it('filters reviews by reviewer', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Content Reviews')).toBeInTheDocument();
    });

    // Test reviewer filter
    const reviewerSelect = screen.getByDisplayValue('All reviewers');
    fireEvent.click(reviewerSelect);
    
    await waitFor(() => {
      expect(screen.getByText('Assigned to me')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Assigned to me'));

    expect(reviewsService.listReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewer: 'me'
      })
    );
  });

  it('searches reviews by content', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Content Reviews')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search reviews...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Wait for debounced search
    await waitFor(() => {
      expect(reviewsService.listReviews).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'test'
        })
      );
    });
  });

  it('handles assign to me action', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Find and click assign button
    const assignButtons = screen.getAllByText('Assign to Me');
    fireEvent.click(assignButtons[0]);

    expect(reviewsService.attachReviewer).toHaveBeenCalledWith('review-1');
  });

  it('handles quick approve action', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Find and click approve button
    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    fireEvent.click(approveButtons[0]);

    expect(reviewsService.updateReviewState).toHaveBeenCalledWith('review-1', 'approved');
  });

  it('handles quick reject action', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Find and click reject button
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    fireEvent.click(rejectButtons[0]);

    expect(reviewsService.updateReviewState).toHaveBeenCalledWith('review-1', 'rejected');
  });

  it('handles quick request changes action', async () => {
    // Mock confirm dialog
    global.confirm = vi.fn(() => true);

    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Test Adventure')).toBeInTheDocument();
    });

    // Find and click request changes button
    const requestButtons = screen.getAllByRole('button', { name: /request/i });
    fireEvent.click(requestButtons[0]);

    expect(reviewsService.updateReviewState).toHaveBeenCalledWith('review-1', 'changes_requested');
  });

  it('shows state badges correctly', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });
  });

  it('shows target type badges correctly', async () => {
    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('entry point')).toBeInTheDocument();
      expect(screen.getByText('prompt segment')).toBeInTheDocument();
    });
  });

  it('handles loading state', () => {
    // Mock loading state
    vi.mocked(reviewsService.listReviews).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<ReviewsAdmin />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error
    vi.mocked(reviewsService.listReviews).mockRejectedValue(
      new Error('Failed to load')
    );

    renderWithRouter(<ReviewsAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
    });
  });

  it('shows access denied for non-moderators', () => {
    // Mock non-moderator role
    vi.mocked(require('@/admin/routeGuard').useAppRoles).mockReturnValue({
      isCreator: true,
      isModerator: false,
      isAdmin: false,
      roles: ['creator'],
      isLoading: false,
      error: null
    });

    renderWithRouter(<ReviewsAdmin />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/You need moderator or admin permissions/)).toBeInTheDocument();
  });
});














