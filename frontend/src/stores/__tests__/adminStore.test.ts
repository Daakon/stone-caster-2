/**
 * Admin Store Tests
 * Test the centralized admin state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStore } from '../adminStore';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('AdminStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAdminStore.getState().clearCache();
    vi.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const state = useAdminStore.getState();
    
    expect(state.userRole).toBeNull();
    expect(state.roleLoading).toBe(false);
    expect(state.roleError).toBeNull();
    expect(state.coreContracts).toEqual([]);
    expect(state.contractsLoading).toBe(false);
    expect(state.contractsError).toBeNull();
    expect(state.contractsLastFetched).toBeNull();
  });

  it('should cache user role after fetching', async () => {
    const mockRole = 'prompt_admin';
    const mockUserId = 'test-user-id';
    
    // Mock Supabase response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: mockRole },
            error: null
          })
        })
      })
    } as any);

    const store = useAdminStore.getState();
    
    // First call should fetch from API
    await store.fetchUserRole(mockUserId);
    
    expect(store.userRole).toBe(mockRole);
    expect(store.roleLoading).toBe(false);
    expect(store.roleError).toBeNull();
    
    // Second call should use cache
    const cachedRole = store.getCachedUserRole();
    expect(cachedRole).toBe(mockRole);
  });

  it('should handle role fetch errors', async () => {
    const mockUserId = 'test-user-id';
    const mockError = new Error('Database error');
    
    // Mock Supabase error
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      })
    } as any);

    const store = useAdminStore.getState();
    
    await expect(store.fetchUserRole(mockUserId)).rejects.toThrow();
    
    expect(store.userRole).toBeNull();
    expect(store.roleLoading).toBe(false);
    expect(store.roleError).toBeTruthy();
  });

  it('should clear cache correctly', () => {
    const store = useAdminStore.getState();
    
    // Set some state
    store.userRole = 'prompt_admin';
    store.coreContracts = [{ id: 'test' }];
    
    // Clear cache
    store.clearCache();
    
    expect(store.userRole).toBeNull();
    expect(store.coreContracts).toEqual([]);
    expect(store.roleLoading).toBe(false);
    expect(store.contractsLoading).toBe(false);
  });
});
