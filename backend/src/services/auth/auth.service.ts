/**
 * Unified Authentication Service
 * Abstracts Supabase provider behind generic interface
 * 
 * Reference: CHIMERA_ARCHITECTURE_SPEC.md Section 3.1 (Routes -> Service -> Repo)
 * 
 * This is the ONLY file that should import @supabase/supabase-js for auth purposes.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { supabaseAdmin } from '../supabase.js';
import { ensureProfile } from '../profileBootstrap.js';
import { CookieUserLinkingService } from '../cookie-user-linking.service.js';
import type { Request } from 'express';

// Create Supabase client for JWT verification
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  isGuest: boolean;
  roles: string[];
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export interface RoleCheckResult {
  hasRole: boolean;
  roles: string[];
}

export class AuthService {
  /**
   * Validate JWT token from Authorization header
   * @param token - Bearer token (without "Bearer " prefix)
   * @returns Validation result with user data if valid
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return {
          valid: false,
          error: error?.message || 'Invalid or expired token'
        };
      }

      // Get user roles
      const roles = await this.getUserRoles(user.id);

      // Get display name from metadata or email
      const displayName = user.user_metadata?.display_name || 
                         user.user_metadata?.name || 
                         user.email?.split('@')[0];

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          displayName,
          isGuest: false,
          roles
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Get user profile by ID
   * @param userId - User UUID
   * @returns User profile with roles
   */
  async getUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      // Get roles first (this will check all sources)
      const roles = await this.getUserRoles(userId);

      // Try to get email from profiles table
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      // If profile exists, try to get user metadata from auth
      // Note: We can't easily get email without admin API, so we'll use userId as fallback
      let email: string | undefined;
      let displayName: string | undefined;

      try {
        // Try to get user from auth (this requires admin API)
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!userError && user) {
          email = user.email;
          displayName = user.user_metadata?.display_name || 
                       user.user_metadata?.name || 
                       user.email?.split('@')[0];
        }
      } catch (error) {
        // If admin API fails, continue without email/displayName
        console.warn('[AuthService] Could not fetch user email from auth:', error);
      }

      return {
        id: userId,
        email,
        displayName,
        isGuest: false,
        roles
      };
    } catch (error) {
      console.error('[AuthService] Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Check if user has specific permission/role
   * @param userId - User UUID
   * @param requiredRole - Role to check (e.g., 'admin', 'moderator', 'creator')
   * @returns Role check result
   */
  async checkPermission(userId: string, requiredRole: string): Promise<RoleCheckResult> {
    const roles = await this.getUserRoles(userId);
    const hasRole = roles.includes(requiredRole);

    return {
      hasRole,
      roles
    };
  }

  /**
   * Get all roles for a user
   * Checks multiple sources: app_roles, profiles, user_profiles, user_metadata
   * @param userId - User UUID
   * @returns Array of role names
   */
  async getUserRoles(userId: string): Promise<string[]> {
    const roles: string[] = [];

    try {
      // 1. Check app_roles table (Phase 5+ - one row per role)
      const { data: appRoles, error: appRolesError } = await supabaseAdmin
        .from('app_roles')
        .select('role')
        .eq('user_id', userId);

      if (!appRolesError && appRoles && appRoles.length > 0) {
        // app_roles has one row per role, extract all roles
        const roleNames = appRoles.map((row: { role: string }) => row.role);
        roles.push(...roleNames);
      }

      // 2. Check profiles table (Phase 0 - single role)
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!profileError && profile && profile.role) {
        if (!roles.includes(profile.role)) {
          roles.push(profile.role);
        }
      }

      // 3. Fallback to legacy user_profiles table
      if (profileError || !profile) {
        const { data: legacyProfile, error: legacyError } = await supabaseAdmin
          .from('user_profiles')
          .select('role')
          .eq('auth_user_id', userId)
          .single();

        if (!legacyError && legacyProfile && legacyProfile.role) {
          // Map legacy roles
          const legacyRole = legacyProfile.role;
          if (legacyRole === 'prompt_admin') {
            if (!roles.includes('admin')) {
              roles.push('admin');
            }
          } else if (!roles.includes(legacyRole)) {
            roles.push(legacyRole);
          }
        }
      }

      // 4. Fallback to user_metadata (lowest priority)
      if (roles.length === 0) {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!userError && user?.user_metadata?.role) {
          const metadataRole = user.user_metadata.role;
          if (!roles.includes(metadataRole)) {
            roles.push(metadataRole);
          }
        }
      }
    } catch (error) {
      console.error('[AuthService] Error getting user roles:', error);
    }

    return roles;
  }

  /**
   * Check if user is admin (convenience method)
   * @param userId - User UUID
   * @returns true if user has admin role
   */
  async isAdmin(userId: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.includes('admin') || roles.includes('system');
  }

  /**
   * Bootstrap user profile (idempotent)
   * Ensures profile row exists in database
   * @param userId - User UUID
   */
  async bootstrapProfile(userId: string): Promise<void> {
    try {
      await ensureProfile(userId);
    } catch (error) {
      // Log but don't throw - profile bootstrap is best-effort
      console.error('[AuthService] Failed to bootstrap profile:', error);
    }
  }

  /**
   * Validate guest cookie
   * @param guestCookieId - Guest cookie UUID
   * @returns User ID if cookie is linked to authenticated user, null if pure guest
   */
  async validateGuestCookie(guestCookieId: string): Promise<string | null> {
    try {
      const userId = await CookieUserLinkingService.getUserIdFromCookie(guestCookieId);
      return userId;
    } catch (error) {
      console.error('[AuthService] Error validating guest cookie:', error);
      return null;
    }
  }

  /**
   * Create auth context from request
   * Handles both Bearer tokens and guest cookies
   * @param req - Express request object
   * @returns Auth context
   */
  async getAuthContext(req: Request): Promise<AuthContext> {
    const authHeader = req.headers.authorization;
    const guestCookieId = req.cookies?.guestId || req.headers['x-guest-cookie-id'] as string;

    // Try Bearer token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const result = await this.validateToken(token);

      if (result.valid && result.user) {
        // Bootstrap profile
        await this.bootstrapProfile(result.user.id);

        return {
          user: result.user,
          isAuthenticated: true,
          isGuest: false
        };
      }
    }

    // Fall back to guest cookie
    if (guestCookieId) {
      const linkedUserId = await this.validateGuestCookie(guestCookieId);

      if (linkedUserId) {
        // Cookie is linked to authenticated user
        const user = await this.getUserProfile(linkedUserId);
        if (user) {
          return {
            user,
            isAuthenticated: true,
            isGuest: false
          };
        }
      }

      // Pure guest user
      return {
        user: {
          id: guestCookieId,
          isGuest: true,
          roles: []
        },
        isAuthenticated: false,
        isGuest: true
      };
    }

    // No auth - create new guest context
    return {
      user: null,
      isAuthenticated: false,
      isGuest: true
    };
  }
}

// Singleton instance
export const authService = new AuthService();

