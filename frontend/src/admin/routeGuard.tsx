/**
 * Admin Route Guards and Role Management
 * Phase 2: Role-gated admin navigation
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home } from 'lucide-react';

// Role types
export type AppRole = 'creator' | 'moderator' | 'admin';

export interface AppRoles {
  isCreator: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  errorCode?: string;
}

// Context for role state
const AppRolesContext = createContext<AppRoles | null>(null);

// Hook to access app roles
export function useAppRoles(): AppRoles {
  const context = useContext(AppRolesContext);
  if (!context) {
    throw new Error('useAppRoles must be used within AppRolesProvider');
  }
  return context;
}

// Provider component
export function AppRolesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      // Check if we have a session token, even if auth store says not authenticated
      // This handles cases where auth store is out of sync
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session token and not authenticated, skip
      if (!session?.access_token && (!isAuthenticated || !user)) {
        console.log('[AppRolesProvider] No session token and not authenticated, skipping role fetch');
        setRoles([]);
        setLoading(false);
        setHasAttemptedFetch(true);
        return;
      }

      // If we have a session token OR auth store says authenticated, try to fetch roles
      const hasToken = !!session?.access_token;
      const shouldFetch = hasToken || (isAuthenticated && user);
      
      if (!shouldFetch) {
        console.log('[AppRolesProvider] No token and not authenticated, skipping');
        setRoles([]);
        setLoading(false);
        setHasAttemptedFetch(true);
        return;
      }
      
      setHasAttemptedFetch(true);

      try {
        setLoading(true);
        setError(null);
        console.log('[AppRolesProvider] Fetching roles...', { hasToken, isAuthenticated: isAuthenticated && !!user });

        let result = await apiGet<string[]>('/api/admin/user/roles');
        
        // If we get UNAUTHORIZED, try refreshing the session and retry once
        if (!result.ok && result.error.code === 'UNAUTHORIZED') {
          console.log('[AppRolesProvider] Token expired, attempting refresh...');
          
          try {
            const currentSession = session || (await supabase.auth.getSession()).data.session;
            
            if (currentSession?.refresh_token) {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: currentSession.refresh_token,
              });
              
              if (!refreshError && refreshData.session) {
                console.log('[AppRolesProvider] Token refreshed, retrying request...');
                // Update the session reference for subsequent use
                const updatedSession = refreshData.session;
                result = await apiGet<string[]>('/api/admin/user/roles');
                
                // If successful, trigger auth store re-initialization
                if (result.ok && updatedSession?.user) {
                  console.log('[AppRolesProvider] Re-initializing auth store after token refresh');
                  try {
                    const { useAuthStore } = await import('@/store/auth');
                    const store = useAuthStore.getState();
                    await store.initialize();
                  } catch (initErr) {
                    console.warn('[AppRolesProvider] Failed to re-initialize after refresh:', initErr);
                  }
                }
              }
            }
          } catch (refreshErr) {
            console.warn('[AppRolesProvider] Failed to refresh token:', refreshErr);
            // Continue with original error
          }
        }
        
        if (!result.ok) {
          setErrorCode(result.error.code);
          throw new Error(`Failed to fetch roles: ${result.error.message}`);
        }

        const userRoles = (result.data || []).map(role => role as AppRole);
        console.log('[AppRolesProvider] Roles fetched successfully:', userRoles);
        setRoles(userRoles);
        setErrorCode(undefined);
        
        // If we successfully fetched roles but auth store says not authenticated,
        // re-initialize the auth store to sync it with the session
        if (!isAuthenticated && session?.user) {
          console.log('[AppRolesProvider] Auth store out of sync, re-initializing...');
          try {
            const { useAuthStore } = await import('@/store/auth');
            // Get the store instance and call initialize
            const store = useAuthStore.getState();
            await store.initialize();
            console.log('[AppRolesProvider] Auth store re-initialized');
          } catch (syncErr) {
            console.warn('[AppRolesProvider] Failed to re-initialize auth store:', syncErr);
          }
        }
      } catch (err) {
        console.error('Error fetching app roles:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch roles');
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [isAuthenticated, user]);

  // User is a creator if authenticated OR if we successfully fetched roles
  // Successfully fetching roles (even if empty array) means user is authenticated
  // This handles cases where auth store is out of sync but we have a valid session
  // Only consider fetch success if we actually attempted the fetch
  const isCreator = (isAuthenticated && user !== null) || (hasAttemptedFetch && !loading && error === null);
  const isModerator = roles.includes('moderator');
  const isAdmin = roles.includes('admin');

  const value: AppRoles = {
    isCreator,
    isModerator,
    isAdmin,
    roles,
    loading,
    error,
    errorCode
  };

  return (
    <AppRolesContext.Provider value={value}>
      {children}
    </AppRolesContext.Provider>
  );
}

// Guarded component for role-based access
interface GuardedProps {
  allow: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function Guarded({ allow, children, fallback }: GuardedProps) {
  const { isCreator, isModerator, isAdmin, loading } = useAppRoles();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading permissions...</div>
      </div>
    );
  }

  const allowedRoles = Array.isArray(allow) ? allow : [allow];
  
  const hasAccess = allowedRoles.some(role => {
    switch (role) {
      case 'creator':
        return isCreator;
      case 'moderator':
        return isModerator;
      case 'admin':
        return isAdmin;
      default:
        return false;
    }
  });

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <AccessDenied />;
  }

  return <>{children}</>;
}

// Access denied component
function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this section.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <a href="/admin">
              <Home className="mr-2 h-4 w-4" />
              Go to Admin Home
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to check specific role
export function useHasRole(role: AppRole): boolean {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  
  switch (role) {
    case 'creator':
      return isCreator;
    case 'moderator':
      return isModerator;
    case 'admin':
      return isAdmin;
    default:
      return false;
  }
}

// Hook to check multiple roles (OR logic)
export function useHasAnyRole(roles: AppRole[]): boolean {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  
  return roles.some(role => {
    switch (role) {
      case 'creator':
        return isCreator;
      case 'moderator':
        return isModerator;
      case 'admin':
        return isAdmin;
      default:
        return false;
    }
  });
}
