import { supabaseAdmin } from './supabase.js';
import { configService } from './config.service.js';

export interface TelemetryEvent {
  name: string;
  props: Record<string, any>;
  traceId: string;
  userId?: string;
  cookieId?: string;
}

export interface TelemetryResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export class TelemetryService {
  /**
   * Record a telemetry event
   * 
   * @param event - The telemetry event to record
   * @returns Promise<TelemetryResult> - Result of the recording attempt
   */
  static async recordEvent(event: TelemetryEvent): Promise<TelemetryResult> {
    try {
      // Check if telemetry is enabled
      const features = configService.getFeatures();
      const telemetryEnabled = features.find(f => f.key === 'telemetry_enabled')?.enabled || false;
      
      if (!telemetryEnabled) {
        return { success: true, eventId: 'disabled' };
      }

      // Check sample rate
      const appConfig = configService.getApp();
      const sampleRate = appConfig.telemetrySampleRate || 0.0;
      if (Math.random() > sampleRate) {
        return { success: true, eventId: 'sampled_out' };
      }

      // Record the event in the database
      const { data, error } = await supabaseAdmin
        .from('telemetry_events')
        .insert({
          name: event.name,
          props: event.props,
          trace_id: event.traceId,
          user_id: event.userId,
          cookie_id: event.cookieId,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Telemetry recording failed:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }

      return { 
        success: true, 
        eventId: data?.id 
      };
    } catch (error) {
      console.error('Telemetry service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Record a gameplay telemetry event with enhanced context
   * 
   * @param event - The gameplay telemetry event to record
   * @returns Promise<TelemetryResult> - Result of the recording attempt
   */
  static async recordGameplayEvent(event: TelemetryEvent): Promise<TelemetryResult> {
    // For now, use the same logic as recordEvent
    // This could be enhanced with gameplay-specific logic in the future
    return this.recordEvent(event);
  }
}

// Export the service as a default export for compatibility
export default TelemetryService;