/**
 * Service for preserving and restoring intended routes during authentication flows
 */

const INTENDED_ROUTE_KEY = 'stonecaster_intended_route';
const SAFE_DEFAULT_ROUTES = ['/', '/adventures', '/worlds'];

export class RoutePreservationService {
  /**
   * Store the current route as the intended route for post-auth redirect
   */
  static setIntendedRoute(route: string): void {
    // Don't store auth-related routes as intended routes
    if (route.startsWith('/auth') || route.startsWith('/signin') || route.startsWith('/signup')) {
      console.log(`[ROUTE-PRESERVATION] Skipping auth route: ${route}`);
      return;
    }
    
    // Don't store the current route if it's already a safe default
    if (SAFE_DEFAULT_ROUTES.includes(route)) {
      return;
    }
    
    try {
      sessionStorage.setItem(INTENDED_ROUTE_KEY, route);
      console.log(`[ROUTE-PRESERVATION] Stored intended route: ${route}`);
    } catch (error) {
      console.warn('[RoutePreservation] Failed to store intended route:', error);
    }
  }

  /**
   * Get the intended route and clear it from storage
   */
  static getAndClearIntendedRoute(): string {
    try {
      const route = sessionStorage.getItem(INTENDED_ROUTE_KEY);
      if (route) {
        sessionStorage.removeItem(INTENDED_ROUTE_KEY);
        console.log(`[ROUTE-PRESERVATION] Retrieved and cleared intended route: ${route}`);
        return route;
      }
    } catch (error) {
      console.warn('[RoutePreservation] Failed to retrieve intended route:', error);
    }
    
    console.log('[ROUTE-PRESERVATION] No intended route found, using default: /');
    return '/';
  }

  /**
   * Get the intended route without clearing it
   */
  static getIntendedRoute(): string {
    try {
      return sessionStorage.getItem(INTENDED_ROUTE_KEY) || '/';
    } catch (error) {
      console.warn('[RoutePreservation] Failed to get intended route:', error);
      return '/';
    }
  }

  /**
   * Clear the intended route
   */
  static clearIntendedRoute(): void {
    try {
      sessionStorage.removeItem(INTENDED_ROUTE_KEY);
    } catch (error) {
      console.warn('[RoutePreservation] Failed to clear intended route:', error);
    }
  }

  /**
   * Check if a route is safe for post-signout redirect
   */
  static isSafeRoute(route: string): boolean {
    return SAFE_DEFAULT_ROUTES.includes(route) || 
           route.startsWith('/adventures') || 
           route.startsWith('/worlds');
  }

  /**
   * Get a safe route for post-signout redirect
   */
  static getSafeSignoutRoute(currentRoute: string): string {
    if (this.isSafeRoute(currentRoute)) {
      return currentRoute;
    }
    
    // Default to landing page for unsafe routes
    return '/';
  }
}
