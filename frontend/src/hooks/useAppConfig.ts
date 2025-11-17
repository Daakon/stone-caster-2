/**
 * Hook to access app configuration from /api/me endpoint
 * Includes feature flags and admin configuration
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface AppConfig {
  enableChimeraUi: boolean;
}

interface MeResponse {
  ok: boolean;
  data: {
    user: {
      id: string;
      email?: string;
      role?: string;
      roleVersion: number;
    } | null;
    kind: 'guest' | 'user';
    config: {
      enableChimeraUi: boolean;
    };
  };
}

/**
 * Hook to get app configuration from /api/me
 * Returns the config object with feature flags
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: async (): Promise<AppConfig> => {
      const result = await apiFetch<MeResponse['data']>('/api/me');
      if (!result.ok) {
        // Default to disabled if API call fails
        return { enableChimeraUi: false };
      }
      return {
        enableChimeraUi: result.data?.config?.enableChimeraUi ?? false,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

