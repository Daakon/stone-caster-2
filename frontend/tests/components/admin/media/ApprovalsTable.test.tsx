/**
 * ApprovalsTable Component Tests
 * Phase 3c: Unit tests for approvals table component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalsTable } from '@/components/admin/media/ApprovalsTable';
import type { MediaAssetDTO } from '@shared/types/media';

// Mock buildImageUrl
vi.mock('@shared/media/url', () => ({
  buildImageUrl: (id: string, variant: string) => `https://imagedelivery.net/${id}/${variant}`,
}));

const mockItems: MediaAssetDTO[] = [
  {
    id: 'media-1',
    owner_user_id: 'user-123',
    kind: 'world',
    provider: 'cloudflare_images',
    provider_key: 'cf-123',
    visibility: 'private',
    status: 'ready',
    image_review_status: 'pending',
    width: 1920,
    height: 1080,
    sha256: null,
    created_at: new Date().toISOString(),
    ready_at: new Date().toISOString(),
  },
  {
    id: 'media-2',
    owner_user_id: 'user-456',
    kind: 'story',
    provider: 'cloudflare_images',
    provider_key: 'cf-456',
    visibility: 'private',
    status: 'ready',
    image_review_status: 'pending',
    width: 800,
    height: 600,
    sha256: null,
    created_at: new Date().toISOString(),
    ready_at: new Date().toISOString(),
  },
];

describe('ApprovalsTable', () => {
  const mockOnReview = vi.fn();
  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock env var
    vi.stubEnv('VITE_CF_IMAGES_DELIVERY_URL', 'https://imagedelivery.net');
  });

  it('should render table with items', () => {
    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.getByText('story')).toBeInTheDocument();
    expect(screen.getAllByText('Approve')).toHaveLength(2);
    expect(screen.getAllByText('Reject')).toHaveLength(2);
  });

  it('should show loading state', () => {
    render(
      <ApprovalsTable
        items={[]}
        loading={true}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    expect(screen.getByText('Loading pending images...')).toBeInTheDocument();
  });

  it('should show empty state when not loading', () => {
    render(
      <ApprovalsTable
        items={[]}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    expect(screen.getByText('No pending images')).toBeInTheDocument();
    expect(screen.getByText("You're all clear!")).toBeInTheDocument();
  });

  it('should call onReview when approve button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);

    expect(mockOnReview).toHaveBeenCalledWith('media-1', 'approved');
  });

  it('should call onReview when reject button is clicked', async () => {
    const user = userEvent.setup();
    // Mock confirm and prompt
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'Rejection reason');

    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);

    expect(mockOnReview).toHaveBeenCalledWith('media-1', 'rejected');
  });

  it('should handle row selection', async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all", second is first row
    await user.click(checkboxes[1]);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(new Set(['media-1']));
  });

  it('should handle select all', async () => {
    const user = userEvent.setup();
    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all"
    await user.click(checkboxes[0]);

    expect(mockOnSelectionChange).toHaveBeenCalledWith(
      new Set(['media-1', 'media-2'])
    );
  });

  it('should disable buttons when in flight', () => {
    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
        inFlightIds={new Set(['media-1'])}
      />
    );

    const approveButtons = screen.getAllByText('Approve');
    // First button should be disabled
    expect(approveButtons[0]).toBeDisabled();
  });

  it('should show placeholder when delivery URL is missing', () => {
    vi.stubEnv('VITE_CF_IMAGES_DELIVERY_URL', '');

    render(
      <ApprovalsTable
        items={mockItems}
        loading={false}
        selectedIds={new Set()}
        onSelectionChange={mockOnSelectionChange}
        onReview={mockOnReview}
      />
    );

    // Should not have images, should have placeholder icons
    const images = screen.queryAllByRole('img');
    expect(images.length).toBe(0); // No images when delivery URL is missing
  });
});


