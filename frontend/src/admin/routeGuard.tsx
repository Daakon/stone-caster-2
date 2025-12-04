/**
 * Admin Route Guards and Role Management
 * Phase 2: Role-gated admin navigation
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';
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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.adminUserRoles(user?.id || null);
  
  // Use the singleton useAuth hook - derives roles from session cache (no duplicate network calls)
  const { data: session, isLoading, error: sessionError } = useAuth();
  
  // CRITICAL: Set query data synchronously if initialRoles provided
  // This ensures the cache is populated immediately
  const hasInitialRoles = initialRoles !== undefined;
  if (hasInitialRoles) {
    queryClient.setQueryData(queryKey, initialRoles, {
      updatedAt: Date.now(),
    });
  }
  
  // Check if data already exists in cache (either from initialRoles or previous fetch)
  const cachedData = queryClient.getQueryData<AppRole[]>(queryKey);
  
  // Derive roles from session data (no network call - uses useAuth cache)
  const roles = useMemo<AppRole[]>(() => {
    // If we have cached roles, use them
    if (cachedData) return cachedData;
    if (initialRoles) return initialRoles;
    
    // Extract role from session data
    if (!session?.user?.role) return [];
    
    const role = session.user.role;
    const userRoles: AppRole[] = [];
    if (role === 'admin') {
      userRoles.push('admin');
    } else if (role === 'moderator') {
      userRoles.push('moderator');
    } else if (role === 'creator' || role === 'early_access' || role === 'member') {
      userRoles.push('creator');
    }
    
    return userRoles;
  }, [session?.user?.role, cachedData, initialRoles]);
  
  // Cache the derived roles in React Query for other components
  if (user?.id && roles.length > 0 && !cachedData && !hasInitialRoles) {
    queryClient.setQueryData(queryKey, roles, {
      updatedAt: Date.now(),
    });
  }
  
  const loading = isLoading;
  const queryError = sessionError;

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
