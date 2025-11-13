/**
 * Publishing Wizard A11y Tests
 * Phase 8: Tests for accessibility features
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublishingWizardPage from '../wizard';
import { isPublishingWizardEnabled } from '@/lib/feature-flags';
import * as api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

// Mock dependencies
vi.mock('@/lib/feature-flags');
vi.mock('@/lib/api');
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams('?type=world&id=test-id')],
  };
});

describe('PublishingWizardPage - A11y', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(useAuthStore).mockReturnValue({ userId: 'user-1' } as any);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { allowed: true, dependency_invalid: false },
    } as any);
  });

  it('should have aria-current="step" on current step', () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    const dependenciesCard = screen.getByText(/Dependencies/i).closest('[aria-current]');
    expect(dependenciesCard).toHaveAttribute('aria-current', 'step');
  });

  it('should have role="status" on async result alerts', () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    // Check for status role on alerts (would appear after dependency check)
    const alerts = screen.getAllByRole('status');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should have aria-live="polite" on toast-like elements', () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    const liveRegions = screen.getAllByRole('status');
    liveRegions.forEach((region) => {
      expect(region).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should have proper aria-labels on buttons', () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      // Should have aria-label or accessible text
      const hasLabel = button.getAttribute('aria-label') || button.textContent;
      expect(hasLabel).toBeTruthy();
    });
  });

  it('should have focusable step cards with tabIndex', () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    const stepCard = screen.getByText(/Dependencies/i).closest('[tabIndex]');
    expect(stepCard).toHaveAttribute('tabIndex', '-1');
  });
});



