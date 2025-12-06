/**
 * Roles Admin Service
 * Phase 4.3: Backend-for-Frontend (BFF) - Strictly uses API endpoints
 * All role management operations go through /api/system/roles endpoints
 * NO direct Supabase calls allowed
 */

import { api } from '@/lib/api';

export type AppRole = 'creator' | 'moderator' | 'admin';

export interface UserRole {
  id: string;
  user_id: string;
  role: string;
  roles: AppRole[];
  is_verified_creator?: boolean;
  created_at: string;
  updated_at: string;
  email?: string;
  user_email?: string;
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
 * Build query string from params object
 */
function buildQueryString(params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const RolesService = {
  /**
   * List all user roles with filters
   * Calls backend API endpoint /api/system/roles
   */
  async listRoles(params?: {
    role?: AppRole;
    q?: string;
    limit?: number;
    cursor?: string;
  }): Promise<RoleListResponse> {
    const queryString = buildQueryString(params);
    const url = `/api/system/roles${queryString}`;
    const result = await api.get<RoleListResponse>(url);
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch roles');
    }
    return result.data;
  },

  /**
   * Get role statistics
   * Calls backend API endpoint /api/system/roles/stats
   */
  async getRoleStats(): Promise<RoleStats> {
    const result = await api.get<RoleStats>('/api/system/roles/stats');
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to fetch role stats');
    }
    return result.data;
  },

  /**
   * Assign role to user
   * Calls backend API endpoint /api/system/roles/:id/assign
   */
  async assignRole(userId: string, role: AppRole): Promise<UserRole> {
    const result = await api.post<UserRole>(`/api/system/roles/${userId}/assign`, { role });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to assign role');
    }
    return result.data;
  },

  /**
   * Remove role from user
   * Calls backend API endpoint /api/system/roles/:id/remove
   */
  async removeRole(userId: string, role: AppRole): Promise<UserRole> {
    const result = await api.post<UserRole>(`/api/system/roles/${userId}/remove`, { role });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to remove role');
    }
    return result.data;
  },

  /**
   * Search users by email or ID
   * Calls backend API endpoint /api/system/roles/search
   */
  async searchUsers(query: string): Promise<Array<{ id: string; email: string; name?: string }>> {
    const result = await api.get<Array<{ id: string; email: string; name?: string }>>(
      `/api/system/roles/search?q=${encodeURIComponent(query)}`
    );
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to search users');
    }
    return result.data;
  },

  /**
   * Toggle verified creator status
   * Calls backend API endpoint /api/system/roles/:id/toggle-verified
   */
  async toggleVerifiedStatus(userId: string, isVerified: boolean): Promise<UserRole> {
    const result = await api.post<UserRole>(`/api/system/roles/${userId}/toggle-verified`, { 
      is_verified: isVerified 
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Failed to toggle verified status');
    }
    return result.data;
  },
};

// Export singleton instance for backward compatibility (lowercase)
export const rolesService = RolesService;
