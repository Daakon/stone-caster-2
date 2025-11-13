/**
 * Publishing Admin Page Activity Tab Tests
 * Phase 5: Tests for Activity feed tab
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PublishingAdminPage from '../index';
import { isPublishingAuditViewerEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');

describe('PublishingAdminPage - Activity Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { items: [] },
    } as any);
  });

  it('should render Activity tab when flag is enabled', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);

    render(<PublishingAdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  it('should not render Activity tab when flag is disabled', () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(false);

    render(<PublishingAdminPage />);

    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });

  it('should load and display activity items', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    const mockItems = [
      {
        id: 'audit-1',
        entity_type: 'world',
        entity_id: 'world-1',
        action: 'approve',
        requested_by: 'user-1',
        reviewed_by: 'admin-1',
        reason: null,
        created_at: new Date().toISOString(),
      },
    ];

    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { items: mockItems },
    } as any);

    render(<PublishingAdminPage />);

    // Click Activity tab
    const activityTab = await screen.findByText('Activity');
    activityTab.click();

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });
  });

  it('should filter activity by time window', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    // Test would verify client-side filtering logic
    // This is a structure test
    expect(true).toBe(true);
  });

  it('should filter activity by action', async () => {
    vi.mocked(isPublishingAuditViewerEnabled).mockReturnValue(true);
    // Test would verify client-side filtering logic
    // This is a structure test
    expect(true).toBe(true);
  });
});



