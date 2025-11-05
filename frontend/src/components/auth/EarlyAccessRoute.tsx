/**
 * Early Access Route Guard
 * Blocks navigation to protected routes unless user has approved early access
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/react-query';
import { publicAccessRequestsService } from '@/services/accessRequests';

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

  // Check access request status
  const { data: accessStatus, isLoading } = useQuery({
    queryKey: ['access-request-status'],
    queryFn: () => publicAccessRequestsService.getStatus(),
    enabled: !!user,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // If not authenticated, allow access (they can sign in)
  if (!user) {
    return <>{children}</>;
  }

  // If loading, show nothing (or a loading state)
  if (isLoading) {
    return null;
  }

  // Check if user has approved access
  const request = accessStatus?.ok ? accessStatus.data : null;
  const hasApprovedAccess = request?.status === 'approved';

  // If not approved, redirect to landing page
  if (!hasApprovedAccess) {
    return <Navigate to="/" replace />;
  }

  // User has approved access, allow route
  return <>{children}</>;
}

