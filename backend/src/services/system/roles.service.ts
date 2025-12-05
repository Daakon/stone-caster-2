/**
 * Roles Service
 * Phase 3.7: Backend-for-Frontend (BFF) for Role Management
 * Handles role queries and updates using supabaseAdmin (Service Role)
 */

import { supabaseAdmin } from '../supabase.js';

export type AppRole = 'creator' | 'moderator' | 'admin';

export interface UserRole {
  id: string;
  user_id: string;
  role: string; // Single role string from profiles.role
  roles: AppRole[]; // Array format for UI compatibility (derived from role)
  is_verified_creator?: boolean; // NEW: Verified creator flag for auto-approval
  created_at: string;
  updated_at: string;
  // Joined user data from profiles_view
  email?: string;
  user_email?: string; // Alias for email (for backward compatibility)
  user_name?: string;
  last_sign_in?: string;
  last_sign_in_at?: string;
}

export interface RoleFilters {
  role?: AppRole;
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface RoleListResponse {
  data: UserRole[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface RoleStats {
  totalUsers: number;
  creators: number;
  moderators: number;
  admins: number;
}

/**
 * Map single role string to roles array for UI compatibility
 */
function mapRoleToArray(role: string | null | undefined): AppRole[] {
  if (!role) return [];
  if (role === 'admin') return ['admin'];
  if (role === 'moderator') return ['moderator'];
  if (role === 'creator' || role === 'early_access' || role === 'member') return ['creator'];
  return [];
}

/**
 * Transform profile data from profiles_view to UserRole format
 */
function transformProfile(profile: any): UserRole {
  const role = profile.role || 'pending';
  const rolesArray = mapRoleToArray(role);

  return {
    id: profile.id,
    user_id: profile.id,
    role: role,
    roles: rolesArray,
    is_verified_creator: profile.is_verified_creator || false, // NEW: Include verified creator flag
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
    email: profile.email,
    user_email: profile.email, // Alias for backward compatibility
    user_name: profile.raw_user_meta_data?.name || profile.email || 'Unknown',
    last_sign_in: profile.last_sign_in_at,
    last_sign_in_at: profile.last_sign_in_at
  };
}

export class RolesService {
  /**
   * List all user roles with filters
   * Uses profiles_view to get role and email in a single query
   * Falls back to separate queries if view is unavailable
   */
  async listRoles(filters: RoleFilters = {}): Promise<RoleListResponse> {
    try {
      let query = supabaseAdmin
        .from('profiles_view')
        .select('*', { count: 'exact' })
        .order('updated_at', { ascending: false });

      // Apply filters
      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.q) {
        // Search by email or user ID
        query = query.or(`id.ilike.%${filters.q}%,email.ilike.%${filters.q}%`);
      }

      // Apply pagination
      const limit = filters.limit || 20;
      if (filters.cursor) {
        query = query.lt('updated_at', filters.cursor);
      }
      query = query.limit(limit + 1);

      const { data, error } = await query;

      if (error) {
        console.error('❌ Database Error in listRoles (profiles_view):', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });

        // Fallback: If view doesn't exist, fetch from profiles and users separately
        const isViewMissing = error.code === 'PGRST204' || 
                             error.code === '42P01' ||
                             error.message?.toLowerCase().includes('does not exist') ||
                             error.message?.toLowerCase().includes('relation');

        if (isViewMissing) {
          console.warn('⚠️  profiles_view not found, falling back to separate queries');
          return await this.listRolesFallback(filters);
        }

        throw new Error(`Database error: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
      }

      const hasMore = (data || []).length > limit;
      const roles = hasMore ? (data || []).slice(0, limit) : (data || []);

      // Transform data for display
      const transformedRoles: UserRole[] = roles.map(transformProfile);

      return {
        data: transformedRoles,
        hasMore,
        nextCursor: hasMore ? roles[roles.length - 1]?.updated_at : undefined
      };
    } catch (err) {
      console.error('🔥 Critical Error in RolesService.listRoles:', err);
      throw err; // Propagate to controller to send 500
    }
  }

  /**
   * Fallback method: Fetch roles from profiles and users separately
   * Used when profiles_view is not available
   */
  private async listRolesFallback(filters: RoleFilters = {}): Promise<RoleListResponse> {
    try {
      // Fetch profiles (id, role only - no updated_at dependency)
      let profilesQuery = supabaseAdmin
        .from('profiles')
        .select('id, role');

      if (filters.role) {
        profilesQuery = profilesQuery.eq('role', filters.role);
      }

      if (filters.q) {
        profilesQuery = profilesQuery.ilike('id', `%${filters.q}%`);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;

      if (profilesError) {
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      }

      // Fetch users to get email and timestamps
      const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

      if (usersError) {
        throw new Error(`Failed to fetch users: ${usersError.message}`);
      }

      // Combine profiles with user data
      const combined = (profiles || []).map(profile => {
        const user = users?.find(u => u.id === profile.id);
        return {
          id: profile.id,
          role: profile.role || 'pending',
          updated_at: user?.updated_at || user?.created_at || new Date().toISOString(),
          created_at: user?.created_at || new Date().toISOString(),
          email: user?.email || null,
          last_sign_in_at: user?.last_sign_in_at || null,
          raw_user_meta_data: user?.user_metadata || {}
        };
      });

      // Apply email search filter if needed
      let filtered = combined;
      if (filters.q) {
        const searchLower = filters.q.toLowerCase();
        filtered = combined.filter(item => 
          item.email?.toLowerCase().includes(searchLower) ||
          item.id.toLowerCase().includes(searchLower)
        );
      }

      // Sort by updated_at descending
      filtered.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      // Apply pagination
      const limit = filters.limit || 20;
      const hasMore = filtered.length > limit;
      const roles = hasMore ? filtered.slice(0, limit) : filtered;
      const nextCursor = hasMore ? roles[roles.length - 1]?.updated_at : undefined;

      // Transform data for display
      const transformedRoles: UserRole[] = roles.map(transformProfile);

      return {
        data: transformedRoles,
        hasMore,
        nextCursor
      };
    } catch (err) {
      console.error('🔥 Critical Error in RolesService.listRolesFallback:', err);
      throw err;
    }
  }

  /**
   * Get user roles by user ID
   * Uses profiles_view to get role and email
   */
  async getUserRoles(userId: string): Promise<UserRole | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles_view')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Database Error in getUserRoles:', {
          code: error.code,
          message: error.message,
          details: error.details,
          userId
        });
        throw new Error(`Failed to fetch user roles: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
      }

      if (!data) return null;

      return transformProfile(data);
    } catch (err) {
      console.error('🔥 Critical Error in RolesService.getUserRoles:', err);
      throw err;
    }
  }

  /**
   * Update user role
   * Updates profiles.role directly (single role string)
   */
  async updateRole(userId: string, role: AppRole): Promise<UserRole> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        role: role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }

    // Fetch updated profile with email from view
    const updatedProfile = await this.getUserRoles(userId);
    if (!updatedProfile) {
      throw new Error('Failed to fetch updated profile');
    }

    return updatedProfile;
  }

