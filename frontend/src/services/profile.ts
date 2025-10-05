import { apiFetch, apiPost, apiPut } from '../lib/api';
import type { ProfileDTO, UpdateProfileRequest } from 'shared';

export interface ProfileAccessInfo {
  canAccess: boolean;
  isGuest: boolean;
  userId: string;
  requiresAuth: boolean;
}

export interface GuestLinkResult {
  success: boolean;
  alreadyLinked: boolean;
  message: string;
  migrationSummary?: {
    charactersMigrated: number;
    gamesMigrated: number;
    stonesMigrated: number;
    ledgerEntriesCreated: number;
  };
}

export interface GuestAccountSummary {
  cookieGroupId: string;
  deviceLabel?: string;
  createdAt: string;
  lastSeen: string;
  characterCount: number;
  gameCount: number;
  stoneBalance: number;
  hasData: boolean;
}

export interface CSRFTokenResponse {
  csrfToken: string;
}

export interface SessionRevocationResult {
  revokedCount: number;
  currentSessionPreserved: boolean;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UserSessions {
  totalSessions: number;
  currentSessionId?: string;
  sessions: SessionInfo[];
}

export class ProfileService {
  /**
   * Check if user can access gated profile features
   */
  static async checkAccess(): Promise<{ ok: true; data: ProfileAccessInfo } | { ok: false; error: any }> {
    return apiFetch<ProfileAccessInfo>('/api/profile/access');
  }

  /**
   * Get current user's profile
   */
  static async getProfile(): Promise<{ ok: true; data: ProfileDTO } | { ok: false; error: any }> {
    return apiFetch<ProfileDTO>('/api/profile');
  }

  /**
   * Update user profile
   */
  static async updateProfile(updateData: UpdateProfileRequest, csrfToken?: string): Promise<{ ok: true; data: ProfileDTO } | { ok: false; error: any }> {
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return apiPut<ProfileDTO>('/api/profile', updateData, headers);
  }

  /**
   * Generate CSRF token for profile updates
   */
  static async generateCSRFToken(): Promise<{ ok: true; data: CSRFTokenResponse } | { ok: false; error: any }> {
    return apiPost<CSRFTokenResponse>('/api/profile/csrf-token', {});
  }

  /**
   * Revoke other sessions
   */
  static async revokeOtherSessions(csrfToken: string): Promise<{ ok: true; data: SessionRevocationResult } | { ok: false; error: any }> {
    return apiPost<SessionRevocationResult>('/api/profile/revoke-sessions', { csrfToken });
  }

  /**
   * Link guest account to authenticated user
   */
  static async linkGuestAccount(cookieGroupId: string): Promise<{ ok: true; data: GuestLinkResult } | { ok: false; error: any }> {
    return apiPost<GuestLinkResult>('/api/profile/link-guest', { cookieGroupId });
  }

  /**
   * Get guest profile by cookie ID
   */
  static async getGuestProfile(cookieId: string): Promise<{ ok: true; data: any } | { ok: false; error: any }> {
    return apiFetch(`/api/profile/guest/${cookieId}`);
  }

  /**
   * Create new guest profile
   */
  static async createGuestProfile(cookieId: string, deviceLabel?: string): Promise<{ ok: true; data: any } | { ok: false; error: any }> {
    return apiPost('/api/profile/guest', { cookieId, deviceLabel });
  }

  /**
   * Get guest account summary before linking
   */
  static async getGuestAccountSummary(cookieGroupId: string): Promise<{ ok: true; data: GuestAccountSummary } | { ok: false; error: any }> {
    return apiFetch<GuestAccountSummary>(`/api/profile/guest-summary/${cookieGroupId}`);
  }

}
