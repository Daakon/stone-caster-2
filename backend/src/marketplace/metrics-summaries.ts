// Phase 26: Metrics Summaries Service
// Integrates with Phase 24 rollups to provide pack-specific metrics and telemetry

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const MetricsRequestSchema = z.object({
  namespace: z.string(),
  version: z.string().optional(),
  days_back: z.number().min(1).max(365).default(30)
});

const RatingRequestSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  user_hash: z.string(),
  stars: z.number().min(1).max(5),
  tags: z.array(z.string()).optional(),
  comment: z.string().max(500).optional()
});

export interface PackMetrics {
  namespace: string;
  version: string;
  adoption_count: number;
  error_rate: number;
  violation_rate: number;
  avg_acts_per_turn: number;
  token_budget_usage: number;
  p95_latency_delta_ms: number;
  download_count: number;
  unique_users: number;
  retention_rate: number;
  satisfaction_score: number;
}

export interface PackRating {
  namespace: string;
  version: string;
  user_hash: string;
  stars: number;
  tags: string[];
  comment?: string;
  created_at: string;
}

export interface PackRatingSummary {
  namespace: string;
  version: string;
  total_ratings: number;
  average_stars: number;
  star_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  popular_tags: Array<{
    tag: string;
    count: number;
  }>;
  recent_comments: Array<{
    stars: number;
    comment: string;
    created_at: string;
  }>;
}

export interface TelemetrySnapshot {
  namespace: string;
  version: string;
  snapshot_date: string;
  metrics: PackMetrics;
  ratings: PackRatingSummary;
  trends: {
    adoption_trend: 'increasing' | 'decreasing' | 'stable';
    error_trend: 'improving' | 'worsening' | 'stable';
    satisfaction_trend: 'improving' | 'worsening' | 'stable';
  };
}

export class MetricsSummariesService {
  private supabase: any;
  private kAnonMin: number;

  constructor() {
    this.supabase = supabase;
    this.kAnonMin = parseInt(process.env.MARKETPLACE_KANON_MIN || '10');
  }

