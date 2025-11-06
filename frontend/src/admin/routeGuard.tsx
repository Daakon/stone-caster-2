/**
 * Admin Route Guards and Role Management
 * Phase 2: Role-gated admin navigation
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
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
export function AppRolesProvider({ 
  children, 
  initialRoles 
}: { 
  children: ReactNode;
  initialRoles?: AppRole[];
}) {
  const { user, isAuthenticated } = useAuthStore();
  
  // Use React Query for roles with caching to prevent duplicate calls
  const { data: roles = initialRoles || [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['admin-user-roles', user?.id],
    queryFn: async () => {
      // Check if we have a session token, even if auth store says not authenticated
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session token and not authenticated, return empty array
      if (!session?.access_token && (!isAuthenticated || !user)) {
        return [];
      }

      // If we have a session token OR auth store says authenticated, try to fetch roles
      const hasToken = !!session?.access_token;
      const shouldFetch = hasToken || (isAuthenticated && user);
      
      if (!shouldFetch) {
        return [];
      }

      let result = await apiGet<string[]>('/api/admin/user/roles');
      
      // If we get UNAUTHORIZED, try refreshing the session and retry once
      if (!result.ok && result.error.code === 'UNAUTHORIZED') {
        try {
          const currentSession = session || (await supabase.auth.getSession()).data.session;
          
          if (currentSession?.refresh_token) {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: currentSession.refresh_token,
            });
            
            if (!refreshError && refreshData.session) {
              result = await apiGet<string[]>('/api/admin/user/roles');
              
              // If successful, trigger auth store re-initialization
              if (result.ok && refreshData.session?.user) {
                try {
                  const { useAuthStore } = await import('@/store/auth');
                  const store = useAuthStore.getState();
                  await store.initialize();
                } catch (initErr) {
                  // Silently fail auth store re-initialization
                }
              }
            }
          }
        } catch (refreshErr) {
          // Continue with original error
        }
      }
      
      if (!result.ok) {
        throw new Error(`Failed to fetch roles: ${result.error.message}`);
      }

      const userRoles = (result.data || []).map(role => role as AppRole);
      
      // If we successfully fetched roles but auth store says not authenticated,
      // re-initialize the auth store to sync it with the session
      if (!isAuthenticated && session?.user) {
        try {
          const { useAuthStore } = await import('@/store/auth');
          const store = useAuthStore.getState();
          await store.initialize();
        } catch (syncErr) {
          // Silently fail auth store re-initialization
        }
      }
      
      return userRoles;
    },
    enabled: !!user || !!isAuthenticated, // Only fetch if user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - roles don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    initialData: initialRoles, // Use initial roles if provided
  });

  const error = queryError instanceof Error ? queryError.message : null;
  const errorCode = queryError && typeof queryError === 'object' && 'code' in queryError ? queryError.code as string : undefined;

  // User is a creator if authenticated OR if we successfully fetched roles
  const isCreator = (isAuthenticated && user !== null) || (!loading && error === null && roles.length >= 0);
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
