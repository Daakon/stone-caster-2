import { render, screen } from '@testing-library/react';
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
  const mockLocation = { pathname: '/auth/signin' };

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
    mockUseAuthStore.mockReturnValue({
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
    mockUseAuthStore.mockReturnValue({
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
    mockUseAuthStore.mockReturnValue({
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

  it('should not redirect guest user from auth pages', () => {
    mockUseAuthStore.mockReturnValue({
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
    mockUseAuthStore.mockReturnValue({
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
    });

    render(
      <BrowserRouter>
        <AuthRouter />
      </BrowserRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});