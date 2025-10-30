/**
 * AWF Admin Service for managing AWF bundle documents
 * Phase 2: Admin UI - Service layer for AWF document management
 */

import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/stores/adminStore';

// AWF Document Types
export interface AwfCoreContract {
  id: string;
  version: string;
  doc: Record<string, unknown>;
  hash: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AwfWorld {
  id: string;
  version: string;
  doc: Record<string, unknown>;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface AwfAdventure {
  id: string;
  world_ref: string;
  version: string;
  doc: Record<string, unknown>;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface AwfAdventureStart {
  adventure_ref: string;
  doc: Record<string, unknown>;
  use_once: boolean;
  created_at: string;
  updated_at: string;
}

export interface AwfCoreRuleset {
  id: string;
  version: string;
  doc: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AwfDocumentResponse {
  ok: boolean;
  data?: any;
  error?: string;
  details?: any;
}

export class AwfAdminService {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get cached role from admin store
    const { getCachedUserRole } = useAdminStore.getState();
    const role = getCachedUserRole();
    
    if (!role) {
      throw new Error('User role not found. Please refresh the page.');
    }

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

  // Core Contracts
  async getCoreContracts(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/core-contracts');
  }

  async createCoreContract(data: {
    id: string;
    version: string;
    doc: Record<string, unknown>;
    active?: boolean;
  }): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/core-contracts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async activateCoreContract(id: string, version: string): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>(`/awf/core-contracts/${id}/${version}/activate`, {
      method: 'PATCH'
    });
  }

  // Worlds
  async getWorlds(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/worlds');
  }

  async createWorld(data: {
    id: string;
    version: string;
    doc: Record<string, unknown>;
  }): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/worlds', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Adventures (deprecated - use getStories instead)
  async getAdventures(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/adventures');
  }

  // Stories (new)
  async getStories(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/stories');
  }

  async createAdventure(data: {
    id: string;
    world_ref: string;
    version: string;
    doc: Record<string, unknown>;
  }): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/adventures', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Adventure Starts
  async getAdventureStarts(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/adventure-starts');
  }

  async createAdventureStart(data: {
    adventure_ref: string;
    doc: Record<string, unknown>;
    use_once?: boolean;
  }): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/adventure-starts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Core Rulesets
  async getCoreRulesets(): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/rulesets');
  }

  async createCoreRuleset(data: {
    id: string;
    version: string;
    doc: Record<string, unknown>;
  }): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>('/awf/rulesets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deleteCoreRuleset(id: string, version: string): Promise<AwfDocumentResponse> {
    return this.makeRequest<AwfDocumentResponse>(`/awf/rulesets/${id}/${version}`, {
      method: 'DELETE'
    });
  }

  // Utility methods
  formatJsonForDisplay(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  parseJsonFromStorage(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error parsing JSON from storage:', error);
      return {};
    }
  }

  // Export document as JSON file
  exportDocument(doc: any, filename: string): void {
    const dataStr = JSON.stringify(doc, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = filename;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  // Import document from JSON file
  importDocument(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = JSON.parse(e.target?.result as string);
          resolve(result);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

export const awfAdminService = new AwfAdminService();


