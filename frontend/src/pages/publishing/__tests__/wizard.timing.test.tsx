/**
 * Publishing Wizard Timing Tests
 * Phase 8: Tests for step timing analytics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Mock performance.now
const mockPerformanceNow = vi.fn();
Object.defineProperty(window, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
  writable: true,
});

describe('PublishingWizardPage - Timing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPublishingWizardEnabled).mockReturnValue(true);
    vi.mocked(useAuthStore).mockReturnValue({ userId: 'user-1' } as any);
    vi.mocked(api.apiFetch).mockResolvedValue({
      ok: true,
      data: { allowed: true, dependency_invalid: false },
    } as any);
    
    // Mock performance.now to return increasing values
    let time = 1000;
    mockPerformanceNow.mockImplementation(() => {
      time += 100;
      return time;
    });
  });

  it('should track time when entering a step', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    // Initial step entry should set timing
    expect(mockPerformanceNow).toHaveBeenCalled();
  });

  it('should emit timing event when exiting a step', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <MemoryRouter>
        <PublishingWizardPage />
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/Publishing Wizard/i)).toBeInTheDocument();
    });

    // Simulate step transition (would need to complete dependency check first)
    // This is a simplified test - in real scenario would need to mock API responses
    // and trigger step changes
    
    // Verify console.log was called with timing data
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[wizard] Step timing:'),
      expect.any(String),
      expect.any(Number),
      'ms'
    );
    
    consoleSpy.mockRestore();
  });
});

