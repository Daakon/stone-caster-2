/**
 * Admin State Store
 * Centralized state management for admin functionality to prevent redundant API calls
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AdminState {
  // User role state
  userRole: string | null;
  roleLoading: boolean;
  roleError: string | null;
  
  // Core contracts state
  coreContracts: any[];
  contractsLoading: boolean;
  contractsError: string | null;
  contractsLastFetched: number | null;
  
  // Actions
  fetchUserRole: (userId: string) => Promise<void>;
  getCachedUserRole: () => string | null;
  fetchCoreContracts: () => Promise<void>;
  getCachedCoreContracts: () => any[];
  clearCache: () => void;
}

// Cache duration (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  userRole: null,
  roleLoading: false,
  roleError: null,
  coreContracts: [],
  contractsLoading: false,
  contractsError: null,
  contractsLastFetched: null,

  // Fetch user role with caching
  fetchUserRole: async (userId: string) => {
    const state = get();
    
    // If we already have the role and it's recent, don't fetch again
    if (state.userRole && !state.roleLoading) {
      return;
    }

    set({ roleLoading: true, roleError: null });

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('auth_user_id', userId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch user role: ${error.message}`);
      }

      const role = data?.role || 'user';
      set({ 
        userRole: role, 
        roleLoading: false, 
        roleError: null 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ 
        roleError: errorMessage, 
        roleLoading: false 
      });
      throw error;
    }
  },

  // Get cached user role
  getCachedUserRole: () => {
    const state = get();
    return state.userRole;
  },

  // Fetch core contracts with caching
  fetchCoreContracts: async () => {
    const state = get();
    const now = Date.now();
    
    // If we're already loading, don't start another request
    if (state.contractsLoading) {
      console.log('Core contracts already loading, skipping duplicate request');
      return;
    }
    
    // If we have recent data, don't fetch again
    if (state.contractsLastFetched && 
        (now - state.contractsLastFetched) < CACHE_DURATION && 
        state.coreContracts.length > 0) {
      console.log('Using cached core contracts');
      return;
    }

    console.log('Fetching core contracts from API');
    set({ contractsLoading: true, contractsError: null });

    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/admin/awf/core-contracts', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch core contracts');
      }

      set({ 
        coreContracts: data.data || [], 
        contractsLoading: false, 
        contractsError: null,
        contractsLastFetched: now
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ 
        contractsError: errorMessage, 
        contractsLoading: false 
      });
      throw error;
    }
  },

  // Get cached core contracts
  getCachedCoreContracts: () => {
    const state = get();
    return state.coreContracts;
  },

  // Clear all caches
  clearCache: () => {
    set({
      userRole: null,
      roleLoading: false,
      roleError: null,
      coreContracts: [],
      contractsLoading: false,
      contractsError: null,
      contractsLastFetched: null
    });
  }
}));
