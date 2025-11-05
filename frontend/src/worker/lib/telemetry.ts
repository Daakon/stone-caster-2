/**
 * Telemetry Helper for Cloudflare Worker
 * Phase B3: Track events for monitoring and observability
 */

/**
 * Track a telemetry event
 * Uses Workers Analytics Engine if available, otherwise falls back to LOG sink
 * @param env - Worker environment
 * @param name - Event name
 * @param fields - Additional fields to include
 */
export async function track(env: any, name: string, fields: Record<string, any> = {}): Promise<void> {
  try {
    if (env.ANALYTICS) {
      // Workers Analytics Engine binding
      await env.ANALYTICS.writeDataPoint({
        blobs: [name],
        doubles: [],
        indexes: [],
      });
    } else if (env.LOG?.write) {
      // Fallback to LOG sink
      await env.LOG.write(
        JSON.stringify({
          event: name,
          ts: Date.now(),
          ...fields,
        })
      );
    }
  } catch {
    // Non-blocking - telemetry failures should not break the request
  }
}