  /**
   * Get pack metrics
   */
  async getPackMetrics(
    data: z.infer<typeof MetricsRequestSchema>
  ): Promise<{
    success: boolean;
    data?: PackMetrics;
    error?: string;
  }> {
    try {
      const validated = MetricsRequestSchema.parse(data);
      
      // Get metrics from Phase 24 rollups
      const { data: metricsData, error: metricsError } = await this.supabase
        .from('mod_pack_metrics')
        .select('*')
        .eq('namespace', validated.namespace)
        .gte('metric_date', new Date(Date.now() - validated.days_back * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

      if (metricsError) {
        throw new Error(`Failed to get pack metrics: ${metricsError.message}`);
      }

      if (!metricsData || metricsData.length === 0) {
        return {
          success: true,
          data: {
            namespace: validated.namespace,
            version: validated.version || 'latest',
            adoption_count: 0,
            error_rate: 0,
            violation_rate: 0,
            avg_acts_per_turn: 0,
            token_budget_usage: 0,
            p95_latency_delta_ms: 0,
            download_count: 0,
            unique_users: 0,
            retention_rate: 0,
            satisfaction_score: 0
          }
        };
      }

      // Aggregate metrics
      const aggregated = this.aggregateMetrics(metricsData);

      return {
        success: true,
        data: aggregated
      };
    } catch (error) {
      console.error('Pack metrics retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit rating
   */
  async submitRating(
    data: z.infer<typeof RatingRequestSchema>
  ): Promise<{
    success: boolean;
    data?: PackRating;
    error?: string;
  }> {
    try {
      const validated = RatingRequestSchema.parse(data);
      
      // Check if pack exists and is listed
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('namespace, version, status')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      if (packData.status !== 'listed') {
        throw new Error(`Pack is not available for rating: ${packData.status}`);
      }

      // Check if user has already rated this version
      const { data: existingRating, error: existingError } = await this.supabase
        .from('mod_ratings')
        .select('user_hash')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .eq('user_hash', validated.user_hash)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw new Error(`Failed to check existing rating: ${existingError.message}`);
      }

      if (existingRating) {
        // Update existing rating
        const { data: ratingData, error: updateError } = await this.supabase
          .from('mod_ratings')
          .update({
            stars: validated.stars,
            tags: validated.tags || [],
            comment: validated.comment,
            updated_at: new Date().toISOString()
          })
          .eq('namespace', validated.namespace)
          .eq('version', validated.version)
          .eq('user_hash', validated.user_hash)
          .select('*')
          .single();

        if (updateError) {
          throw new Error(`Failed to update rating: ${updateError.message}`);
        }

        return {
          success: true,
          data: ratingData
        };
      } else {
        // Create new rating
        const { data: ratingData, error: createError } = await this.supabase
          .from('mod_ratings')
          .insert({
            namespace: validated.namespace,
            version: validated.version,
            user_hash: validated.user_hash,
            stars: validated.stars,
            tags: validated.tags || [],
            comment: validated.comment
          })
          .select('*')
          .single();

        if (createError) {
          throw new Error(`Failed to create rating: ${createError.message}`);
        }

        return {
          success: true,
          data: ratingData
        };
      }
    } catch (error) {
      console.error('Rating submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get rating summary
   */
  async getRatingSummary(
    namespace: string,
    version: string
  ): Promise<{
    success: boolean;
    data?: PackRatingSummary;
    error?: string;
  }> {
    try {
      // Get all ratings for the pack
      const { data: ratings, error: ratingsError } = await this.supabase
        .from('mod_ratings')
        .select('*')
        .eq('namespace', namespace)
        .eq('version', version)
        .order('created_at', { ascending: false });

      if (ratingsError) {
        throw new Error(`Failed to get ratings: ${ratingsError.message}`);
      }

      if (!ratings || ratings.length === 0) {
        return {
          success: true,
          data: {
            namespace,
            version,
            total_ratings: 0,
            average_stars: 0,
            star_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            popular_tags: [],
            recent_comments: []
          }
        };
      }

      // Calculate summary
      const totalRatings = ratings.length;
      const averageStars = ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings;
      
      const starDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings.forEach(r => {
        starDistribution[r.stars as keyof typeof starDistribution]++;
      });

      // Calculate popular tags
      const tagCounts = new Map<string, number>();
      ratings.forEach(r => {
        r.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      const popularTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get recent comments
      const recentComments = ratings
        .filter(r => r.comment && r.comment.length > 0)
        .slice(0, 5)
        .map(r => ({
          stars: r.stars,
          comment: r.comment!,
          created_at: r.created_at
        }));

      return {
        success: true,
        data: {
          namespace,
          version,
          total_ratings: totalRatings,
          average_stars: Math.round(averageStars * 10) / 10,
          star_distribution: starDistribution,
          popular_tags: popularTags,
          recent_comments: recentComments
        }
      };
    } catch (error) {
      console.error('Rating summary retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate telemetry snapshot
   */
  async generateTelemetrySnapshot(
    namespace: string,
    version: string
  ): Promise<{
    success: boolean;
    data?: TelemetrySnapshot;
    error?: string;
  }> {
    try {
      // Get metrics
      const metricsResult = await this.getPackMetrics({
        namespace,
        version,
        days_back: 30
      });

      if (!metricsResult.success || !metricsResult.data) {
        throw new Error('Failed to get pack metrics');
      }

      // Get rating summary
      const ratingResult = await this.getRatingSummary(namespace, version);

      if (!ratingResult.success || !ratingResult.data) {
        throw new Error('Failed to get rating summary');
      }

      // Calculate trends
      const trends = await this.calculateTrends(namespace, version);

      return {
        success: true,
        data: {
          namespace,
          version,
          snapshot_date: new Date().toISOString(),
          metrics: metricsResult.data,
          ratings: ratingResult.data,
          trends
        }
      };
    } catch (error) {
      console.error('Telemetry snapshot generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get public metrics (k-anonymized)
   */
  async getPublicMetrics(
    namespace: string,
    version: string
  ): Promise<{
    success: boolean;
    data?: {
      namespace: string;
      version: string;
      adoption_count: number;
      average_stars: number;
      total_ratings: number;
      download_count: number;
      error_rate: number;
      satisfaction_score: number;
    };
    error?: string;
  }> {
    try {
      // Get metrics
      const metricsResult = await this.getPackMetrics({
        namespace,
        version,
        days_back: 30
      });

      if (!metricsResult.success || !metricsResult.data) {
        throw new Error('Failed to get pack metrics');
      }

      // Get rating summary
      const ratingResult = await this.getRatingSummary(namespace, version);

      if (!ratingResult.success || !ratingResult.data) {
        throw new Error('Failed to get rating summary');
      }

      // Apply k-anonymity
      const metrics = metricsResult.data;
      const ratings = ratingResult.data;

      // Only return data if we have enough ratings for k-anonymity
      if (ratings.total_ratings < this.kAnonMin) {
        return {
          success: true,
          data: {
            namespace,
            version,
            adoption_count: 0,
            average_stars: 0,
            total_ratings: 0,
            download_count: 0,
            error_rate: 0,
            satisfaction_score: 0
          }
        };
      }

      return {
        success: true,
        data: {
          namespace,
          version,
          adoption_count: metrics.adoption_count,
          average_stars: ratings.average_stars,
          total_ratings: ratings.total_ratings,
          download_count: metrics.download_count,
          error_rate: metrics.error_rate,
          satisfaction_score: metrics.satisfaction_score
        }
      };
    } catch (error) {
      console.error('Public metrics retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Aggregate metrics from multiple data points
   */
  private aggregateMetrics(metricsData: any[]): PackMetrics {
    const total = metricsData.length;
    
    const aggregated = metricsData.reduce((acc, metric) => ({
      adoption_count: acc.adoption_count + (metric.adoption_count || 0),
      error_rate: acc.error_rate + (metric.error_rate || 0),
      violation_rate: acc.violation_rate + (metric.violation_rate || 0),
      avg_acts_per_turn: acc.avg_acts_per_turn + (metric.avg_acts_per_turn || 0),
      token_budget_usage: acc.token_budget_usage + (metric.token_budget_usage || 0),
      p95_latency_delta_ms: acc.p95_latency_delta_ms + (metric.p95_latency_delta_ms || 0),
      download_count: acc.download_count + (metric.download_count || 0)
    }), {
      adoption_count: 0,
      error_rate: 0,
      violation_rate: 0,
      avg_acts_per_turn: 0,
      token_budget_usage: 0,
      p95_latency_delta_ms: 0,
      download_count: 0
    });

    return {
      namespace: metricsData[0]?.namespace || 'unknown',
      version: metricsData[0]?.version || 'unknown',
      adoption_count: Math.round(aggregated.adoption_count / total),
      error_rate: Math.round((aggregated.error_rate / total) * 100) / 100,
      violation_rate: Math.round((aggregated.violation_rate / total) * 100) / 100,
      avg_acts_per_turn: Math.round((aggregated.avg_acts_per_turn / total) * 100) / 100,
      token_budget_usage: Math.round((aggregated.token_budget_usage / total) * 100) / 100,
      p95_latency_delta_ms: Math.round(aggregated.p95_latency_delta_ms / total),
      download_count: aggregated.download_count,
      unique_users: Math.round(aggregated.adoption_count * 0.8), // Estimate
      retention_rate: Math.round((aggregated.adoption_count / Math.max(aggregated.download_count, 1)) * 100) / 100,
      satisfaction_score: Math.round((aggregated.avg_acts_per_turn / 10) * 100) / 100 // Estimate
    };
  }

  /**
   * Calculate trends
   */
  private async calculateTrends(
    namespace: string,
    version: string
  ): Promise<{
    adoption_trend: 'increasing' | 'decreasing' | 'stable';
    error_trend: 'improving' | 'worsening' | 'stable';
    satisfaction_trend: 'improving' | 'worsening' | 'stable';
  }> {
    try {
      // Get metrics for the last 7 days vs previous 7 days
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { data: recentMetrics, error: recentError } = await this.supabase
        .from('mod_pack_metrics')
        .select('adoption_count, error_rate, avg_acts_per_turn')
        .eq('namespace', namespace)
        .eq('version', version)
        .gte('metric_date', weekAgo.toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

      const { data: previousMetrics, error: previousError } = await this.supabase
        .from('mod_pack_metrics')
        .select('adoption_count, error_rate, avg_acts_per_turn')
        .eq('namespace', namespace)
        .eq('version', version)
        .gte('metric_date', twoWeeksAgo.toISOString().split('T')[0])
        .lt('metric_date', weekAgo.toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

      if (recentError || previousError || !recentMetrics || !previousMetrics) {
        return {
          adoption_trend: 'stable',
          error_trend: 'stable',
          satisfaction_trend: 'stable'
        };
      }

      // Calculate trends
      const recentAvg = this.calculateAverage(recentMetrics);
      const previousAvg = this.calculateAverage(previousMetrics);

      const adoptionTrend = this.determineTrend(recentAvg.adoption_count, previousAvg.adoption_count);
      const errorTrend = this.determineTrend(previousAvg.error_rate, recentAvg.error_rate); // Inverted for error rate
      const satisfactionTrend = this.determineTrend(recentAvg.avg_acts_per_turn, previousAvg.avg_acts_per_turn);

      return {
        adoption_trend: adoptionTrend,
        error_trend: errorTrend,
        satisfaction_trend: satisfactionTrend
      };
    } catch (error) {
      console.error('Trend calculation failed:', error);
      return {
        adoption_trend: 'stable',
        error_trend: 'stable',
        satisfaction_trend: 'stable'
      };
    }
  }

  /**
   * Calculate average from metrics array
   */
  private calculateAverage(metrics: any[]): {
    adoption_count: number;
    error_rate: number;
    avg_acts_per_turn: number;
  } {
    if (metrics.length === 0) {
      return { adoption_count: 0, error_rate: 0, avg_acts_per_turn: 0 };
    }

    const total = metrics.length;
    const sum = metrics.reduce((acc, metric) => ({
      adoption_count: acc.adoption_count + (metric.adoption_count || 0),
      error_rate: acc.error_rate + (metric.error_rate || 0),
      avg_acts_per_turn: acc.avg_acts_per_turn + (metric.avg_acts_per_turn || 0)
    }), { adoption_count: 0, error_rate: 0, avg_acts_per_turn: 0 });

    return {
      adoption_count: sum.adoption_count / total,
      error_rate: sum.error_rate / total,
      avg_acts_per_turn: sum.avg_acts_per_turn / total
    };
  }

  /**
   * Determine trend direction
   */
  private determineTrend(current: number, previous: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.1; // 10% change threshold
    const change = (current - previous) / Math.max(previous, 1);
    
    if (change > threshold) return 'increasing';
    if (change < -threshold) return 'decreasing';
    return 'stable';
  }
}

export const metricsSummariesService = new MetricsSummariesService();
