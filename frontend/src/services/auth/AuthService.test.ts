import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './AuthService';
import { supabase } from '@/lib/supabase';
import { GuestCookieService } from '../guestCookie';
import { RoutePreservationService } from '../routePreservation';
import { ProfileService } from '../profile';
import type { ProfileDTO } from '@shared/types/dto';

// Mock dependencies
vi.mock('../supabase', () => ({
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

vi.mock('../profile', () => ({
  ProfileService: {
    getProfile: vi.fn(),
  }
}));

vi.mock('shared', () => ({
  AuthState: {
    GUEST: 'guest',
    COOKIED: 'cookied',
    AUTHENTICATED: 'authenticated',
  },
}));

const mockSupabase = vi.mocked(supabase);
const mockGuestCookieService = vi.mocked(GuestCookieService);
const mockRoutePreservationService = vi.mocked(RoutePreservationService);
const mockProfileService = vi.mocked(ProfileService);
const profileFixture: ProfileDTO = {
  id: 'profile-123',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  email: 'test@example.com',
  preferences: {
    showTips: true,
    theme: 'dark',
    notifications: {
      email: true,
      push: false,
    },
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  lastSeen: '2025-01-01T01:00:00.000Z',
};

let windowStubbed = false;
let documentStubbed = false;
let originalLocation: Location | undefined;
let originalHistory: History | undefined;
let originalDocumentTitle: string | undefined;

describe('AuthService OAuth', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileService.getProfile.mockResolvedValue({ ok: true, data: profileFixture });
    authService = AuthService.getInstance();

    const locationMock = {
      pathname: '/auth/signin',
      origin: 'http://localhost:5173',
      search: '',
      hash: '',
      assign: vi.fn(),
    };

    const historyMock = {
      replaceState: vi.fn(),
    };

    const documentMock = {
      title: 'Stone Caster Test',
    };

    if (typeof globalThis.window === 'undefined') {
      vi.stubGlobal('window', {
        location: locationMock,
        history: historyMock,
      } as unknown as Window & typeof globalThis);
      windowStubbed = true;
    } else {
      originalLocation = globalThis.window.location;
      originalHistory = globalThis.window.history;
      Object.defineProperty(globalThis.window, 'location', {
        value: locationMock,
        writable: true,
      });
      Object.defineProperty(globalThis.window, 'history', {
        value: historyMock,
        writable: true,
      });
      windowStubbed = false;
    }

    if (typeof globalThis.document === 'undefined') {
      vi.stubGlobal('document', documentMock as unknown as Document);
      documentStubbed = true;
    } else {
      originalDocumentTitle = globalThis.document.title;
      globalThis.document.title = documentMock.title;
      documentStubbed = false;
    }
  });

  afterEach(() => {
    if (windowStubbed || documentStubbed) {
      vi.unstubAllGlobals();
      windowStubbed = false;
      documentStubbed = false;
      originalLocation = undefined;
      originalHistory = undefined;
      originalDocumentTitle = undefined;
    } else {
      if (typeof globalThis.window !== 'undefined' && originalLocation && originalHistory) {
        Object.defineProperty(globalThis.window, 'location', {
          value: originalLocation,
          writable: true,
        });
        Object.defineProperty(globalThis.window, 'history', {
          value: originalHistory,
          writable: true,
        });
      }

      if (typeof globalThis.document !== 'undefined' && originalDocumentTitle !== undefined) {
        globalThis.document.title = originalDocumentTitle;
      }

      originalLocation = undefined;
      originalHistory = undefined;
      originalDocumentTitle = undefined;
    }
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

    await authStateCallback?.('SIGNED_IN', mockSession);

    await vi.waitFor(() => {
      const currentUser = authService.getCurrentUser();
      expect(currentUser?.state).toBe('authenticated');
      expect(currentUser?.profile).toEqual(profileFixture);
    });

    const currentUser = authService.getCurrentUser();
    expect(mockProfileService.getProfile).toHaveBeenCalled();
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
    await authStateCallback?.('SIGNED_OUT', null);

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


