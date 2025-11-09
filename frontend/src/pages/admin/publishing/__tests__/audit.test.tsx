/**
 * Publishing Audit Page Tests
 * Phase 5: Tests for audit viewer page
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PublishingAuditPage from '../audit';
import { isPublishingAuditViewerEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');

describe('PublishingAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { items: [], next_cursor: undefined },
    } as any);
  });

  it('should render when flag is enabled', () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);

    render(<PublishingAuditPage />);

    expect(screen.getByText('Publishing Audit')).toBeInTheDocument();
  });

  it('should show disabled message when flag is off', () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(false);

    render(<PublishingAuditPage />);

    expect(screen.getByText('Audit Viewer Disabled')).toBeInTheDocument();
  });

  it('should display audit logs with filters', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    const mockItems = [
      {
        id: 'audit-1',
        entity_type: 'world',
        entity_id: 'world-1',
        action: 'request',
        requested_by: 'user-1',
        reviewed_by: null,
        reason: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { items: mockItems, next_cursor: undefined },
    } as any);

    render(<PublishingAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Requested')).toBeInTheDocument();
    });
  });

  it('should show empty state when no logs found', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { items: [], next_cursor: undefined },
    } as any);

    render(<PublishingAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    });
  });

  it('should show error state on API failure', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: false,
      error: { message: 'Failed to load' },
    } as any);

    render(<PublishingAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('should show Load More button when next_cursor is present', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: {
        items: [{ id: 'audit-1', entity_type: 'world', entity_id: 'world-1', action: 'request', requested_by: 'user-1', reviewed_by: null, reason: null, created_at: new Date().toISOString() }],
        next_cursor: 'cursor-123',
      },
    } as any);

    render(<PublishingAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('Load More')).toBeInTheDocument();
    });
  });
});

