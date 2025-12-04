/**
 * Hook to access app configuration
 * Derives config from the singleton useAuth hook (no duplicate network calls)
 * Includes feature flags and admin configuration
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import type { MeResponse } from '@/services/auth.service';

interface AppConfig {
  enableChimeraUi: boolean;
}

/**
 * Hook to get app configuration
 * Uses useAuth() singleton - derives config from session cache
 * Returns the config object with feature flags
 */
export function useAppConfig() {
  // 1. Get the master session from useAuth hook (shared cache)
  const { data: session, isLoading, error } = useAuth();

  // 2. Derive config from session data
  const config = useMemo<AppConfig>(() => {
    if (!session) {
      return { enableChimeraUi: false };
    }
    return {
      enableChimeraUi: session.config?.enableChimeraUi ?? false,
    };
  }, [session]);

  return {
    data: config,
    isLoading,
    error,
  };
}

