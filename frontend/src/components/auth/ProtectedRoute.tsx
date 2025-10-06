import { type ReactNode } from 'react';
import { GatedRoute } from './GatedRoute';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper component for routes that require authentication
 * Uses GatedRoute with authentication required by default
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  return (
    <GatedRoute 
      requireAuth={true} 
      redirectTo="/auth/signin"
      fallback={fallback}
    >
      {children}
    </GatedRoute>
  );
}




