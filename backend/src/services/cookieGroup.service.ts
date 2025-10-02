import { supabaseAdmin } from './supabase.js';
import type { CookieGroup, CookieGroupMember } from 'shared';

export interface LinkDeviceToUserParams {
  userId: string;
  deviceCookieId: string;
}

export class CookieGroupService {
  /**
   * Create a new cookie group with a member and guest wallet
   */
  static async createCookieGroupWithMember(
    cookieId: string,
    deviceLabel?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabaseAdmin.rpc('create_cookie_group_with_member', {
        p_cookie_id: cookieId,
        p_device_label: deviceLabel,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cookie group with member:', error);
      throw error;
    }
  }

  /**
   * Get the cookie group for a given cookie ID
   */
  static async getCookieGroupByCookieId(cookieId: string): Promise<CookieGroup | null> {
    try {
      // First get the group_id from cookie_group_members
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('cookie_group_members')
        .select('group_id')
        .eq('cookie_id', cookieId)
        .single();

      if (memberError) {
        if (memberError.code === 'PGRST116') return null; // No rows returned
        throw memberError;
      }

      // Then get the group details
      const { data, error } = await supabaseAdmin
        .from('cookie_groups')
        .select(`
          id,
          user_id,
          created_at,
          updated_at
        `)
        .eq('id', memberData.group_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching cookie group for cookie ${cookieId}:`, error);
      throw error;
    }
  }

  /**
   * Get the canonical group for a user (the group with user_id set)
   */
  static async getUserCanonicalGroup(userId: string): Promise<CookieGroup | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('cookie_groups')
        .select(`
          id,
          user_id,
          created_at,
          updated_at
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching canonical group for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Link a device to a user (internal function for auth callback)
   * This handles both new users and merging existing groups
   */
  static async linkDeviceToUser(params: LinkDeviceToUserParams): Promise<CookieGroup> {
    const { userId, deviceCookieId } = params;

    try {
      // Get the device's current group
      const deviceGroup = await this.getCookieGroupByCookieId(deviceCookieId);
      if (!deviceGroup) {
        throw new Error('Device cookie group not found');
      }

      // If the device group is already linked to this user, return it (idempotent)
      if (deviceGroup.user_id === userId) {
        return deviceGroup;
      }

      // Get the user's canonical group (if any)
      const canonicalGroup = await this.getUserCanonicalGroup(userId);

      if (!canonicalGroup) {
        // New user - set this device's group as canonical
        const { data, error } = await supabaseAdmin
          .from('cookie_groups')
          .update({ user_id: userId })
          .eq('id', deviceGroup.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Existing user - merge device group into canonical group
        await supabaseAdmin.rpc('merge_cookie_groups', {
          p_source_group_id: deviceGroup.id,
          p_target_group_id: canonicalGroup.id,
        });

        return canonicalGroup;
      }
    } catch (error) {
      console.error('Error linking device to user:', error);
      throw error;
    }
  }

  /**
   * Get all guest games for a cookie group
   */
  static async getGuestGamesForGroup(groupId: string): Promise<Array<{ game_id: string; cookie_id: string }>> {
    try {
      const { data, error } = await supabaseAdmin.rpc('get_guest_games_for_group', {
        p_group_id: groupId,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error fetching guest games for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Get all members of a cookie group
   */
  static async getGroupMembers(groupId: string): Promise<CookieGroupMember[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('cookie_group_members')
        .select(`
          cookie_id,
          group_id,
          device_label,
          last_seen_at,
          created_at
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error fetching group members for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Update last seen timestamp for a cookie group member
   */
  static async updateMemberLastSeen(cookieId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('cookie_group_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('cookie_id', cookieId);

      if (error) throw error;
    } catch (error) {
      console.error(`Error updating last seen for cookie ${cookieId}:`, error);
      throw error;
    }
  }

  /**
   * Get guest stone wallet for a group
   */
  static async getGuestWallet(groupId: string): Promise<{ group_id: string; casting_stones: number; updated_at: string } | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('guest_stone_wallets')
        .select('*')
        .eq('group_id', groupId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`Error fetching guest wallet for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Update guest stone wallet balance
   */
  static async updateGuestWalletBalance(
    groupId: string,
    castingStones: number
  ): Promise<{ group_id: string; casting_stones: number; updated_at: string }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('guest_stone_wallets')
        .update({ casting_stones: castingStones })
        .eq('group_id', groupId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error updating guest wallet for group ${groupId}:`, error);
      throw error;
    }
  }
}
