/**
 * Admin Route Guards and Role Management
 * Phase 2: Role-gated admin navigation
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    const fetchRoles = async () => {
      if (!isAuthenticated || !user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('app_roles')
          .select('role')
          .eq('user_id', user.id);

        if (fetchError) {
          throw new Error(`Failed to fetch roles: ${fetchError.message}`);
        }

        const userRoles = (data || []).map(row => row.role as AppRole);
        setRoles(userRoles);
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

  const isCreator = isAuthenticated && user !== null;
  const isModerator = roles.includes('moderator');
  const isAdmin = roles.includes('admin');

  const value: AppRoles = {
    isCreator,
    isModerator,
    isAdmin,
    roles,
    loading,
    error
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
