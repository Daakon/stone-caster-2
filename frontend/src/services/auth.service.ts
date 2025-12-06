/**
 * Auth Service (API Layer)
 * Pure TypeScript functions for authentication API calls
 * Stateless - no side effects, just data fetching
 */

import { apiGet } from '@/lib/api';

export interface MeResponse {
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
}

/**
 * Get current user session from /api/me
 * Returns user info, role, and config
 */
export async function getSession(): Promise<MeResponse> {
  const result = await apiGet<MeResponse>('/api/me');
  if (!result.ok) {
    throw new Error(result.error.message || 'Failed to fetch session');
  }
  return result.data;
}

