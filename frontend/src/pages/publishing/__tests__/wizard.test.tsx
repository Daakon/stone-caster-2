/**
 * Publishing Wizard Page Tests
 * Phase 7: Tests for wizard page
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublishingWizardPage from '../wizard';
import { isPublishingWizardEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams('?type=world&id=test-id')],
  };
});

describe('PublishingWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: {},
    } as any);
  });

  it('should not render when flag is disabled', () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(false);
    
    const { container } = render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render wizard when flag is enabled', () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Publishing Wizard')).toBeInTheDocument();
  });

  it('should show dependencies step initially', () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Step 1: Dependencies')).toBeInTheDocument();
  });

  it('should check dependencies when button is clicked', async () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: {
        dependency_invalid: false,
      },
    } as any);
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    const checkButton = screen.getByText('Check Dependencies');
    fireEvent.click(checkButton);
    
    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/publishing/wizard/status/world/test-id')
      );
    });
  });

  it('should run preflight when moving to preflight step', async () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        data: { dependency_invalid: false },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        data: { score: 80, issues: [] },
      } as any);
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    // Check dependencies first
    const checkButton = screen.getByText('Check Dependencies');
    fireEvent.click(checkButton);
    
    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
    });
    
    // Move to preflight step
    fireEvent.click(screen.getByText('Next'));
    
    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/publish/world/test-id/preflight')
      );
    });
  });

  it('should disable submit until prerequisites are met', () => {
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    // Submit button should not be visible until we reach submit step
    expect(screen.queryByText('Submit for Review')).not.toBeInTheDocument();
  });
});

