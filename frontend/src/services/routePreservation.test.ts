import { RoutePreservationService } from './routePreservation';
import { vi } from 'vitest';

// Mock console.log to capture logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('RoutePreservationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('setIntendedRoute', () => {
    it('should store intended route in sessionStorage', () => {
      RoutePreservationService.setIntendedRoute('/dashboard');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBe('/dashboard');
    });

    it('should skip auth routes', () => {
      RoutePreservationService.setIntendedRoute('/auth/signin');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-PRESERVATION] Skipping auth route: /auth/signin'
      );
    });

    it('should skip signin routes', () => {
      RoutePreservationService.setIntendedRoute('/signin');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-PRESERVATION] Skipping auth route: /signin'
      );
    });

    it('should skip signup routes', () => {
      RoutePreservationService.setIntendedRoute('/signup');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-PRESERVATION] Skipping auth route: /signup'
      );
    });

    it('should skip safe default routes', () => {
      RoutePreservationService.setIntendedRoute('/');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
    });

    it('should skip stories routes', () => {
      RoutePreservationService.setIntendedRoute('/stories');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
    });

    it('should skip worlds routes', () => {
      RoutePreservationService.setIntendedRoute('/worlds');
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
    });
  });

  describe('getAndClearIntendedRoute', () => {
    it('should return and clear intended route', () => {
      sessionStorage.setItem('stonecaster_intended_route', '/dashboard');
      
      const route = RoutePreservationService.getAndClearIntendedRoute();
      
      expect(route).toBe('/dashboard');
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-PRESERVATION] Retrieved and cleared intended route: /dashboard'
      );
    });

    it('should return default route when no intended route exists', () => {
      const route = RoutePreservationService.getAndClearIntendedRoute();
      
      expect(route).toBe('/');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[ROUTE-PRESERVATION] No intended route found, using default: /'
      );
    });
  });

  describe('getIntendedRoute', () => {
    it('should return intended route without clearing it', () => {
      sessionStorage.setItem('stonecaster_intended_route', '/dashboard');
      
      const route = RoutePreservationService.getIntendedRoute();
      
      expect(route).toBe('/dashboard');
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBe('/dashboard');
    });

    it('should return default route when no intended route exists', () => {
      const route = RoutePreservationService.getIntendedRoute();
      
      expect(route).toBe('/');
    });
  });

  describe('clearIntendedRoute', () => {
    it('should clear intended route from sessionStorage', () => {
      sessionStorage.setItem('stonecaster_intended_route', '/dashboard');
      
      RoutePreservationService.clearIntendedRoute();
      
      expect(sessionStorage.getItem('stonecaster_intended_route')).toBeNull();
    });
  });

  describe('isSafeRoute', () => {
    it('should return true for safe routes', () => {
      expect(RoutePreservationService.isSafeRoute('/')).toBe(true);
      expect(RoutePreservationService.isSafeRoute('/stories')).toBe(true);
      expect(RoutePreservationService.isSafeRoute('/worlds')).toBe(true);
      expect(RoutePreservationService.isSafeRoute('/stories/mystika-tutorial')).toBe(true);
      expect(RoutePreservationService.isSafeRoute('/worlds/mystika')).toBe(true);
    });

    it('should return false for unsafe routes', () => {
      expect(RoutePreservationService.isSafeRoute('/dashboard')).toBe(false);
      expect(RoutePreservationService.isSafeRoute('/profile')).toBe(false);
      expect(RoutePreservationService.isSafeRoute('/wallet')).toBe(false);
    });
  });

  describe('getSafeSignoutRoute', () => {
    it('should return current route if it is safe', () => {
      const route = RoutePreservationService.getSafeSignoutRoute('/stories');
      
      expect(route).toBe('/stories');
    });

    it('should return landing page for unsafe routes', () => {
      const route = RoutePreservationService.getSafeSignoutRoute('/dashboard');
      
      expect(route).toBe('/');
    });
  });
});
