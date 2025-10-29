/**
 * Analytics tracking utilities for StoneCaster
 * 
 * This module provides a simple analytics interface that can be easily
 * extended to integrate with various analytics providers.
 */

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export interface CatalogViewEvent {
  entity: 'stories' | 'worlds' | 'npcs' | 'rulesets';
}

export interface CatalogCardClickEvent {
  entity: 'stories' | 'worlds' | 'npcs' | 'rulesets';
  id_or_slug: string;
}

export interface FilterChangeEvent {
  entity: 'stories' | 'worlds' | 'npcs' | 'rulesets';
  filters: Record<string, any>;
}

// Analytics provider interface
interface AnalyticsProvider {
  track: (event: string, properties?: Record<string, any>) => void;
}

// Default console provider for development
class ConsoleAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: Record<string, any>) {
    console.log('[Analytics]', event, properties);
  }
}

// Production analytics provider (can be replaced with actual service)
class ProductionAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: Record<string, any>) {
    // TODO: Integrate with actual analytics service (e.g., Google Analytics, Mixpanel, etc.)
    // For now, we'll use console in production as well
    console.log('[Analytics]', event, properties);
    
    // Example integration points:
    // - Google Analytics: gtag('event', event, properties)
    // - Mixpanel: mixpanel.track(event, properties)
    // - Amplitude: amplitude.track(event, properties)
  }
}

// Initialize analytics provider based on environment
const analyticsProvider: AnalyticsProvider = 
  process.env.NODE_ENV === 'production' 
    ? new ProductionAnalyticsProvider()
    : new ConsoleAnalyticsProvider();

/**
 * Track an analytics event
 * 
 * @param event - Event name
 * @param properties - Event properties
 */
export function track(event: string, properties?: Record<string, any>): void {
  try {
    analyticsProvider.track(event, {
      ...properties,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error('[Analytics] Failed to track event:', event, error);
  }
}

/**
 * Track catalog page view
 * 
 * @param entity - Type of catalog being viewed
 */
export function trackCatalogView(entity: CatalogViewEvent['entity']): void {
  track('catalog_view', { entity });
}

/**
 * Track catalog card click
 * 
 * @param entity - Type of catalog
 * @param id_or_slug - ID or slug of the clicked item
 */
export function trackCatalogCardClick(
  entity: CatalogCardClickEvent['entity'],
  id_or_slug: string
): void {
  track('catalog_card_click', { entity, id_or_slug });
}

/**
 * Track filter changes
 * 
 * @param entity - Type of catalog
 * @param filters - Current filter state
 */
export function trackFilterChange(
  entity: FilterChangeEvent['entity'],
  filters: Record<string, any>
): void {
  track('filter_change', { entity, filters });
}

/**
 * Track search queries
 * 
 * @param entity - Type of catalog
 * @param query - Search query
 * @param resultCount - Number of results returned
 */
export function trackSearch(
  entity: string,
  query: string,
  resultCount: number
): void {
  track('search', { entity, query, resultCount });
}

/**
 * Track navigation events
 * 
 * @param from - Source page/route
 * @param to - Destination page/route
 */
export function trackNavigation(from: string, to: string): void {
  track('navigation', { from, to });
}

/**
 * Track error events
 * 
 * @param error - Error message or object
 * @param context - Additional context about where the error occurred
 */
export function trackError(error: string | Error, context?: string): void {
  track('error', {
    error: error instanceof Error ? error.message : error,
    context,
    stack: error instanceof Error ? error.stack : undefined
  });
}

/**
 * Track performance metrics
 * 
 * @param metric - Performance metric name
 * @param value - Metric value
 * @param unit - Unit of measurement (e.g., 'ms', 'bytes')
 */
export function trackPerformance(metric: string, value: number, unit?: string): void {
  track('performance', { metric, value, unit });
}

// Export types for use in components
export type {
  AnalyticsEvent,
  CatalogViewEvent,
  CatalogCardClickEvent,
  FilterChangeEvent
};
