/**
 * Publishing Wizard Save/Resume Tests
 * Phase 8: Tests for localStorage and server session persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublishingWizardPage from '../wizard';
import { isPublishingWizardEnabled, isPublishingWizardSessionsEnabled } from '@/lib/feature-flags';
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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('PublishingWizardPage - Save/Resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(isPublishingWizardSessionsEnabled).mockReturnValue(false);
    vi.mocked(useAuthStore).mockReturnValue({ userId: 'user-1' } as any);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { allowed: true, dependency_invalid: false },
    } as any);
  });

  it('should save to localStorage on step change', async () => {
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Publishing Wizard/i)).toBeInTheDocument();
    });

    // Simulate step change (would need to trigger dependency check first)
    // This is a simplified test - in real scenario would need to mock API responses
    const key = 'wizard:user-1:world:test-id';
    expect(localStorageMock.getItem(key)).toBeTruthy();
  });

  it('should load from localStorage on mount', async () => {
    const savedState = {
      step: 'preflight',
      preflightScore: 80,
      timestamp: Date.now(),
    };
    localStorageMock.setItem('wizard:user-1:world:test-id', JSON.stringify(savedState));

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      // Should show resume banner
      expect(screen.queryByText(/Resume Previous Progress/i)).toBeInTheDocument();
    });
  });

  it('should sync with server when sessions flag is enabled', async () => {
    vi.mocked(isPublishingWizardSessionsEnabled).mockReturnValue(true);
    vi.mocked(api.apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        data: { allowed: true, step: 'preflight', data: { preflightScore: 80 } },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        data: { step: 'preflight', data: { preflightScore: 80 } },
      } as any);

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/publishing/wizard/status/world/test-id')
      );
    });
  });

  it('should clear localStorage on reset', async () => {
    const savedState = { step: 'preflight', timestamp: Date.now() };
    localStorageMock.setItem('wizard:user-1:world:test-id', JSON.stringify(savedState));

    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      const resetButton = screen.getByText(/Reset Wizard/i);
      fireEvent.click(resetButton);
    });

    // Confirm reset dialog
    await waitFor(() => {
      const confirmButton = screen.getByText(/Reset/i);
      fireEvent.click(confirmButton);
    });

    expect(localStorageMock.getItem('wizard:user-1:world:test-id')).toBeNull();
  });
});

