import { supabaseAdmin } from './supabase.js';
import { configService } from './config.service.js';

export interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetTime: Date;
}

export interface CookieIssueRequest {
  ipAddress: string;
  userAgent?: string;
}

export class RateLimitService {
  /**
   * Check if cookie issuance is allowed for the given IP
   */
  static async checkCookieIssueRateLimit(ipAddress: string): Promise<boolean> {
    try {
      const config = await configService.getConfig();
      const rateLimit = config.app?.guest_cookie_issue_rate_limit_per_hour?.value || 10;

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Get recent requests from this IP
      const { data: recentRequests, error } = await supabaseAdmin
        .from('cookie_issue_requests')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (recentRequests?.length || 0) < rateLimit;
    } catch (error) {
      console.error('Error checking cookie issue rate limit:', error);
      throw error;
    }
  }

  /**
   * Record a cookie issue request
   */
  static async recordCookieIssueRequest(request: CookieIssueRequest): Promise<{
    id: string;
    ip_address: string;
    user_agent?: string;
    created_at: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('cookie_issue_requests')
        .insert({
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording cookie issue request:', error);
      throw error;
    }
  }

  /**
   * Get rate limit information for an IP address
   */
  static async getRateLimitInfo(ipAddress: string): Promise<RateLimitInfo> {
    try {
      const config = await configService.getConfig();
      const rateLimit = config.app?.guest_cookie_issue_rate_limit_per_hour?.value || 10;

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Get recent requests from this IP
      const { data: recentRequests, error } = await supabaseAdmin
        .from('cookie_issue_requests')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const used = recentRequests?.length || 0;
      const remaining = Math.max(0, rateLimit - used);
      
      // Reset time is one hour from the oldest request, or now if no requests
      const resetTime = recentRequests && recentRequests.length > 0
        ? new Date(new Date(recentRequests[recentRequests.length - 1].created_at).getTime() + 60 * 60 * 1000)
        : new Date();

      return {
        limit: rateLimit,
        used,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('Error getting rate limit info:', error);
      throw error;
    }
  }

  /**
   * Clean up old rate limit records (can be called periodically)
   */
  static async cleanupOldRecords(): Promise<number> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data, error } = await supabaseAdmin
        .from('cookie_issue_requests')
        .delete()
        .lt('created_at', oneDayAgo.toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up old rate limit records:', error);
      throw error;
    }
  }
}
