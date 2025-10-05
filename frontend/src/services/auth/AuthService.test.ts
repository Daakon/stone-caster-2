import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './AuthService';
import { supabase } from '../../lib/supabase';
import { GuestCookieService } from '../guestCookie';
import { RoutePreservationService } from '../routePreservation';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      setSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      getUser: vi.fn(),
    }
  }
}));

vi.mock('../guestCookie', () => ({
  GuestCookieService: {
    getGuestCookie: vi.fn(),
    getOrCreateGuestCookie: vi.fn(),
  }
}));

vi.mock('../routePreservation', () => ({
  RoutePreservationService: {
    setIntendedRoute: vi.fn(),
    getAndClearIntendedRoute: vi.fn(),
  }
}));

const mockSupabase = vi.mocked(supabase);
const mockGuestCookieService = vi.mocked(GuestCookieService);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);

describe('AuthService OAuth', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = AuthService.getInstance();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/auth/signin',
        origin: 'http://localhost:5173',
        search: '',
        hash: '',
        assign: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect OAuth callback with hash parameters', async () => {
    // Mock hash parameters
    window.location.hash = '#access_token=mock_token&refresh_token=mock_refresh&token_type=bearer';
    
    // Mock setSession to return a session
    mockSupabase.auth.setSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { display_name: 'Test User' }
          },
          access_token: 'mock_token'
        }
      },
      error: null
    });

    // Mock getSession to return no initial session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Verify setSession was called with the tokens
    expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'mock_token',
      refresh_token: 'mock_refresh'
    });
  });

  it('should detect OAuth callback with search parameters', async () => {
    // Mock search parameters
    window.location.search = '?code=mock_code&state=mock_state';
    
    // Mock getSession to return a session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { display_name: 'Test User' }
          },
          access_token: 'mock_token'
        }
      },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Verify getSession was called
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });

  it('should handle OAuth error in hash parameters', async () => {
    // Mock error in hash
    window.location.hash = '#error=access_denied&error_description=User+denied+access';
    
    // Mock getSession to return no session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Should not call setSession for errors
    expect(mockSupabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('should set up auth state change listener', async () => {
    // Mock getSession to return no session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Verify onAuthStateChange was called
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('should handle auth state change SIGNED_IN event', async () => {
    let authStateCallback: (event: string, session: any) => void;
    
    // Mock onAuthStateChange to capture the callback
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Mock getSession to return no initial session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Simulate SIGNED_IN event
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { display_name: 'Test User' }
      },
      access_token: 'mock_token'
    };

    authStateCallback('SIGNED_IN', mockSession);

    // Verify user state is updated
    const currentUser = authService.getCurrentUser();
    expect(currentUser?.state).toBe('authenticated');
    expect(currentUser?.id).toBe('user-123');
    expect(currentUser?.email).toBe('test@example.com');
  });

  it('should handle auth state change SIGNED_OUT event', async () => {
    let authStateCallback: (event: string, session: any) => void;
    
    // Mock onAuthStateChange to capture the callback
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Mock getSession to return a session initially
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { display_name: 'Test User' }
          },
          access_token: 'mock_token'
        }
      },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue('guest-123');

    await authService.initialize();

    // Simulate SIGNED_OUT event
    authStateCallback('SIGNED_OUT', null);

    // Verify user state falls back to guest
    const currentUser = authService.getCurrentUser();
    expect(currentUser?.state).toBe('cookied');
    expect(currentUser?.id).toBe('guest-123');
  });

  it('should preserve intended route during OAuth flow', async () => {
    // Mock window.location for a protected page
    window.location.pathname = '/profile';
    
    // Mock getSession to return no session
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Mock guest cookie service
    mockGuestCookieService.getGuestCookie.mockReturnValue(null);
    mockGuestCookieService.getOrCreateGuestCookie.mockReturnValue('guest-123');

    // Mock signInWithOAuth
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://google.com/oauth' },
      error: null
    });

    await authService.initialize();

    // Call signInWithOAuth
    await authService.signInWithOAuth('google');

    // Verify intended route was set
    expect(mockRoutePreservationService.setIntendedRoute).toHaveBeenCalledWith('/profile');
  });
});
