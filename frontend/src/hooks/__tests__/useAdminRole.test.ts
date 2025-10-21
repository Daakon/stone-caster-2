import { renderHook, waitFor } from '@testing-library/react';
import { useAdminRole } from '../useAdminRole';
import { useAuthStore } from '@/store/auth';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js');
const mockSupabase = createClient as jest.MockedFunction<typeof createClient>;

// Mock auth store
jest.mock('@/store/auth');
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('useAdminRole', () => {
  const mockAuth = {
    getSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.mockReturnValue({
      auth: mockAuth,
    } as any);
  });

  it('should return loading state initially', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user' },
    } as any);

    const { result } = renderHook(() => useAdminRole());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should return not admin when user is not authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
    } as any);

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.error).toBe('Not authenticated');
    });
  });

  it('should return admin when user has prompt_admin role', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user' },
    } as any);

    mockAuth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            user_metadata: {
              role: 'prompt_admin',
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.userRole).toBe('prompt_admin');
      expect(result.current.error).toBe(null);
    });
  });

  it('should return not admin when user has different role', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user' },
    } as any);

    mockAuth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            user_metadata: {
              role: 'user',
            },
          },
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.userRole).toBe('user');
      expect(result.current.error).toBe('Insufficient permissions');
    });
  });

  it('should handle authentication errors', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user' },
    } as any);

    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('Auth failed'),
    });

    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.error).toBe('Authentication failed');
    });
  });
});









