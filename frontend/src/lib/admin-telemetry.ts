/**
 * Admin Telemetry
 * Client-side telemetry for admin actions
 */

import { apiPost } from './api';

/**
 * Track admin telemetry event
 * Silently fails if telemetry is unavailable
 */
export async function trackAdminEvent(
  event: string,
  props?: Record<string, any>
): Promise<void> {
  // Disable telemetry during testing
  if (import.meta.env.MODE === 'test' || import.meta.env.DISABLE_TELEMETRY === 'true') {
    return;
  }

  try {
    await apiPost('/api/telemetry/event', {
      name: `admin.${event}`,
      props: {
        ...props,
        timestamp: Date.now(),
        url: window.location.href,
      },
    });
  } catch (error) {
    // Silently fail - telemetry should never break the user experience
    console.debug('Telemetry event failed:', error);
  }
}

