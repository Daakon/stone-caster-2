/**
 * Admin Route Guard
 * Blocks ALL admin routes until roles are verified
 * Must be at the router level to prevent any admin UI from rendering
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle } from 'lucide-react';
import { AppAdminShell } from './AppAdminShell';
import { AppRolesProvider } from './routeGuard';

type AppRole = 'creator' | 'moderator' | 'admin';

interface RoleVerificationState {
  loading: boolean;
  hasAccess: boolean;
  roles: AppRole[];
  error: string | null;
  errorCode?: string;
}

/**
 * Top-level admin route guard
 * Verifies user has admin access BEFORE rendering any admin UI
 */
export function AdminRouteGuard() {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut, initialize } = useAuthStore();
  const [state, setState] = useState<RoleVerificationState>({
    loading: true,
    hasAccess: false,
    roles: [],
    error: null,
  });

  useEffect(() => {
    const verifyAdminAccess = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // First, check for Supabase session token
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          // No session token - check if auth store says authenticated
          if (!isAuthenticated || !user) {
            console.log('[AdminRouteGuard] No session token and not authenticated, redirecting to sign in');
            setState({
              loading: false,
              hasAccess: false,
              roles: [],
              error: 'Authentication required',
              errorCode: 'UNAUTHORIZED',
            });
            return;
          }
        }

        // If we have a session but auth store is out of sync, re-initialize
        if (session?.user && (!isAuthenticated || !user)) {
          console.log('[AdminRouteGuard] Session exists but auth store out of sync, re-initializing...');
          try {
            await initialize();
          } catch (initErr) {
            console.warn('[AdminRouteGuard] Failed to re-initialize auth store:', initErr);
          }
        }

        // Now fetch roles - this will fail if user doesn't have access
        console.log('[AdminRouteGuard] Fetching user roles to verify admin access...');
        let result = await apiGet<AppRole[]>('/api/admin/user/roles');

        // If UNAUTHORIZED, try refreshing token
        if (!result.ok && result.error.code === 'UNAUTHORIZED') {
          console.log('[AdminRouteGuard] Token expired, attempting refresh...');
          
          const currentSession = session || (await supabase.auth.getSession()).data.session;
          
          if (currentSession?.refresh_token) {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: currentSession.refresh_token,
            });
            
            if (!refreshError && refreshData.session) {
              console.log('[AdminRouteGuard] Token refreshed, retrying role fetch...');
              // Re-initialize auth store after refresh
              try {
                await initialize();
              } catch (initErr) {
                console.warn('[AdminRouteGuard] Failed to re-initialize after refresh:', initErr);
              }
              
              result = await apiGet<AppRole[]>('/api/admin/user/roles');
            }
          }
        }

        // Check if roles fetch succeeded
        if (!result.ok) {
          console.error('[AdminRouteGuard] Failed to fetch roles:', result.error);
          setState({
            loading: false,
            hasAccess: false,
            roles: [],
            error: `Failed to verify admin access: ${result.error.message}`,
            errorCode: result.error.code,
          });
          return;
        }

        const userRoles = (result.data || []).map(role => role as AppRole);
        console.log('[AdminRouteGuard] User roles verified:', userRoles);

        // User must have at least 'creator' role to access admin
        const hasAccess = userRoles.length > 0;
        
        if (!hasAccess) {
          console.log('[AdminRouteGuard] User has no admin roles, access denied');
          setState({
            loading: false,
            hasAccess: false,
            roles: [],
            error: 'Admin access required. You do not have permission to access this area.',
            errorCode: 'FORBIDDEN',
          });
          return;
        }

        // Access granted
        setState({
          loading: false,
          hasAccess: true,
          roles: userRoles,
          error: null,
        });

      } catch (err) {
        console.error('[AdminRouteGuard] Error verifying admin access:', err);
        setState({
          loading: false,
          hasAccess: false,
          roles: [],
          error: err instanceof Error ? err.message : 'Failed to verify admin access',
        });
      }
    };

    verifyAdminAccess();
  }, [isAuthenticated, user, initialize]);

  // Loading state
  if (state.loading) {
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
  if (!state.hasAccess || state.error) {
    const isAuthError = state.errorCode === 'UNAUTHORIZED' || 
                       state.error?.toLowerCase().includes('token') || 
                       state.error?.toLowerCase().includes('unauthorized') ||
                       state.error?.toLowerCase().includes('authentication');

    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription className="mt-2">
              {state.error || 'You do not have permission to access the admin area.'}
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
  return (
    <AppRolesProvider>
      <AppAdminShell />
    </AppRolesProvider>
  );
}

