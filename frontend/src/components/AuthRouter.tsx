import { useEffect } from 'react';
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
  const { isAuthenticated, isGuest, isCookied, loading } = useAuthStore();

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return;

    // Log auth status using simple store values
    const mode = isAuthenticated ? 'member' : 'guest';
    const userStatus = isAuthenticated ? 'present' : 'absent';
    const guestIdStatus = (isGuest || isCookied) ? 'present' : 'absent';
    
    console.log(`[AUTH] mode=${mode} user=${userStatus} guestId=${guestIdStatus}`);

    // If user is authenticated and we're on an auth page, redirect to intended route
    if (isAuthenticated && location.pathname.startsWith('/auth')) {
      const intendedRoute = RoutePreservationService.getAndClearIntendedRoute();
      console.log(`[REDIRECT] from=${location.pathname} to=${intendedRoute} trigger=signin`);
      navigate(intendedRoute, { replace: true });
    }
    
    // If user is not authenticated and we're on an auth page, allow them to stay
    // This prevents the redirect loop that was bouncing guests back to /
    if (!isAuthenticated && location.pathname.startsWith('/auth')) {
      console.log(`[AUTH] allowing guest to stay on auth page: ${location.pathname}`);
      // No redirect - let the auth page render
    }
  }, [isAuthenticated, isGuest, isCookied, loading, location.pathname, navigate]);

  return null; // This component doesn't render anything
}
