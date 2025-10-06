import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAuthRedirect } from './useAuthRedirect';
import { useAuthStore } from '../store/auth';
import { RoutePreservationService } from '../services/routePreservation';
import { AuthState } from '@shared';

// Mock dependencies
vi.mock('../store/auth');
vi.mock('../services/routePreservation');

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/test' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);

describe('useAuthRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/test';
  });

  it('should not redirect while loading', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    renderHook(() => useAuthRedirect(), {
      wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    });

    expect(mockRoutePreservationService.getAndClearIntendedRoute).not.toHaveBeenCalled();
  });

  it('should redirect authenticated user from auth pages to intended route', () => {
    mockLocation.pathname = '/auth/signin';

    const mockUser = {
      state: AuthState.AUTHENTICATED,
      id: 'user-123',
      key: 'jwt-token',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue('/adventures/mystika-tutorial/characters');

    renderHook(() => useAuthRedirect(), {
      wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    });

    expect(mockRoutePreservationService.getAndClearIntendedRoute).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/adventures/mystika-tutorial/characters', { replace: true });
  });

  it('should not redirect authenticated user from non-auth pages', () => {
    mockLocation.pathname = '/adventures';

    const mockUser = {
      state: AuthState.AUTHENTICATED,
      id: 'user-123',
      key: 'jwt-token',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    renderHook(() => useAuthRedirect(), {
      wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    });

    expect(mockRoutePreservationService.getAndClearIntendedRoute).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect guest users', () => {
    mockLocation.pathname = '/auth/signin';

    const mockGuestUser = {
      state: AuthState.GUEST,
      id: 'guest-123'
    };

    mockUseAuthStore.mockReturnValue({
      user: mockGuestUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    renderHook(() => useAuthRedirect(), {
      wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    });

    expect(mockRoutePreservationService.getAndClearIntendedRoute).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should handle signup page redirect', () => {
    mockLocation.pathname = '/signup';

    const mockUser = {
      state: AuthState.AUTHENTICATED,
      id: 'user-123',
      key: 'jwt-token',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      initialize: vi.fn(),
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue('/');

    renderHook(() => useAuthRedirect(), {
      wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    });

    expect(mockRoutePreservationService.getAndClearIntendedRoute).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
