/**
 * Publishing Telemetry Module
 * Phase 5: Centralized event emission for publishing actions
 */

import { isPublishingTelemetryEnabled } from '../config/featureFlags.js';

/**
 * Normalized publishing event names
 */
export type PublishingEventName =
  | 'publish.requested'
  | 'publish.blocked'
  | 'admin.review.approved'
  | 'admin.review.rejected'
  | 'dependency.invalid.set'
  | 'dependency.invalid.cleared'
  | 'media.cover_made_public';

/**
 * Telemetry event payload
 */
export interface PublishingEventPayload {
  [key: string]: unknown;
}

/**
 * Telemetry provider function signature
 */
type TelemetryProvider = (eventName: string, payload: PublishingEventPayload) => void;

/**
 * Default console provider (logs to server console)
 */
function consoleProvider(eventName: string, payload: PublishingEventPayload): void {
  console.log(`[publishing] ${eventName}`, JSON.stringify(payload, null, 2));
}

/**
 * No-op provider (does nothing)
 */
function noopProvider(_eventName: string, _payload: PublishingEventPayload): void {
  // No-op
}

/**
 * Get the active telemetry provider based on environment
 */
function getTelemetryProvider(): TelemetryProvider {
  const provider = process.env.PUBLISHING_TELEMETRY_PROVIDER || 'console';
  
  if (provider === 'none') {
    return noopProvider;
  }
  
  if (provider === 'console') {
    return consoleProvider;
  }
  
  // Future: support custom providers via dynamic import
  // For now, default to console
  return consoleProvider;
}

/**
 * Emit a publishing telemetry event
 * Phase 5: Centralized event emission with feature flag guard
 * 
 * @param eventName - Normalized event name (e.g., 'publish.requested')
 * @param payload - Event payload (will be serialized)
 */
export function emitPublishingEvent(
  eventName: PublishingEventName | string,
  payload: PublishingEventPayload
): void {
  // Check feature flag
  if (!isPublishingTelemetryEnabled()) {
    return; // No-op when flag is off
  }

  try {
    const provider = getTelemetryProvider();
    provider(eventName, payload);
  } catch (error) {
    // Never crash on telemetry errors
    console.error('[publishing] Telemetry error (non-fatal):', error);
  }
}


