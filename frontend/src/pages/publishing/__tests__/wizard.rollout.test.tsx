/**
 * Publishing Wizard Rollout Tests
 * Phase 8: Tests for rollout gate UI
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublishingWizardPage from '../wizard';
import { isPublishingWizardEnabled, isPublishingWizardRolloutEnabled } from '@/lib/feature-flags';
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

describe('PublishingWizardPage - Rollout Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(useAuthStore).mockReturnValue({ userId: 'user-1' } as any);
  });

  it('should show coming soon panel when rollout blocked', async () => {
    vi.mocked(isPublishingWizardRolloutEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { allowed: false },
    } as any);

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
      expect(screen.getByText(/limited rollout/i)).toBeInTheDocument();
    });
  });

  it('should show wizard when rollout allowed', async () => {
    vi.mocked(isPublishingWizardRolloutEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { allowed: true, dependency_invalid: false },
    } as any);

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Publishing Wizard/i)).toBeInTheDocument();
      expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument();
    });
  });

  it('should show wizard when rollout flag is disabled', async () => {
    vi.mocked(isPublishingWizardRolloutEnabled).mockReturnValue(false);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { dependency_invalid: false },
    } as any);

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Publishing Wizard/i)).toBeInTheDocument();
    });
  });
});

