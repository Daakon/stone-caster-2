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

export interface StartStoryViewEvent {
  story_id: string;
}

export interface StartStoryAuthChoiceEvent {
  story_id: string;
  method: 'guest' | 'authenticated';
}

export interface CharacterSelectEvent {
  character_id: string;
  story_id: string;
}

export interface CharacterCreateEvent {
  story_id: string;
}

export interface SessionCreatedEvent {
  story_id: string;
  character_id: string;
  session_id: string;
}

export interface StartStoryErrorEvent {
  stage: 'story_fetch' | 'auth' | 'character_select' | 'character_create' | 'session_create';
  message: string;
}

export interface FunnelStageEvent {
	stage: 'view' | 'auth' | 'character' | 'confirm' | 'created';
	ms_since_prev: number;
	timestamp?: number;
	story_id?: string;
	character_id?: string;
	session_id?: string;
}

export interface SessionHeartbeatEvent {
	session_id: string;
	timestamp?: number;
}

const ANALYTICS_DEBUG = typeof window !== 'undefined' && (window as any).PUBLIC_ANALYTICS_DEBUG == 1;

// Analytics provider interface
interface AnalyticsProvider {
  track: (event: string, properties?: Record<string, any>) => void;
}

// Default console provider for development
class ConsoleAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: Record<string, any>) {

  }
}

// Production analytics provider (can be replaced with actual service)
class ProductionAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: Record<string, any>) {
    // TODO: Integrate with actual analytics service (e.g., Google Analytics, Mixpanel, etc.)
    // For now, we'll use console in production as well

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

// ============================================================================
// START STORY FLOW ANALYTICS
// ============================================================================

/**
 * Track start story page view
 * 
 * @param story_id - ID of the story being viewed
 */
export function trackStartStoryView(story_id: string): void {
  track('start_story_view', { story_id });
}

/**
 * Track authentication choice in start story flow
 * 
 * @param story_id - ID of the story
 * @param method - Authentication method chosen
 */
export function trackStartStoryAuthChoice(
  story_id: string,
  method: StartStoryAuthChoiceEvent['method']
): void {
  track('start_story_auth_choice', { story_id, method });
}

/**
 * Track character selection
 * 
 * @param character_id - ID of the selected character
 * @param story_id - ID of the story
 */
export function trackCharacterSelect(character_id: string, story_id: string): void {
  track('character_select', { character_id, story_id });
}

/**
 * Track character creation
 * 
 * @param story_id - ID of the story
 */
export function trackCharacterCreate(story_id: string): void {
  track('character_create', { story_id });
}

/**
 * Track session creation
 * 
 * @param story_id - ID of the story
 * @param character_id - ID of the character
 * @param session_id - ID of the created session
 */
export function trackSessionCreated(
  story_id: string,
  character_id: string,
  session_id: string
): void {
  track('session_created', { story_id, character_id, session_id });
}

/**
 * Track start story flow errors
 * 
 * @param stage - Stage where the error occurred
 * @param message - Error message
 */
export function trackStartStoryError(
  stage: StartStoryErrorEvent['stage'],
  message: string
): void {
  track('start_story_error', { stage, message });
}

export function trackFunnelStage(payload: FunnelStageEvent) {
	const event = { ...payload, timestamp: payload.timestamp ?? Date.now() };
	if (ANALYTICS_DEBUG) {
		// eslint-disable-next-line no-console

	}
	// existing sink
	track('funnel_stage', event as any);
}

let heartbeatInterval: number | undefined;
export function startSessionHeartbeat(sessionId: string) {
	stopSessionHeartbeat();
	const send = () => {
		const event: SessionHeartbeatEvent = { session_id: sessionId, timestamp: Date.now() };
		if (ANALYTICS_DEBUG) {
			// eslint-disable-next-line no-console

		}
		track('session_heartbeat', event as any);
	};
	// Only send when page is visible
	const tick = () => {
		if (document.visibilityState === 'visible') send();
	};
	heartbeatInterval = window.setInterval(tick, 30_000);
	document.addEventListener('visibilitychange', tick);
}

export function stopSessionHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = undefined;
		document.removeEventListener('visibilitychange', () => {});
	}
}

// Export types for use in components
export type {
  AnalyticsEvent,
  CatalogViewEvent,
  CatalogCardClickEvent,
  FilterChangeEvent,
  StartStoryViewEvent,
  StartStoryAuthChoiceEvent,
  CharacterSelectEvent,
  CharacterCreateEvent,
  SessionCreatedEvent,
  StartStoryErrorEvent
};
