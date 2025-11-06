import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { RoutePreservationService } from '../services/routePreservation';

/**
 * Component that handles authentication redirects within the router context
 * This must be mounted inside a Router component to use routing hooks
 */
export function AuthRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);
  
  // Use selectors to ensure component re-renders on store changes
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuest = useAuthStore((state) => state.isGuest);
  const isCookied = useAuthStore((state) => state.isCookied);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return;

    // Log auth status using simple store values
    const mode = isAuthenticated ? 'member' : 'guest';
    const userStatus = isAuthenticated ? 'present' : 'absent';
    const guestIdStatus = (isGuest || isCookied) ? 'present' : 'absent';
    // If user is authenticated and we're on an auth page, redirect to intended route
    if (isAuthenticated && location.pathname.startsWith('/auth')) {
      // Guard against double navigation
      if (hasRedirectedRef.current) {
        return;
      }
      
      const intendedRoute = RoutePreservationService.getAndClearIntendedRoute();
      const fallbackRoute = location.state?.from ?? '/';
      const redirectTo = intendedRoute || fallbackRoute;
      hasRedirectedRef.current = true;
      navigate(redirectTo, { replace: true });
    }
    
    // If user is not authenticated and we're on an auth page, allow them to stay
    // This prevents the redirect loop that was bouncing guests back to /
    if (!isAuthenticated && location.pathname.startsWith('/auth')) {
      // Reset redirect guard when not authenticated
      hasRedirectedRef.current = false;
      // No redirect - let the auth page render
    }
  }, [isAuthenticated, isGuest, isCookied, loading, location.pathname, navigate]);

  return null; // This component doesn't render anything
}
