import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { useAuthStore } from '../../store/auth';
import { RoutePreservationService } from '../../services/routePreservation';
import { 
  Shield, 
  AlertTriangle, 
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

interface GatedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
  showGuestMessage?: boolean;
}

export function GatedRoute({ 
  children, 
  fallback,
  redirectTo = '/auth/signin',
  requireAuth = true,
  showGuestMessage = true
}: GatedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isGuest, isCookied, loading: authLoading } = useAuthStore();
  const [hasCheckedAccess, setHasCheckedAccess] = useState(false);

  // Use simple store values instead of API calls
  const canAccess = requireAuth ? isAuthenticated : true;
  const isGuestUser = isGuest || isCookied;

  // Handle access check completion
  useEffect(() => {
    if (hasCheckedAccess) return;

    if (!requireAuth) {
      setHasCheckedAccess(true);
      return;
    }

    if (authLoading) return;

    setHasCheckedAccess(true);
    
    // If authentication is required but user can't access, redirect
    if (requireAuth && !canAccess) {
      // Store the current route as intended route for post-auth redirect
      RoutePreservationService.setIntendedRoute(location.pathname);
      
      const reason = isGuestUser ? 'unauthenticated' : 'insufficient_permissions';
      console.log(`[ROUTE-GUARD] access=blocked path=${location.pathname} reason=${reason}`);
      console.log(`[REDIRECT] from=${location.pathname} to=${redirectTo} trigger=guard`);
      
      navigate(redirectTo, { 
        replace: true,
        state: { 
          from: location.pathname,
          message: 'Please sign in to access this page'
        }
      });
    } else if (requireAuth && canAccess) {
      console.log(`[ROUTE-GUARD] access=allowed path=${location.pathname} reason=authenticated`);
    } else if (!requireAuth) {
      console.log(`[ROUTE-GUARD] access=allowed path=${location.pathname} reason=public`);
    }
  }, [canAccess, isGuestUser, authLoading, requireAuth, redirectTo, navigate, hasCheckedAccess, location.pathname]);

  // Show loading state
  if (authLoading || !hasCheckedAccess) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If authentication is required but user can't access
  if (requireAuth && !canAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Shield className="h-5 w-5" />
                Authentication Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showGuestMessage && isGuestUser && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You're currently browsing as a guest. Sign in to access your profile, 
                    save your progress, and unlock additional features.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This page requires authentication. Please sign in to continue.
                </p>
                
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/auth/signin')}>
                    Sign In
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // User has access, render children
  return <>{children}</>;
}

/**
 * Hook for checking if user can access gated features
 */
export function useGatedAccess() {
  const { isAuthenticated, isGuest, isCookied, loading: authLoading } = useAuthStore();

  return {
    canAccess: isAuthenticated,
    isGuest: isGuest || isCookied,
    isLoading: authLoading,
    error: null,
    accessInfo: {
      canAccess: isAuthenticated,
      isGuest: isGuest || isCookied,
      userId: useAuthStore.getState().userId || '',
      requiresAuth: true
    },
  };
}