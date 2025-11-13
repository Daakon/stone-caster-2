/**
 * Preflight Panel Component Tests
 * Phase 6: Tests for PreflightPanel component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PreflightPanel } from '../PreflightPanel';
import { isPublishingPreflightEnabled, isPublishingQualityGatesEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');

describe('PreflightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when flags are disabled', () => {
    vi.mocked(isPublishingPreflightEnabled).mockReturnValue(false);
    vi.mocked(isPublishingQualityGatesEnabled).mockReturnValue(false);

    const { container } = render(<PreflightPanel type="world" id="test-id" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when flags are enabled', () => {
    vi.mocked(isPublishingPreflightEnabled).mockReturnValue(true);
    vi.mocked(isPublishingQualityGatesEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { score: 0, issues: [] },
    } as any);

    render(<PreflightPanel type="world" id="test-id" />);

    expect(screen.getByText('Preflight Check')).toBeInTheDocument();
  });

  it('should display score and issues after running preflight', async () => {
    vi.mocked(isPublishingPreflightEnabled).mockReturnValue(true);
    vi.mocked(isPublishingQualityGatesEnabled).mockReturnValue(true);
    
    const mockIssues = [
      {
        code: 'MISSING_NAME',
        severity: 'high' as const,
        message: 'Name is required',
        path: 'name',
        tip: 'Add a name for your world',
      },
    ];

    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { score: 80, issues: mockIssues },
    } as any);

    render(<PreflightPanel type="world" id="test-id" />);

    const runButton = screen.getByText('Run Preflight');
    runButton.click();

    await waitFor(() => {
      expect(screen.getByText('80/100')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });
});



