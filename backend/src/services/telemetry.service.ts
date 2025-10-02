import { supabaseAdmin } from './supabase.js';
import { configService } from './config.service.js';
import type { TelemetryEventRequest } from 'shared';

export interface TelemetryEventRecord {
  name: string;
  props: Record<string, unknown>;
  traceId: string;
  userId?: string;
  cookieId?: string;
}

export interface TelemetryResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  eventId?: string;
}

export class TelemetryService {
  /**
   * Record a telemetry event with sampling and feature flag checks
   */
  static async recordEvent(event: TelemetryEventRecord): Promise<TelemetryResult> {
    try {
      // Validate required parameters
      if (!event.name || !event.traceId) {
        throw new Error('Missing required parameters: name and traceId are required');
      }

      // Get configuration
      const config = await configService.getConfig();

      // Check if telemetry is enabled
      const telemetryEnabled = config.featureFlags?.telemetry_enabled?.enabled;
      if (!telemetryEnabled) {
        return {
          success: true,
          skipped: true,
          reason: 'telemetry_disabled',
        };
      }

      // Check sampling rate
      const sampleRate = config.app?.telemetry_sample_rate?.value || 0.0;
      if (sampleRate <= 0) {
        return {
          success: true,
          skipped: true,
          reason: 'not_sampled',
        };
      }

      // Apply sampling (simple random sampling)
      if (Math.random() > sampleRate) {
        return {
          success: true,
          skipped: true,
          reason: 'not_sampled',
        };
      }

      // Record the event in the database
      const result = await supabaseAdmin
        .from('telemetry_events')
        .insert({
          name: event.name,
          props: event.props || {},
          trace_id: event.traceId,
          user_id: event.userId || null,
          cookie_id: event.cookieId || null,
        })
        .select('id')
        .single();

      if (result && result.error) {
        throw new Error(`Database error: ${result.error.message}`);
      }

      return {
        success: true,
        eventId: result?.data?.id,
      };
    } catch (error) {
      console.error('Error recording telemetry event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Record multiple telemetry events in batch
   */
  static async recordEvents(events: TelemetryEventRecord[]): Promise<TelemetryResult[]> {
    const results: TelemetryResult[] = [];

    // Process events in parallel for better performance
    const promises = events.map(event => this.recordEvent(event));
    const batchResults = await Promise.allSettled(promises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
      }
    });

    return results;
  }

  /**
   * Get telemetry events for a specific user (admin function)
   */
  static async getUserEvents(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ events: any[]; total: number }> {
    try {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (eventsError) {
        throw new Error(`Database error: ${eventsError.message}`);
      }

      const { count, error: countError } = await supabaseAdmin
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw new Error(`Count error: ${countError.message}`);
      }

      return {
        events: events || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error fetching user telemetry events:', error);
      throw error;
    }
  }

  /**
   * Get telemetry events for a specific trace (debugging function)
   */
  static async getTraceEvents(traceId: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching trace telemetry events:', error);
      throw error;
    }
  }

  /**
   * Clean up old telemetry events (maintenance function)
   */
  static async cleanupOldEvents(retentionDays: number = 30): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin.rpc('cleanup_old_telemetry_events', {
        retention_days: retentionDays,
      });

      if (error) {
        throw new Error(`Cleanup error: ${error.message}`);
      }

      return data || 0;
    } catch (error) {
      console.error('Error cleaning up old telemetry events:', error);
      throw error;
    }
  }

  /**
   * Validate telemetry event request
   */
  static validateEventRequest(request: TelemetryEventRequest): { valid: boolean; error?: string } {
    try {
      if (!request.name || request.name.trim().length === 0) {
        return { valid: false, error: 'Event name is required' };
      }

      if (request.name.length > 100) {
        return { valid: false, error: 'Event name must be 100 characters or less' };
      }

      if (request.props && typeof request.props !== 'object') {
        return { valid: false, error: 'Event props must be an object' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid request format' };
    }
  }
}
