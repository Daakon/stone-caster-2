/**
 * Entry Points Admin Service
 * Phase 3: CRUD operations for entry points management
 * 
 * Refactored to use backend API instead of direct Supabase calls
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface EntryPoint {
  id: string;
  name: string;
  slug?: string;
  type?: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  synopsis?: string;
  tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
  content_rating?: string;
  lifecycle?: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
  owner_user_id?: string;
  prompt?: any; // JSONB - Turn 1 injection JSON data
  entry_id?: string; // Reference to the entry this point initializes
  created_at: string;
  updated_at?: string;
  // Multi-ruleset support
  rulesets?: Array<{
    id: string;
    name: string;
    sort_order: number;
  }>;
}

export interface EntryPointFilters {
  lifecycle?: string[];
  visibility?: string[];
  world_id?: string;
  type?: string[];
  tags?: string[];
  search?: string;
}

export interface CreateEntryPointData {
  name: string;
  slug?: string; // Optional, will be auto-generated if not provided
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  world_id: string;
  rulesetIds: string[];
  rulesetOrder?: string[]; // Optional ordering, falls back to alphabetical
  title: string;
  subtitle?: string;
  description: string;
  synopsis?: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'private';
  content_rating: string;
  prompt?: any; // JSONB - Turn 1 injection JSON data
  entry_id?: string; // Reference to the entry this point initializes
}

export interface UpdateEntryPointData extends Partial<CreateEntryPointData> {
  lifecycle?: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
}

export interface EntryPointListResponse {
  data: EntryPoint[];
  count: number;
  hasMore: boolean;
}

export class EntryPointsService {
  /**
   * List entry points with filters and pagination
   */
  async listEntryPoints(
    filters: EntryPointFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<EntryPointListResponse> {
    const params = new URLSearchParams();
    
    if (filters.lifecycle && filters.lifecycle.length > 0) {
      filters.lifecycle.forEach(lifecycle => params.append('lifecycle', lifecycle));
    }
    
    if (filters.visibility && filters.visibility.length > 0) {
      filters.visibility.forEach(visibility => params.append('visibility', visibility));
    }
    
    if (filters.world_id) {
      params.append('world_id', filters.world_id);
    }
    
    if (filters.type && filters.type.length > 0) {
      filters.type.forEach(type => params.append('type', type));
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    params.append('page', page.toString());
    params.append('limit', pageSize.toString());
    
    const result = await apiGet<EntryPointListResponse>(`/api/admin/entry-points?${params.toString()}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch entry points: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Get a single entry point by ID
   */
  async getEntryPoint(id: string): Promise<EntryPoint> {
    // Fetch the entry point
    const result = await apiGet<EntryPoint>(`/api/admin/entry-points/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to fetch entry point: ${result.error.message}`);
    }
    
    // Note: The backend endpoint returns the entry point without rulesets joined
    // We'll need to fetch those separately if needed, or update the backend endpoint
    // For now, return what we get
    return result.data;
  }

  /**
   * Create a new entry point
   */
  async createEntryPoint(data: CreateEntryPointData): Promise<EntryPoint> {
    const result = await apiPost<EntryPoint>('/api/admin/entry-points', data);
    
    if (!result.ok) {
      throw new Error(`Failed to create entry point: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Update an entry point
   */
  async updateEntryPoint(id: string, data: UpdateEntryPointData): Promise<EntryPoint> {
    const result = await apiPut<EntryPoint>(`/api/admin/entry-points/${id}`, data);
    
    if (!result.ok) {
      throw new Error(`Failed to update entry point: ${result.error.message}`);
    }
    
    return result.data;
  }

  /**
   * Delete an entry point
   */
  async deleteEntryPoint(id: string): Promise<void> {
    const result = await apiDelete<{ message: string }>(`/api/admin/entry-points/${id}`);
    
    if (!result.ok) {
      throw new Error(`Failed to delete entry point: ${result.error.message}`);
    }
  }

  /**
   * Submit entry point for review (lifecycle transition)
   */
  async submitForReview(id: string, note?: string): Promise<void> {
    await this.updateEntryPoint(id, {
      lifecycle: 'pending_review'
    });
  }

  /**
   * Approve entry point (moderator/admin action)
   */
  async approveEntryPoint(id: string): Promise<EntryPoint> {
    return this.updateEntryPoint(id, {
      lifecycle: 'active'
    });
  }

  /**
   * Request changes to entry point (moderator/admin action)
   */
  async requestChanges(id: string, note: string): Promise<EntryPoint> {
    return this.updateEntryPoint(id, {
      lifecycle: 'changes_requested'
    });
  }

  /**
   * Reject entry point (moderator/admin action)
   */
  async rejectEntryPoint(id: string, reason: string): Promise<EntryPoint> {
    return this.updateEntryPoint(id, {
      lifecycle: 'rejected'
    });
  }

  /**
   * Archive entry point
   */
  async archiveEntryPoint(id: string): Promise<EntryPoint> {
    return this.updateEntryPoint(id, {
      lifecycle: 'archived'
    });
  }

  /**
   * Get available worlds for entry point creation
   */
  async getWorlds(): Promise<Array<{ id: string; name: string }>> {
    const result = await apiGet<{ data: Array<{ id: string; name: string }> }>('/api/admin/worlds?limit=100');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch worlds: ${result.error.message}`);
    }
    
    return result.data.data;
  }

  /**
   * Get available rulesets for entry point creation
   */
  async getRulesets(): Promise<Array<{ id: string; name: string }>> {
    const result = await apiGet<{ data: Array<{ id: string; name: string }> }>('/api/admin/rulesets?limit=100');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch rulesets: ${result.error.message}`);
    }
    
    return result.data.data;
  }

  /**
   * Get available entries for linking
   */
  async getEntries(): Promise<Array<{ id: string; name: string }>> {
    const result = await apiGet<{ data: Array<{ id: string; name: string }> }>('/api/admin/entries?limit=100');
    
    if (!result.ok) {
      throw new Error(`Failed to fetch entries: ${result.error.message}`);
    }
    
    return result.data.data;
  }
}

export const entryPointsService = new EntryPointsService();