  /**
   * Remove role from user (set to 'pending')
   */
  async removeRole(userId: string, role: AppRole): Promise<UserRole> {
    // Get current role
    const existingProfile = await this.getUserRoles(userId);
    if (!existingProfile) {
      throw new Error('User has no profile');
    }

    // If removing the current role, set to 'pending'
    if (existingProfile.role === role) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          role: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to remove role: ${error.message}`);
      }

      // Fetch updated profile
      const updatedProfile = await this.getUserRoles(userId);
      if (!updatedProfile) {
        throw new Error('Failed to fetch updated profile');
      }

      return updatedProfile;
    } else {
      // Role doesn't match, nothing to remove
      return existingProfile;
    }
  }

  /**
   * Search users by email or ID
   * Uses profiles_view to get users with emails
   */
  async searchUsers(query: string): Promise<Array<{ id: string; email: string; name?: string }>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles_view')
        .select('id, email, raw_user_meta_data')
        .or(`email.ilike.%${query}%,id.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('❌ Database Error in searchUsers:', {
          code: error.code,
          message: error.message,
          details: error.details,
          query
        });
        throw new Error(`Failed to search users: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
      }

      return (data || []).map(user => ({
        id: user.id,
        email: user.email || '',
        name: user.raw_user_meta_data?.name
      }));
    } catch (err) {
      console.error('🔥 Critical Error in RolesService.searchUsers:', err);
      throw err;
    }
  }

  /**
   * Toggle verified creator status for a user
   * Allows admins to grant/revoke auto-approval publishing privileges
   */
  async toggleVerifiedStatus(userId: string, isVerified: boolean): Promise<UserRole> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_verified_creator: isVerified,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update verified status: ${error.message}`);
    }

    // Fetch updated profile with email from view
    const updatedProfile = await this.getUserRoles(userId);
    if (!updatedProfile) {
      throw new Error('Failed to fetch updated profile');
    }

    return updatedProfile;
  }

  /**
   * Get role statistics
   * Counts roles from profiles_view
   */
  async getStats(): Promise<RoleStats> {
    try {
      // Get all profiles with roles
      const { data, error } = await supabaseAdmin
        .from('profiles_view')
        .select('role');

      if (error) {
        console.error('❌ Database Error in getStats:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Failed to fetch role stats: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
      }

      const stats: RoleStats = {
        totalUsers: data?.length || 0,
        creators: 0,
        moderators: 0,
        admins: 0
      };

      (data || []).forEach(profile => {
        const role = profile.role;
        if (role === 'creator' || role === 'early_access' || role === 'member') {
          stats.creators++;
        } else if (role === 'moderator') {
          stats.moderators++;
        } else if (role === 'admin') {
          stats.admins++;
        }
      });

      return stats;
    } catch (err) {
      console.error('🔥 Critical Error in RolesService.getStats:', err);
      throw err; // Propagate to controller to send 500
    }
  }
}

export const rolesService = new RolesService();

