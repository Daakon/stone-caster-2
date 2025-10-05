import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GatedRoute } from './GatedRoute';
import { useAuthStore } from '../../store/auth';
import { ProfileService } from '../../services/profile';
import { RoutePreservationService } from '../../services/routePreservation';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../../store/auth');
vi.mock('../../services/profile');
vi.mock('../../services/routePreservation');

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockProfileService = vi.mocked(ProfileService);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);

// Mock console.log to capture logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('GatedRoute', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  const renderGatedRoute = (props: any = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GatedRoute {...props}>
            <div>Protected Content</div>
          </GatedRoute>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should render children when authentication is not required', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { state: 'guest', id: 'guest-123' },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    renderGatedRoute({ requireAuth: false });

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[ROUTE-GUARD] access=allowed path=/ reason=public'
    );
  });

  it('should render children when user is authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { 
        state: 'authenticated', 
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User'
      },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockProfileService.checkAccess.mockResolvedValue({
      ok: true,
      data: {
        canAccess: true,
        isGuest: false,
        userId: 'user-123',
        requiresAuth: true
      }
    });

    renderGatedRoute({ requireAuth: true });

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[ROUTE-GUARD] access=allowed path=/ reason=authenticated'
    );
  });

  it('should redirect guest user to sign in page', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { state: 'guest', id: 'guest-123' },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockProfileService.checkAccess.mockResolvedValue({
      ok: true,
      data: {
        canAccess: false,
        isGuest: true,
        userId: 'guest-123',
        requiresAuth: true
      }
    });

    renderGatedRoute({ requireAuth: true });

    await waitFor(() => {
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-GUARD] access=blocked path=/ reason=unauthenticated'
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[REDIRECT] from=/ to=/auth/signin trigger=guard'
      );
    });

    expect(mockRoutePreservationService.setIntendedRoute).toHaveBeenCalledWith('/');
  });

  it('should show loading state while checking access', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    renderGatedRoute({ requireAuth: true });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should fall back to local auth state when API fails', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { 
        state: 'authenticated', 
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User'
      },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockProfileService.checkAccess.mockRejectedValue(new Error('API Error'));

    renderGatedRoute({ requireAuth: true });

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should show error state when API fails and no fallback', async () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockProfileService.checkAccess.mockRejectedValue(new Error('API Error'));

    renderGatedRoute({ requireAuth: true });

    await waitFor(() => {
      expect(screen.getByText('Internal Error')).toBeInTheDocument();
    });
  });
});
