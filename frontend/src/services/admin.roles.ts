/**
 * Roles Admin Service
 * Phase 5: Role management and user permissions
 */

import { supabase } from '@/lib/supabase';

export type AppRole = 'creator' | 'moderator' | 'admin';

export interface UserRole {
  id: string;
  user_id: string;
  roles: AppRole[];
  created_at: string;
  updated_at: string;
  // Joined user data
  user_email?: string;
  user_name?: string;
  last_sign_in?: string;
}

export interface RoleAssignment {
  userId: string;
  role: AppRole;
  assignedBy: string;
  assignedAt: string;
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

export class RolesService {
  /**
   * List all user roles with filters
   */
  async listRoles(filters: RoleFilters = {}): Promise<RoleListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('app_roles')
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data,
          last_sign_in_at
        )
      `, { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.role) {
      query = query.contains('roles', [filters.role]);
    }

    if (filters.q) {
      // Search by email or user ID
      query = query.or(`user_id.ilike.%${filters.q}%,user.email.ilike.%${filters.q}%`);
    }

    // Apply pagination
    const limit = filters.limit || 20;
    if (filters.cursor) {
      query = query.lt('updated_at', filters.cursor);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch roles: ${error.message}`);
    }

    const hasMore = (data || []).length > limit;
    const roles = hasMore ? (data || []).slice(0, limit) : (data || []);
    const nextCursor = hasMore ? roles[roles.length - 1]?.updated_at : undefined;

    // Transform data for display
    const transformedRoles = roles.map(role => ({
      ...role,
      user_email: role.user?.email || 'Unknown',
      user_name: role.user?.raw_user_meta_data?.name || role.user?.email || 'Unknown',
      last_sign_in: role.user?.last_sign_in_at
    }));

    return {
      data: transformedRoles,
      hasMore,
      nextCursor
    };
  }

  /**
   * Get user roles by user ID
   */
  async getUserRoles(userId: string): Promise<UserRole | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('app_roles')
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data,
          last_sign_in_at
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user roles: ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      user_email: data.user?.email || 'Unknown',
      user_name: data.user?.raw_user_meta_data?.name || data.user?.email || 'Unknown',
      last_sign_in: data.user?.last_sign_in_at
    };
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, role: AppRole): Promise<UserRole> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Check if user already has roles
    const existingRoles = await this.getUserRoles(userId);
    
    let newRoles: AppRole[];
    if (existingRoles) {
      // Add role to existing roles if not already present
      newRoles = existingRoles.roles.includes(role) 
        ? existingRoles.roles 
        : [...existingRoles.roles, role];
    } else {
      // Create new role entry
      newRoles = [role];
    }

    const { data, error } = await supabase
      .from('app_roles')
      .upsert({
        user_id: userId,
        roles: newRoles,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data,
          last_sign_in_at
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to assign role: ${error.message}`);
    }

    // Log the role assignment
    await this.logRoleAction(userId, session.user.id, 'assign', role);

    return {
      ...data,
      user_email: data.user?.email || 'Unknown',
      user_name: data.user?.raw_user_meta_data?.name || data.user?.email || 'Unknown',
      last_sign_in: data.user?.last_sign_in_at
    };
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, role: AppRole): Promise<UserRole> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Prevent self-downgrade from admin
    if (session.user.id === userId && role === 'admin') {
      throw new Error('Cannot remove your own admin role');
    }

    // Get current roles
    const existingRoles = await this.getUserRoles(userId);
    if (!existingRoles) {
      throw new Error('User has no roles to remove');
    }

    // Remove role from array
    const newRoles = existingRoles.roles.filter(r => r !== role);
    
    if (newRoles.length === 0) {
      // Remove user from app_roles table entirely
      const { error } = await supabase
        .from('app_roles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to remove role: ${error.message}`);
      }

      // Return empty roles
      return {
        id: '',
        user_id: userId,
        roles: [],
        created_at: '',
        updated_at: new Date().toISOString(),
        user_email: existingRoles.user_email,
        user_name: existingRoles.user_name,
        last_sign_in: existingRoles.last_sign_in
      };
    }

    // Update roles
    const { data, error } = await supabase
      .from('app_roles')
      .update({
        roles: newRoles,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data,
          last_sign_in_at
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to remove role: ${error.message}`);
    }

    // Log the role removal
    await this.logRoleAction(userId, session.user.id, 'remove', role);

    return {
      ...data,
      user_email: data.user?.email || 'Unknown',
      user_name: data.user?.raw_user_meta_data?.name || data.user?.email || 'Unknown',
      last_sign_in: data.user?.last_sign_in_at
    };
  }

  /**
   * Search users by email or ID
   */
  async searchUsers(query: string): Promise<Array<{ id: string; email: string; name?: string }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('auth.users')
      .select('id, email, raw_user_meta_data')
      .or(`email.ilike.%${query}%,id.ilike.%${query}%`)
      .limit(10);

    if (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }

    return (data || []).map(user => ({
      id: user.id,
      email: user.email || '',
      name: user.raw_user_meta_data?.name
    }));
  }

  /**
   * Get role statistics
   */
  async getRoleStats(): Promise<{
    totalUsers: number;
    creators: number;
    moderators: number;
    admins: number;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('app_roles')
      .select('roles');

    if (error) {
      throw new Error(`Failed to fetch role stats: ${error.message}`);
    }

    const stats = {
      totalUsers: data?.length || 0,
      creators: 0,
      moderators: 0,
      admins: 0
    };

    (data || []).forEach(role => {
      if (role.roles.includes('creator')) stats.creators++;
      if (role.roles.includes('moderator')) stats.moderators++;
      if (role.roles.includes('admin')) stats.admins++;
    });

    return stats;
  }

  /**
   * Log role actions for audit trail
   */
  private async logRoleAction(
    targetUserId: string,
    actorId: string,
    action: 'assign' | 'remove',
    role: AppRole
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('role_actions')
      .insert({
        target_user_id: targetUserId,
        actor_id: actorId,
        action,
        role,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log role action:', error);
      // Don't throw here as it's not critical
    }
  }

  /**
   * Get role action history
   */
  async getRoleActions(userId?: string): Promise<Array<{
    id: string;
    target_user_id: string;
    actor_id: string;
    action: string;
    role: AppRole;
    created_at: string;
    actor_name?: string;
    target_name?: string;
  }>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('role_actions')
      .select(`
        *,
        actor:actor_id (
          id,
          email,
          raw_user_meta_data
        ),
        target:target_user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('target_user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch role actions: ${error.message}`);
    }

    return (data || []).map(action => ({
      ...action,
      actor_name: action.actor?.email || action.actor?.raw_user_meta_data?.name || 'Unknown',
      target_name: action.target?.email || action.target?.raw_user_meta_data?.name || 'Unknown'
    }));
  }
}

export const rolesService = new RolesService();




