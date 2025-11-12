/**
 * Publishing Admin Queue Checklist Tests
 * Phase 6: Tests for checklist functionality in queue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PublishingAdminPage from '../index';
import { isPublishingChecklistsEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');

describe('PublishingAdminPage - Checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: [],
    } as any);
  });

  it('should show Checklist button when flag is enabled', async () => {
    vi.mocked(isPublishingChecklistsEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'item-1',
          type: 'world',
          name: 'Test World',
          owner_user_id: 'user-1',
          submitted_at: new Date().toISOString(),
        },
      ],
    } as any);

    render(<PublishingAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Checklist')).toBeInTheDocument();
    });
  });

  it('should not show Checklist button when flag is disabled', () => {
    vi.mocked(isPublishingChecklistsEnabled).mockReturnValue(false);

    render(<PublishingAdminPage />);

    expect(screen.queryByText('Checklist')).not.toBeInTheDocument();
  });

  it('should open checklist modal when button is clicked', async () => {
    vi.mocked(isPublishingChecklistsEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'item-1',
          type: 'world',
          name: 'Test World',
          owner_user_id: 'user-1',
          submitted_at: new Date().toISOString(),
        },
      ],
    } as any);

    render(<PublishingAdminPage />);

    await waitFor(() => {
      const checklistButton = screen.getByText('Checklist');
      checklistButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Review Checklist')).toBeInTheDocument();
    });
  });
});

