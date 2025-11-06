/**
 * Early Access Route Guard
 * Blocks navigation to protected routes unless user has approved early access
 * Uses AccessStatusProvider to avoid duplicate queries
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useAccessStatusContext } from '@/providers/AccessStatusProvider';
import { useAdminRoles } from '@/lib/queries/index';

interface EarlyAccessRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that requires early access approval
 * Allows access to:
 * - Landing page (/)
 * - Auth routes (/auth/*)
 * - Request access page (/request-access)
 * - Public routes
 */
export function EarlyAccessRoute({ children }: EarlyAccessRouteProps) {
  const { user } = useAuthStore();
  const { hasApprovedAccess, isLoading, accessStatus } = useAccessStatusContext();
  
  // Check if user has admin role (admins bypass early access)
  // Use isLoading to prevent redirect while roles are being fetched
  const { data: adminRoles = [], isLoading: isLoadingRoles } = useAdminRoles(user?.id || null);
  const isAdmin = adminRoles.includes('admin');

  // Debug logging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[EarlyAccessRoute]', {
      hasUser: !!user,
      userId: user?.id,
      isLoading,
      hasApprovedAccess,
      accessStatus,
      accessStatusStatus: accessStatus?.status,
      isAdmin,
      adminRoles,
    });
  }

  // If not authenticated, allow access (they can sign in)
  if (!user) {
    return <>{children}</>;
  }

  // If loading access status or roles, show loading state (don't redirect yet)
  if (isLoading || isLoadingRoles) {
    // Return a minimal loading state instead of null to prevent flash
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Admins bypass early access requirement
  if (isAdmin) {
    return <>{children}</>;
  }

  // If not approved, redirect to landing page
  if (!hasApprovedAccess) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[EarlyAccessRoute] Redirecting to / - hasApprovedAccess is false, isAdmin is', isAdmin);
    }
    return <Navigate to="/" replace />;
  }

  // User has approved access, allow route
  return <>{children}</>;
}

