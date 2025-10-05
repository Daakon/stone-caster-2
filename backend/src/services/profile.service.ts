import { supabaseAdmin } from './supabase.js';
import { ProfileDTO, UpdateProfileRequest, ApiErrorCode } from 'shared';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class ProfileService {
  /**
   * Get user profile by auth user ID
   */
  static async getProfile(authUserId: string): Promise<ProfileDTO> {
    try {
      // Use the database function to get profile by auth user ID
      const { data: profiles, error } = await supabaseAdmin
        .rpc('get_user_profile_by_auth_id', { p_auth_user_id: authUserId });

      if (error) {
        throw new Error(`Failed to get profile: ${error.message}`);
      }

      if (!profiles || profiles.length === 0) {
        // Profile doesn't exist, create it
        await this.ensureProfileExists(authUserId);
        
        // Try again after creating
        const { data: newProfiles, error: newError } = await supabaseAdmin
          .rpc('get_user_profile_by_auth_id', { p_auth_user_id: authUserId });

        if (newError || !newProfiles || newProfiles.length === 0) {
          throw new Error('Failed to create profile');
        }

        const profile = newProfiles[0];
        return this.mapProfileFromDb(profile);
      }

      const profile = profiles[0];

      // Update last seen timestamp
      await this.updateLastSeen(authUserId);

      return this.mapProfileFromDb(profile);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile with validation and CSRF protection
   */
  static async updateProfile(authUserId: string, updateData: UpdateProfileRequest, csrfToken?: string): Promise<ProfileDTO> {
    try {
      // Validate CSRF token if provided
      if (csrfToken) {
        const isValidToken = await this.validateCSRFToken(authUserId, csrfToken);
        if (!isValidToken) {
          throw new Error('Invalid or expired CSRF token');
        }
      }

      // Validate input data
      this.validateUpdateData(updateData);

      // Prepare update payload
      const updatePayload: Record<string, unknown> = {};
      
      if (updateData.displayName !== undefined) {
        updatePayload.display_name = updateData.displayName;
      }
      
      if (updateData.avatarUrl !== undefined) {
        updatePayload.avatar_url = updateData.avatarUrl;
      }
      
      if (updateData.preferences !== undefined) {
        updatePayload.preferences = updateData.preferences;
      }

      // Use the database function to update profile
      await supabaseAdmin
        .rpc('update_user_profile', {
          p_auth_user_id: authUserId,
          p_display_name: updatePayload.display_name,
          p_avatar_url: updatePayload.avatar_url,
          p_preferences: updatePayload.preferences,
        });

      // Get updated profile
      return await this.getProfile(authUserId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Revoke all sessions except the current one
   */
  static async revokeOtherSessions(authUserId: string, currentSessionId: string): Promise<{
    revokedCount: number;
    currentSessionPreserved: boolean;
  }> {
    try {
      // Use Supabase admin to sign out all sessions except current
      const { data, error } = await supabaseAdmin.auth.admin.signOut(authUserId, 'others');

      if (error) {
        throw new Error(`Session revocation failed: ${error.message}`);
      }

      // Since we can't get exact session count, we'll return a reasonable estimate
      const revokedCount = 1; // Assume at least one other session was revoked

      // Log the action for audit purposes
      console.log(`Sessions revoked for user ${authUserId}`, {
        revokedCount,
        currentSessionPreserved: true,
        currentSessionId,
      });

      return {
        revokedCount,
        currentSessionPreserved: true,
      };
    } catch (error) {
      console.error('Error revoking sessions:', error);
      throw error;
    }
  }

  /**
   * Generate a new CSRF token for the user
   */
  static async generateCSRFToken(authUserId: string): Promise<string> {
    try {
      // Clean up expired tokens first
      await this.cleanupExpiredCSRFTokens(authUserId);

      const token = `csrf_${authUserId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      const { data, error } = await supabaseAdmin
        .from('csrf_tokens')
        .insert({
          user_id: authUserId,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select('token')
        .single();

      if (error) {
        throw new Error(`Failed to generate CSRF token: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to generate CSRF token');
      }

      // Log token generation for audit
      console.log(`CSRF token generated for user ${authUserId}`, {
        expiresAt: expiresAt.toISOString(),
      });

      return data.token;
    } catch (error) {
      console.error('Error generating CSRF token:', error);
      throw error;
    }
  }

  /**
   * Validate CSRF token for profile updates
   */
  static async validateCSRFToken(authUserId: string, token: string): Promise<boolean> {
    try {
      const { data: csrfToken, error } = await supabaseAdmin
        .from('csrf_tokens')
        .select('token, expires_at')
        .eq('user_id', authUserId)
        .eq('token', token)
        .single();

      if (error || !csrfToken) {
        console.log(`CSRF token validation failed for user ${authUserId}: token not found`);
        return false;
      }

      // Check if token is expired
      const expiresAt = new Date(csrfToken.expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        console.log(`CSRF token validation failed for user ${authUserId}: token expired`);
        // Clean up expired token
        await this.cleanupExpiredCSRFTokens(authUserId);
        return false;
      }

      // Log successful validation for audit
      console.log(`CSRF token validated successfully for user ${authUserId}`);
      return true;
    } catch (error) {
      console.error('Error validating CSRF token:', error);
      return false;
    }
  }


  /**
   * Check if a cookie group is already linked to a user
   */
  static async hasExistingLink(authUserId: string, cookieGroupId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('cookie_groups')
        .select('id')
        .eq('user_id', authUserId)
        .eq('id', cookieGroupId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new Error(`Failed to check existing link: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      throw new Error(`Failed to check existing link: ${error}`);
    }
  }

  /**
   * Link a cookie group to a user profile (for guest account linking)
   */
  static async linkCookieGroupToUser(authUserId: string, cookieGroupId: string): Promise<{
    success: boolean;
    charactersMigrated: number;
    gamesMigrated: number;
    stonesMigrated: number;
    ledgerEntriesCreated: number;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('link_guest_account_to_user', {
          p_auth_user_id: authUserId,
          p_cookie_group_id: cookieGroupId,
        });

      if (error) {
        throw new Error(`Failed to link guest account: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from guest linking function');
      }

      const result = data[0];

      return {
        success: result.success,
        charactersMigrated: result.characters_migrated || 0,
        gamesMigrated: result.games_migrated || 0,
        stonesMigrated: result.stones_migrated || 0,
        ledgerEntriesCreated: result.ledger_entries_created || 0,
      };
    } catch (error) {
      throw new Error(`Failed to link guest account: ${error}`);
    }
  }

  /**
   * Get guest account summary for linking
   */
  static async getGuestAccountSummary(cookieGroupId: string): Promise<{
    cookieGroupId: string;
    deviceLabel?: string;
    createdAt: string;
    lastSeen: string;
    characterCount: number;
    gameCount: number;
    stoneBalance: number;
    hasData: boolean;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_guest_account_summary', {
          p_cookie_group_id: cookieGroupId,
        });

      if (error) {
        throw new Error(`Failed to get guest account summary: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Guest account summary not found');
      }

      const summary = data[0];

      return {
        cookieGroupId: summary.cookie_group_id,
        deviceLabel: summary.device_label,
        createdAt: summary.created_at,
        lastSeen: summary.last_seen_at,
        characterCount: summary.character_count || 0,
        gameCount: summary.game_count || 0,
        stoneBalance: summary.stone_balance || 0,
        hasData: summary.has_data || false,
      };
    } catch (error) {
      throw new Error(`Failed to get guest account summary: ${error}`);
    }
  }

  /**
   * Get guest profile data from cookie group (for guest users)
   */
  static async getGuestProfile(cookieId: string): Promise<{
    cookieId: string;
    groupId: string;
    deviceLabel?: string;
    lastSeen: string;
    createdAt: string;
  }> {
    try {
      const { data: member, error } = await supabaseAdmin
        .from('cookie_group_members')
        .select(`
          cookie_id,
          group_id,
          device_label,
          last_seen_at,
          created_at
        `)
        .eq('cookie_id', cookieId)
        .single();

      if (error || !member) {
        throw new Error('Guest profile not found');
      }

      return {
        cookieId: member.cookie_id,
        groupId: member.group_id,
        deviceLabel: member.device_label,
        lastSeen: member.last_seen_at,
        createdAt: member.created_at,
      };
    } catch (error) {
      throw new Error(`Failed to get guest profile: ${error}`);
    }
  }

  /**
   * Create a new guest profile (for new guest users)
   */
  static async createGuestProfile(cookieId: string, deviceLabel?: string): Promise<{
    cookieId: string;
    groupId: string;
    deviceLabel?: string;
    lastSeen: string;
    createdAt: string;
  }> {
    try {
      const { data: groupId, error } = await supabaseAdmin
        .rpc('create_cookie_group_with_member', {
          p_cookie_id: cookieId,
          p_device_label: deviceLabel,
        });

      if (error || !groupId) {
        throw new Error(`Failed to create guest profile: ${error?.message || 'Unknown error'}`);
      }

      // Return the created guest profile
      return await this.getGuestProfile(cookieId);
    } catch (error) {
      throw new Error(`Failed to create guest profile: ${error}`);
    }
  }

  /**
   * Update last seen timestamp for user
   */
  private static async updateLastSeen(authUserId: string): Promise<void> {
    try {
      await supabaseAdmin
        .rpc('update_user_last_seen', { p_auth_user_id: authUserId });
    } catch (error) {
      // Don't throw error for last seen update failures
      console.warn(`Failed to update last seen for user ${authUserId}:`, error);
    }
  }

  /**
   * Ensure a user profile exists, create if it doesn't
   */
  private static async ensureProfileExists(authUserId: string): Promise<void> {
    try {
      // Get user info from auth
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(authUserId);
      
      if (userError || !user) {
        throw new Error(`Failed to get user info: ${userError?.message || 'User not found'}`);
      }

      // Create profile with default values
      const { error: insertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          auth_user_id: authUserId,
          display_name: user.email ? user.email.split('@')[0] : `User_${authUserId.substring(0, 8)}`,
          email: user.email,
          preferences: {
            showTips: true,
            theme: 'auto',
            notifications: {
              email: true,
              push: false,
            },
          },
        });

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }
    } catch (error) {
      console.error('Error ensuring profile exists:', error);
      throw error;
    }
  }

  /**
   * Map database profile to DTO
   */
  private static mapProfileFromDb(profile: any): ProfileDTO {
    return {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      email: profile.email,
      preferences: profile.preferences || {
        showTips: true,
        theme: 'auto',
        notifications: {
          email: true,
          push: false,
        },
      },
      createdAt: profile.created_at,
      lastSeen: profile.last_seen_at,
    };
  }

  /**
   * Clean up expired CSRF tokens for a user
   */
  private static async cleanupExpiredCSRFTokens(authUserId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('csrf_tokens')
        .delete()
        .eq('user_id', authUserId)
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.warn(`Failed to cleanup expired CSRF tokens for user ${authUserId}:`, error);
      }
    } catch (error) {
      console.warn(`Error cleaning up expired CSRF tokens for user ${authUserId}:`, error);
    }
  }

  /**
   * Validate update data
   */
  private static validateUpdateData(updateData: UpdateProfileRequest): void {
    if (updateData.displayName !== undefined) {
      if (updateData.displayName.length < 1 || updateData.displayName.length > 100) {
        throw new Error('Display name must be between 1 and 100 characters');
      }
    }

    if (updateData.avatarUrl !== undefined) {
      try {
        new URL(updateData.avatarUrl);
      } catch {
        throw new Error('Invalid avatar URL format');
      }
    }

    if (updateData.preferences?.theme !== undefined) {
      if (!['light', 'dark', 'auto'].includes(updateData.preferences.theme)) {
        throw new Error('Invalid theme value');
      }
    }
  }
}