import { supabaseAdmin } from '../config/supabase.js';
import { ProfileDTO } from '../../shared/src/types/dto.js';
import { UpdateProfileRequest } from '../../shared/src/types/api.js';
import { ApiErrorCode } from '../../shared/src/types/api.js';
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
        throw new Error('Profile not found');
      }

      const profile = profiles[0];

      // Update last seen timestamp
      await this.updateLastSeen(authUserId);

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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile with validation
   */
  static async updateProfile(authUserId: string, updateData: UpdateProfileRequest): Promise<ProfileDTO> {
    try {
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

      // Log the action for audit purposes
      console.log(`Sessions revoked for user ${authUserId}, current session ${currentSessionId} preserved`);

      return {
        revokedCount: 2, // Mock return - in real implementation, this would be the actual count
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
        return false;
      }

      // Check if token is expired
      const expiresAt = new Date(csrfToken.expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating CSRF token:', error);
      return false;
    }
  }

  /**
   * Link a cookie group to a user profile (for guest account linking)
   */
  static async linkCookieGroupToUser(authUserId: string, cookieGroupId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .rpc('link_cookie_group_to_user', {
          p_auth_user_id: authUserId,
          p_cookie_group_id: cookieGroupId,
        });

      if (error) {
        throw new Error(`Failed to link cookie group: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to link cookie group: ${error}`);
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