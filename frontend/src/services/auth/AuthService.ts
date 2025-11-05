import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GuestCookieService } from '../guestCookie';
import { RoutePreservationService } from '../routePreservation';
import { ProfileService } from '../profile';
import { AuthState, type AuthUser } from '@shared/types/auth';
import type { ProfileDTO } from '@shared/types/dto';

type AuthSyncContext =
  | 'initial'
  | 'auth_listener'
  | 'password'
  | 'signup'
  | 'server_oauth'
  | 'client_oauth'
  | 'refresh';

export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private profileLoad:
    | { userId: string; promise: Promise<void> }
    | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async initialize(): Promise<AuthUser | null> {
    try {
      console.log('[AuthService] Initializing auth service');
      
      // Set up Supabase auth state change listener
      this.setupAuthStateListener();
      
      // Check for OAuth callback parameters
      await this.handleOAuthCallback();
      
      // Check for authenticated user first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        console.log('[AuthService] Found authenticated session');
        await this.syncAuthenticatedSession(session, 'initial');
      } else {
        // Check for guest cookie
        const guestCookie = GuestCookieService.getGuestCookie();
        if (guestCookie) {
          console.log('[AuthService] Found existing guest cookie');
          this.currentUser = {
            state: AuthState.COOKIED,
            id: guestCookie
          };
        } else {
          // Create new guest
          console.log('[AuthService] Creating new guest session');
          const newGuestCookie = GuestCookieService.getOrCreateGuestCookie();
          this.currentUser = {
            state: AuthState.GUEST,
            id: newGuestCookie
          };
        }
        this.notifyListeners();
      }

      return this.currentUser;
    } catch (error) {
      console.error('[AuthService] Initialization error:', error);
      return null;
    }
  }

  private setupAuthStateListener(): void {
    // Set up Supabase auth state change listener
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_IN' && session) {
        console.log('[AuthService] User signed in via auth state change');
        await this.syncAuthenticatedSession(session, 'auth_listener');
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthService] User signed out via auth state change');
        // Fall back to guest state
        const guestCookie = GuestCookieService.getGuestCookie();
        if (guestCookie) {
          this.currentUser = {
            state: AuthState.COOKIED,
            id: guestCookie
          };
        } else {
          const newGuestCookie = GuestCookieService.getOrCreateGuestCookie();
          this.currentUser = {
            state: AuthState.GUEST,
            id: newGuestCookie
          };
        }
        this.notifyListeners();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('[AuthService] Token refreshed');
        if (this.currentUser?.state === AuthState.AUTHENTICATED && this.currentUser.id === session.user.id && this.currentUser.profile) {
          this.currentUser = {
            ...this.currentUser,
            key: session.access_token
          };
          this.notifyListeners();
        } else {
          await this.syncAuthenticatedSession(session, 'refresh');
        }
      }
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    console.log('[AuthService] Signing in user:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[AuthService] Sign in error:', error);
      throw error;
    }

    if (data.session?.user) {
      console.log('[AuthService] Sign in successful');
      await this.syncAuthenticatedSession(data.session, 'password');

      // Link guest account if exists
      await this.linkGuestAccount();
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    console.log('[AuthService] Signing up user:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      console.error('[AuthService] Sign up error:', error);
      throw error;
    }

    if (data.session?.user) {
      console.log('[AuthService] Sign up successful');
      await this.syncAuthenticatedSession(data.session, 'signup');

      // Link guest account if exists
      await this.linkGuestAccount();
    } else {
      console.log('[AuthService] Sign up initiated; waiting for confirmation');
    }
  }

  async signInWithOAuth(provider: 'google' | 'github' | 'discord'): Promise<void> {
    console.log('[AuthService] Starting OAuth flow for provider:', provider);
    
    // Store the intended route for post-OAuth redirect
    const currentPath = window.location.pathname;
    RoutePreservationService.setIntendedRoute(currentPath);
    
    // Use environment-specific redirect URL (never hardcoded)
    const { getRedirectUrl } = await import('@/lib/redirects');
    const redirectTo = getRedirectUrl();
    
    console.log('[AuthService] ============================================');
    console.log('[AuthService] OAuth Configuration:');
    console.log('[AuthService]   Provider:', provider);
    console.log('[AuthService]   Redirect URL (redirectTo):', redirectTo);
    console.log('[AuthService]   Current path:', currentPath);
    console.log('[AuthService] ============================================');
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[AuthService] OAuth error:', error);
      throw error;
    }

    if (data.url) {
      // Parse the OAuth URL to extract redirect_uri for debugging
      try {
        const oauthUrl = new URL(data.url);
        const redirectUri = oauthUrl.searchParams.get('redirect_uri');
        const redirectToParam = oauthUrl.searchParams.get('redirect_to');
        const stateParam = oauthUrl.searchParams.get('state');
        
        console.log('[AuthService] ============================================');
        console.log('[AuthService] OAuth URL Generated:');
        console.log('[AuthService]   Full OAuth URL:', data.url);
        console.log('[AuthService]   redirect_uri (from OAuth URL):', redirectUri || '(not found in URL)');
        console.log('[AuthService]   redirect_to (from OAuth URL):', redirectToParam || '(not found in URL)');
        console.log('[AuthService]   Expected redirectTo:', redirectTo);
        
        // Decode and inspect the state token (contains site_url)
        if (stateParam) {
          try {
            // JWT state is base64url encoded, decode it
            const parts = stateParam.split('.');
            if (parts.length >= 2) {
              // Decode the payload (second part)
              const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
              console.log('[AuthService]   State token (JWT payload):', payload);
              if (payload.site_url) {
                console.log('[AuthService]   ⚠️  State token site_url:', payload.site_url);
                if (payload.site_url !== redirectTo.split('/auth')[0]) {
                  console.warn('[AuthService]   ⚠️  WARNING: State token site_url does not match redirectTo base URL!');
                  console.warn('[AuthService]     State site_url:', payload.site_url);
                  console.warn('[AuthService]     RedirectTo base:', redirectTo.split('/auth')[0]);
                  console.warn('[AuthService]     This may cause redirects to production instead of localhost.');
                }
              }
              if (payload.referrer) {
                console.log('[AuthService]   State token referrer:', payload.referrer);
              }
            }
          } catch (stateError) {
            console.warn('[AuthService] Could not decode state token:', stateError);
          }
        }
        
        console.log('[AuthService] ============================================');
        
        // Verify redirect_uri matches what we expect (for Google OAuth)
        if (provider === 'google' && redirectUri) {
          const decodedRedirectUri = decodeURIComponent(redirectUri);
          console.log('[AuthService] Google OAuth redirect_uri decoded:', decodedRedirectUri);
          console.log('[AuthService] Expected redirectTo:', redirectTo);
          if (decodedRedirectUri.includes('supabase.co/auth/v1/callback')) {
            console.log('[AuthService] ✓ redirect_uri points to Supabase callback (correct)');
          } else {
            console.warn('[AuthService] ⚠ redirect_uri does not point to Supabase callback!');
          }
        }
      } catch (parseError) {
        console.warn('[AuthService] Could not parse OAuth URL:', parseError);
      }
      
      console.log('[AuthService] Redirecting to OAuth provider...');
      window.location.assign(data.url);
    } else {
      console.error('[AuthService] No OAuth URL returned from Supabase');
    }
  }

  async signOut(): Promise<void> {
    console.log('[AuthService] Signing out user');
    
    await supabase.auth.signOut();
    GuestCookieService.clearGuestCookie();
    
    // Create new guest session
    const newGuestCookie = GuestCookieService.getOrCreateGuestCookie();
    this.currentUser = {
      state: AuthState.GUEST,
      id: newGuestCookie
    };

    this.notifyListeners();
  }

  async linkGuestAccount(): Promise<void> {
    if (this.currentUser?.state !== AuthState.AUTHENTICATED) {
      console.log('[AuthService] Not authenticated, skipping guest account linking');
      return;
    }

    const guestCookie = GuestCookieService.getGuestCookie();
    if (!guestCookie) {
      console.log('[AuthService] No guest cookie found, skipping linking');
      return;
    }

    try {
      console.log('[AuthService] Linking guest account to authenticated user');
      
      // Call backend to link guest data to authenticated user
      const response = await fetch('/api/profile/link-guest', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentUser.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cookieGroupId: guestCookie })
      });

      if (response.ok) {
        GuestCookieService.clearGuestCookie();
        console.log('[AuthService] Guest account linked successfully');
      } else {
        console.warn('[AuthService] Failed to link guest account:', response.statusText);
      }
    } catch (error) {
      console.warn('[AuthService] Error linking guest account:', error);
    }
  }

  async refreshProfile(): Promise<ProfileDTO | null> {
    if (!this.currentUser || this.currentUser.state !== AuthState.AUTHENTICATED) {
      return null;
    }

    const baseUser: AuthUser = {
      state: AuthState.AUTHENTICATED,
      id: this.currentUser.id,
      key: this.currentUser.key,
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
    };

    await this.fetchProfileAndUpdate(baseUser, 'refresh');

    return this.currentUser?.profile ?? null;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  subscribe(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  // Helper methods for the rest of the app
  isAuthenticated(): boolean {
    return this.currentUser?.state === AuthState.AUTHENTICATED;
  }

  isGuest(): boolean {
    return this.currentUser?.state === AuthState.GUEST;
  }

  isCookied(): boolean {
    return this.currentUser?.state === AuthState.COOKIED;
  }

  getUserId(): string | null {
    return this.currentUser?.id || null;
  }

  getAuthToken(): string | null {
    return this.currentUser?.key || null;
  }

  getDisplayName(): string {
    return this.currentUser?.displayName || 'Guest';
  }

  private async syncAuthenticatedSession(session: Session, context: AuthSyncContext): Promise<void> {
    const baseUser = this.buildBaseAuthenticatedUser(session);

    const canReuseExistingProfile =
      this.currentUser?.state === AuthState.AUTHENTICATED &&
      this.currentUser.id === baseUser.id &&
      this.currentUser.profile;

    if (canReuseExistingProfile && this.currentUser?.profile) {
      this.currentUser = {
        ...baseUser,
        profile: this.currentUser.profile,
        displayName: this.currentUser.profile.displayName || baseUser.displayName,
      };
      this.logAuthenticatedUser(this.currentUser, context);
      this.notifyListeners();
      return;
    }

    this.currentUser = baseUser;
    this.logAuthenticatedUser(this.currentUser, context);
    this.notifyListeners();

    void this.fetchProfileAndUpdate(baseUser, context);
  }

  private buildBaseAuthenticatedUser(session: Session): AuthUser {
    return {
      state: AuthState.AUTHENTICATED,
      id: session.user.id,
      key: session.access_token,
      email: session.user.email,
      displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || undefined,
    };
  }

  private async fetchProfileAndUpdate(baseUser: AuthUser, context: AuthSyncContext): Promise<void> {
    if (
      this.profileLoad?.userId === baseUser.id
    ) {
      await this.profileLoad.promise;
      return;
    }

    const promise = (async () => {
    try {
      const result = await ProfileService.getProfile();
      if (!result.ok) {
        console.warn('[AuthService] Unable to load profile during auth sync', {
          context,
          reason: result.error?.code ?? 'unknown',
        });
        return;
      }

      if (this.currentUser?.id !== baseUser.id || this.currentUser?.state !== AuthState.AUTHENTICATED) {
        return;
      }

      const profile = result.data;

      this.currentUser = {
        ...baseUser,
        displayName: profile.displayName || baseUser.displayName,
        profile,
      };

      this.logAuthenticatedUser(this.currentUser, context);
      this.notifyListeners();
    } catch (error) {
      console.warn('[AuthService] Unexpected error while loading profile during auth sync', {
        context,
        errorType: error instanceof Error ? error.name : 'unknown',
      });
    }
    })().finally(() => {
      if (this.profileLoad?.userId === baseUser.id) {
        this.profileLoad = null;
      }
    });

    this.profileLoad = { userId: baseUser.id, promise };

    await promise;
  }

  private logAuthenticatedUser(user: AuthUser, context: AuthSyncContext): void {
    console.log('[AuthService] Authenticated user hydrated', {
      context,
      userId: user.id,
      hasEmail: Boolean(user.email),
      displayNamePreview: this.maskDisplayName(user.displayName),
      profileLoaded: Boolean(user.profile),
      profileId: user.profile?.id ?? null,
    });
  }

  private maskDisplayName(displayName?: string): string {
    if (!displayName) {
      return 'unknown';
    }

    const firstChar = displayName.charAt(0) || '*';
    return `${firstChar}*** (len=${displayName.length})`;
  }

  private async handleOAuthCallback(): Promise<void> {
    try {
      // Check URL search parameters (for server-side redirects)
      const urlParams = new URLSearchParams(window.location.search);
      const hasSearchParams = urlParams.has('code') || urlParams.has('error') || urlParams.has('access_token');
      
      // Check URL hash fragments (for client-side OAuth callbacks)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hasHashParams = hashParams.has('access_token') || hashParams.has('refresh_token') || hashParams.has('error');
      
      if (hasSearchParams) {
        const params = Object.fromEntries(urlParams.entries());
        console.log('[OAUTH] callback=detected search_params=', params);
        
        // Handle server-side OAuth callback
        await this.handleServerSideOAuthCallback(params);
      } else if (hasHashParams) {
        const params = Object.fromEntries(hashParams.entries());
        console.log('[OAUTH] callback=detected hash_params=', params);
        
        // Handle client-side OAuth callback
        await this.handleClientSideOAuthCallback(params);
      } else {
        console.log('[OAUTH] callback=not_detected params=missing');
      }
    } catch (error) {
      console.warn('[OAUTH] Error parsing callback parameters:', error);
      console.log('[OAUTH] callback=not_detected params=missing');
    }
  }

  private async handleServerSideOAuthCallback(_params: Record<string, string>): Promise<void> {
    try {
      console.log('[OAUTH] Handling server-side callback');
      
      // For server-side callbacks, Supabase should have already processed the session
      // We just need to get the current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[OAUTH] Error getting session:', error);
        return;
      }
      
      if (session) {
        console.log('[OAUTH] Session found, updating user state');
        await this.syncAuthenticatedSession(session, 'server_oauth');
      }
    } catch (error) {
      console.error('[OAUTH] Error handling server-side callback:', error);
    }
  }

  private async handleClientSideOAuthCallback(params: Record<string, string>): Promise<void> {
    try {
      console.log('[OAUTH] Handling client-side callback');
      
      if (params.error) {
        console.error('[OAUTH] OAuth error:', params.error);
        return;
      }
      
      if (params.access_token) {
        console.log('[OAUTH] Setting session with access token');
        // Set the session manually for client-side OAuth
        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token || ''
        });
        
        if (error) {
          console.error('[OAUTH] Error setting session:', error);
          return;
        }
        
        if (data.session) {
          console.log('[OAUTH] Session set successfully, updating user state');
          await this.syncAuthenticatedSession(data.session, 'client_oauth');
          console.log('[OAUTH] Auth state synchronized after client-side callback');
          
          // Clear the URL hash to clean up the OAuth parameters
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
      }
    } catch (error) {
      console.error('[OAUTH] Error handling client-side callback:', error);
    }
  }

  // Method to handle guest stone actions
  handleGuestStoneAction(action: string, balance: number, required: number = 1): boolean {
    const hasEnoughStones = balance >= required;
    
    if (hasEnoughStones) {
      console.log(`[GUEST-STONES] balance=${balance} action=${action} result=success`);
      return true;
    } else {
      console.log(`[GUEST-STONES] balance=${balance} action=${action} result=insufficient required=${required}`);
      return false;
    }
  }
}

export const authService = AuthService.getInstance();
