import { supabase } from '@/lib/supabase';

export interface Prompt {
  id: string;
  layer: string;
  world_slug?: string;
  adventure_slug?: string;
  scene_id?: string;
  turn_stage: string;
  sort_order: number;
  version: string;
  content: string;
  metadata: Record<string, any>;
  active: boolean;
  locked: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface PromptStats {
  total_prompts: number;
  active_prompts: number;
  locked_prompts: number;
  layers_count: Record<string, number>;
  worlds_count: number;
}

export interface CreatePromptData {
  layer: string;
  world_slug?: string;
  adventure_slug?: string;
  scene_id?: string;
  turn_stage: string;
  sort_order: number;
  version: string;
  content: string;
  metadata: Record<string, any>;
  active: boolean;
  locked: boolean;
}

export interface UpdatePromptData extends Partial<CreatePromptData> {}

export interface PromptFilters {
  layer?: string;
  world_slug?: string;
  adventure_slug?: string;
  active?: boolean;
  locked?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PromptResponse {
  ok: boolean;
  data?: Prompt | Prompt[];
  error?: string;
  details?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class AdminService {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Verify admin role from application database
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', session.user.id)
      .single();
    
    if (error || !data) {
      throw new Error('Failed to fetch user role');
    }

    const role = data.role || 'user';
    if (role !== 'prompt_admin') {
      throw new Error('Insufficient permissions: prompt_admin role required');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    
    const baseUrl = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai');
    const response = await fetch(`${baseUrl}/api/admin${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Get all prompts with optional filtering
  async getPrompts(filters: PromptFilters = {}): Promise<PromptResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = queryString ? `/prompts?${queryString}` : '/prompts';

    return this.makeRequest<PromptResponse>(endpoint);
  }

  // Get prompt by ID
  async getPrompt(id: string): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>(`/prompts/${id}`);
  }

  // Create new prompt
  async createPrompt(data: CreatePromptData): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>('/prompts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Update prompt
  async updatePrompt(id: string, data: UpdatePromptData): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>(`/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Delete prompt
  async deletePrompt(id: string): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>(`/prompts/${id}`, {
      method: 'DELETE'
    });
  }

  // Toggle prompt active status
  async togglePromptActive(id: string): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>(`/prompts/${id}/toggle-active`, {
      method: 'PATCH'
    });
  }

  // Toggle prompt locked status
  async togglePromptLocked(id: string): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>(`/prompts/${id}/toggle-locked`, {
      method: 'PATCH'
    });
  }

  // Get prompt statistics
  async getPromptStats(): Promise<{ ok: boolean; data?: PromptStats; error?: string }> {
    return this.makeRequest<{ ok: boolean; data?: PromptStats; error?: string }>('/prompts/stats');
  }

  // Validate prompt dependencies
  async validateDependencies(): Promise<{ ok: boolean; data?: any[]; error?: string }> {
    return this.makeRequest<{ ok: boolean; data?: any[]; error?: string }>('/prompts/validate-dependencies');
  }

  // Bulk operations
  async bulkOperation(action: string, promptIds: string[]): Promise<PromptResponse> {
    return this.makeRequest<PromptResponse>('/prompts/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, promptIds })
    });
  }

  // Format JSON for display (pretty)
  formatJsonForDisplay(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  // Minify JSON for storage
  minifyJsonForStorage(obj: any): string {
    return JSON.stringify(obj);
  }

  // Parse JSON from storage
  parseJsonFromStorage(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing JSON from storage:', error);
      return {};
    }
  }
}

export const adminService = new AdminService();
