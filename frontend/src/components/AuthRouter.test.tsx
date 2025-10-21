import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthRouter } from './AuthRouter';
import { useAuthStore } from '../store/auth';
import { RoutePreservationService } from '../services/routePreservation';
import { vi } from 'vitest';

// Mock the auth store
vi.mock('../store/auth');
vi.mock('../services/routePreservation');

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);

// Mock console.log to capture logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('AuthRouter', () => {
  const mockNavigate = vi.fn();
  const mockLocation = { pathname: '/auth/signin', state: null };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    
    // Mock useNavigate and useLocation
    vi.doMock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocation,
    }));
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it('should log auth status for guest user', () => {
    // Mock the selector-based store calls
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { state: 'guest', id: 'guest-123' },
        loading: false,
        isAuthenticated: false,
        isGuest: true,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[AUTH] mode=guest user=absent guestId=present'
    );
  });

  it('should log auth status for authenticated user', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[AUTH] mode=member user=present guestId=absent'
    );
  });

  it('should redirect authenticated user away from auth pages', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue('/dashboard');

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/dashboard trigger=signin'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('should redirect to fallback route when no intended route is preserved', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue(null);

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/ trigger=signin'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('should redirect to location.state.from when available', () => {
    const mockLocationWithState = { pathname: '/auth/signin', state: { from: '/profile' } };
    
    vi.doMock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocationWithState,
    }));

    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue(null);

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/profile trigger=signin'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
  });

  it('should not redirect guest user from auth pages', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { state: 'guest', id: 'guest-123' },
        loading: false,
        isAuthenticated: false,
        isGuest: true,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[AUTH] allowing guest to stay on auth page: /auth/signin'
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect when loading', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: null,
        loading: true,
        isAuthenticated: false,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should redirect to fallback route when no intended route is preserved', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    // Mock location with state.from
    const mockLocationWithState = { pathname: '/auth/signin', state: { from: '/dashboard' } };
    vi.doMock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocationWithState,
    }));

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue(null);

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/dashboard trigger=signin'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('should redirect to home when no intended route or state.from', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    // Mock location without state.from
    const mockLocationWithoutState = { pathname: '/auth/signin', state: null };
    vi.doMock('react-router-dom', () => ({
      ...vi.importActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocationWithoutState,
    }));

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue(null);

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/ trigger=signin'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('should prevent double navigation with redirect guard', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          state: 'authenticated', 
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User'
        },
        loading: false,
        isAuthenticated: true,
        isGuest: false,
        isCookied: false,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        initialize: vi.fn(),
      };
      return selector(state);
    });

    mockRoutePreservationService.getAndClearIntendedRoute.mockReturnValue('/dashboard');

    const { rerender } = render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    // First render should trigger navigation
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] from=/auth/signin to=/dashboard trigger=signin'
    );

    // Clear the mock to track subsequent calls
    mockNavigate.mockClear();
    mockConsoleLog.mockClear();

    // Re-render with same state should not trigger another navigation
    rerender(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '[REDIRECT] already redirected, skipping'
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
