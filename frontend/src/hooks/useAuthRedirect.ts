import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { RoutePreservationService } from '../services/routePreservation';

/**
 * Hook to handle authentication state changes and route preservation
 */
export function useAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return;

    // If user is authenticated and we're on an auth page, redirect to intended route
    if (user?.state === 'authenticated' && 
        (location.pathname.startsWith('/auth') || 
         location.pathname.startsWith('/signin') || 
         location.pathname.startsWith('/signup'))) {
      
      const intendedRoute = RoutePreservationService.getAndClearIntendedRoute();
      console.log('[useAuthRedirect] User authenticated, redirecting to:', intendedRoute);
      navigate(intendedRoute, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);
}

/**
 * Hook to preserve current route when navigating to auth pages
 */
export function useRoutePreservation() {
  const location = useLocation();

  useEffect(() => {
    // Store the current route if it's not an auth-related route
    if (!location.pathname.startsWith('/auth') && 
        !location.pathname.startsWith('/signin') && 
        !location.pathname.startsWith('/signup')) {
      RoutePreservationService.setIntendedRoute(location.pathname);
    }
  }, [location.pathname]);
}

