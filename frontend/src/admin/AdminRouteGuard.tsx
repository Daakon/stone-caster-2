/**
 * Admin Route Guard
 * Blocks ALL admin routes until roles are verified
 * Must be at the router level to prevent any admin UI from rendering
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { AppAdminShell } from './AppAdminShell';
import { AppRolesProvider } from './routeGuard';

type AppRole = 'creator' | 'moderator' | 'admin';

/**
 * Top-level admin route guard
 * Verifies user has admin access BEFORE rendering any admin UI
 * Uses useAuth hook (React Query) for deduplication - only ONE /api/me call
 */
export function AdminRouteGuard() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const queryClient = useQueryClient();
  
  // Use React Query hook - deduplicates with other components calling useAuth
  const { data: sessionData, isLoading, error: sessionError } = useAuth();

  // Extract roles from session data
  const roles = useMemo<AppRole[]>(() => {
    if (!sessionData?.user?.role) return [];
    
    const role = sessionData.user.role;
    if (role === 'admin') return ['admin'];
    if (role === 'moderator') return ['moderator'];
    if (role === 'creator' || role === 'early_access' || role === 'member') return ['creator'];
    return [];
  }, [sessionData?.user?.role]);

  // Cache roles in React Query for other components
  const userId = sessionData?.user?.id || null;
  if (userId && roles.length > 0) {
    queryClient.setQueryData(queryKeys.adminUserRoles(userId), roles, {
      updatedAt: Date.now(),
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            <CardTitle>Verifying Admin Access</CardTitle>
            <CardDescription>
              Checking permissions and roles...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Error state - no access
  const hasAccess = roles.length > 0;
  const error = sessionError?.message || (!hasAccess ? 'Admin access required. You do not have permission to access this area.' : null);
  const errorCode = sessionError ? 'UNAUTHORIZED' : (!hasAccess ? 'FORBIDDEN' : undefined);
  
  if (!hasAccess || error) {
    const isAuthError = errorCode === 'UNAUTHORIZED' || 
                       error?.toLowerCase().includes('token') || 
                       error?.toLowerCase().includes('unauthorized') ||
                       error?.toLowerCase().includes('authentication');

    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription className="mt-2">
              {error || 'You do not have permission to access the admin area.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAuthError && (
              <p className="text-sm text-muted-foreground text-center">
                Your session may have expired. Please sign in again to continue.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {isAuthError && (
                <Button 
                  onClick={async () => {
                    await signOut();
                    navigate('/auth/signin');
                  }}
                  variant="default"
                  className="w-full"
                >
                  Sign In Again
                </Button>
              )}
              <Button 
                onClick={() => navigate('/dashboard')} 
                variant="outline"
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access granted - render admin shell with roles provider
  // Roles are already cached in React Query, so no duplicate API call
  return (
    <AppRolesProvider initialRoles={roles}>
      <AppAdminShell />
    </AppRolesProvider>
  );
}

