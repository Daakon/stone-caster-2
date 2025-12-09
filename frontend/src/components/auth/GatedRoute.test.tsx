import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GatedRoute } from './GatedRoute';
import { useAuthStore } from '../../store/auth';
import { ProfileService } from '../../services/profile';
import { RoutePreservationService } from '../../services/routePreservation';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock dependencies
vi.mock('../../store/auth');
vi.mock('../../services/profile');
vi.mock('../../services/routePreservation');

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockProfileService = vi.mocked(ProfileService);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);

// Mock console.log to capture logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { });

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

  const renderGatedRoute = (props: any = {}, initialEntries = ['/']) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <GatedRoute {...props}>
            <div>Protected Content</div>
          </GatedRoute>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render children when authentication is not required', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { state: 'guest', id: 'guest-123' },
      isAuthenticated: false,
      isGuest: true,
      isCookied: false,
      authToken: 'token',
      userId: 'guest-123',
      displayName: 'Guest',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
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
      isAuthenticated: true,
      isGuest: false,
      isCookied: false,
      authToken: 'token',
      userId: 'user-123',
      displayName: 'Test User',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
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
      isAuthenticated: false,
      isGuest: true,
      isCookied: false,
      authToken: 'token',
      userId: 'guest-123',
      displayName: 'Guest',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
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
      isAuthenticated: false,
      isGuest: false,
      isCookied: false,
      authToken: null,
      userId: null,
      displayName: 'Guest',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
    });

    renderGatedRoute({ requireAuth: true });

    // Assuming initial state implies loading or similar blocking if implemented
    // The previous test expected 'status' role, but in our modified GatedRoute we removed `loading` from check
    // However, `hasCheckedAccess` starts as false.
    // And `useEffect` runs to set it to true.
    // So initially it should show loading.
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
      isAuthenticated: true,
      isGuest: false,
      isCookied: false,
      authToken: 'token',
      userId: 'user-123',
      displayName: 'Test User',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
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
      isAuthenticated: false,
      isGuest: false,
      isCookied: false,
      authToken: null,
      userId: null,
      displayName: 'Guest',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
    });

    mockProfileService.checkAccess.mockRejectedValue(new Error('API Error'));

    renderGatedRoute({ requireAuth: true });

    await waitFor(() => {
      expect(screen.getByText('Internal Error')).toBeInTheDocument();
    });
  });

  it('should preserve query parameters when redirecting guest user', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { state: 'guest', id: 'guest-123' },
      isAuthenticated: false,
      isGuest: true,
      isCookied: false,
      authToken: 'token',
      userId: 'guest-123',
      displayName: 'Guest',
      setUser: vi.fn(),
      setProfile: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
      profile: null,
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

    const targetPath = '/my-creations?tab=worlds';
    renderGatedRoute({ requireAuth: true }, [targetPath]);

    await waitFor(() => {
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `[ROUTE-GUARD] access=blocked path=${targetPath} reason=unauthenticated` // Note: useLocation in GatedRoute returns location object. pathname is just path. search is separate.
        // My fix in GatedRoute uses location.pathname + location.search
        // But the log `[ROUTE-GUARD]` might be using just pathname?
        // Let's check GatedRoute.tsx
      );
    });

    expect(mockRoutePreservationService.setIntendedRoute).toHaveBeenCalledWith(targetPath);
  });
});
