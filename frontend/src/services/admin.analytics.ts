import { supabase } from '@/lib/supabase';

export interface OverviewCards {
  activePublicEntries: number;
  pendingReviews: number;
  avgReviewSLA: number;
  gamesStarted7d: number;
  tokensUsed7d: number;
}

export interface DailySeries {
  day: string;
  value: number;
}

export interface AnalyticsFilters {
  sinceDays?: number;
  metric?: 'submissions' | 'approvals' | 'active_public' | 'games_started' | 'tokens_used';
}

export interface ReviewSLA {
  avgHours: number;
  totalReviews: number;
  reviewsUnder24h: number;
  reviewsUnder48h: number;
  reviewsUnder72h: number;
}

export class AdminAnalyticsService {
  /**
   * Get overview KPI cards
   */
  static async getOverviewCards(filters: AnalyticsFilters = {}): Promise<OverviewCards> {
    const { sinceDays = 7 } = filters;

    // Active public entries
    const { data: activeEntries, error: activeError } = await supabase
      .from('entry_points')
      .select('id', { count: 'exact' })
      .eq('lifecycle', 'active')
      .eq('visibility', 'public');

    if (activeError) {
      throw new Error(`Failed to fetch active entries: ${activeError.message}`);
    }

    // Pending reviews
    const { data: pendingReviews, error: pendingError } = await supabase
      .from('content_reviews')
      .select('id', { count: 'exact' })
      .eq('state', 'open');

    if (pendingError) {
      throw new Error(`Failed to fetch pending reviews: ${pendingError.message}`);
    }

    // Average review SLA (last 30 days)
    const { data: slaData, error: slaError } = await supabase
      .rpc('get_review_sla_30d');

    if (slaError) {
      throw new Error(`Failed to fetch review SLA: ${slaError.message}`);
    }

    // Games started in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - sinceDays);

    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (gamesError) {
      throw new Error(`Failed to fetch games started: ${gamesError.message}`);
    }

    // Tokens used in last 7 days (if available)
    let tokensUsed = 0;
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('turns')
        .select('tokens_in, tokens_out')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (!tokensError && tokensData) {
        tokensUsed = tokensData.reduce((sum, turn) => {
          return sum + (turn.tokens_in || 0) + (turn.tokens_out || 0);
        }, 0);
      }
    } catch (error) {
      // Tokens data not available, use 0
      console.warn('Tokens data not available:', error);
    }

    return {
      activePublicEntries: activeEntries?.length || 0,
      pendingReviews: pendingReviews?.length || 0,
      avgReviewSLA: slaData?.[0]?.avg_hours || 0,
      gamesStarted7d: gamesData?.length || 0,
      tokensUsed7d: tokensUsed
    };
  }

  /**
   * Get daily series data for charts
   */
  static async getDailySeries(filters: AnalyticsFilters = {}): Promise<DailySeries[]> {
    const { metric = 'submissions', sinceDays = 30 } = filters;

    let viewName = '';
    switch (metric) {
      case 'submissions':
        viewName = 'v_daily_submissions';
        break;
      case 'approvals':
        viewName = 'v_daily_approvals';
        break;
      case 'active_public':
        viewName = 'v_daily_active_public';
        break;
      case 'games_started':
        viewName = 'v_daily_games_started';
        break;
      case 'tokens_used':
        viewName = 'v_daily_tokens_used';
        break;
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays);

    const { data, error } = await supabase
      .from(viewName)
      .select('*')
      .gte('day', cutoffDate.toISOString().split('T')[0])
      .order('day');

    if (error) {
      // If it's a tokens metric and the view doesn't exist, return empty data
      if (metric === 'tokens_used' && error.message.includes('does not exist')) {
        return [];
      }
      throw new Error(`Failed to fetch daily series: ${error.message}`);
    }

    return data?.map(row => ({
      day: row.day,
      value: row[metric.replace('_', '_')] || 0
    })) || [];
  }

  /**
   * Get review SLA metrics
   */
  static async getReviewSLA(filters: AnalyticsFilters = {}): Promise<ReviewSLA> {
    const { sinceDays = 30 } = filters;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays);

    // Get all resolved reviews in the period
    const { data: reviews, error } = await supabase
      .from('content_reviews')
      .select('created_at, updated_at, state')
      .in('state', ['approved', 'rejected', 'changes_requested'])
      .gte('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch review SLA data: ${error.message}`);
    }

    if (!reviews || reviews.length === 0) {
      return {
        avgHours: 0,
        totalReviews: 0,
        reviewsUnder24h: 0,
        reviewsUnder48h: 0,
        reviewsUnder72h: 0
      };
    }

    // Calculate hours for each review
    const reviewHours = reviews.map(review => {
      const created = new Date(review.created_at);
      const updated = new Date(review.updated_at);
      return (updated.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    });

    const avgHours = reviewHours.reduce((sum, hours) => sum + hours, 0) / reviewHours.length;
    const reviewsUnder24h = reviewHours.filter(hours => hours <= 24).length;
    const reviewsUnder48h = reviewHours.filter(hours => hours <= 48).length;
    const reviewsUnder72h = reviewHours.filter(hours => hours <= 72).length;

    return {
      avgHours,
      totalReviews: reviews.length,
      reviewsUnder24h,
      reviewsUnder48h,
      reviewsUnder72h
    };
  }

  /**
   * Get creator activity metrics
   */
  static async getCreatorActivity(filters: AnalyticsFilters = {}): Promise<{
    activeCreators: number;
    newCreators: number;
    topCreators: Array<{ user_id: string; submissions: number; approvals: number }>;
  }> {
    const { sinceDays = 30 } = filters;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays);

    // Active creators (submitted content in period)
    const { data: activeCreators, error: activeError } = await supabase
      .from('content_reviews')
      .select('submitted_by')
      .gte('created_at', cutoffDate.toISOString());

    if (activeError) {
      throw new Error(`Failed to fetch active creators: ${activeError.message}`);
    }

    const uniqueActiveCreators = new Set(activeCreators?.map(r => r.submitted_by) || []);

    // New creators (first submission in period)
    const { data: allSubmissions, error: allError } = await supabase
      .from('content_reviews')
      .select('submitted_by, created_at')
      .order('created_at');

    if (allError) {
      throw new Error(`Failed to fetch all submissions: ${allError.message}`);
    }

    const creatorFirstSubmission = new Map();
    allSubmissions?.forEach(submission => {
      if (!creatorFirstSubmission.has(submission.submitted_by)) {
        creatorFirstSubmission.set(submission.submitted_by, submission.created_at);
      }
    });

    const newCreators = Array.from(creatorFirstSubmission.entries())
      .filter(([_, firstSubmission]) => new Date(firstSubmission) >= cutoffDate)
      .length;

    // Top creators by submissions and approvals
    const creatorStats = new Map();
    allSubmissions?.forEach(submission => {
      const creatorId = submission.submitted_by;
      if (!creatorStats.has(creatorId)) {
        creatorStats.set(creatorId, { submissions: 0, approvals: 0 });
      }
      creatorStats.get(creatorId).submissions++;
    });

    // Get approvals for each creator
    const { data: approvals, error: approvalsError } = await supabase
      .from('content_reviews')
      .select('submitted_by, state')
      .eq('state', 'approved')
      .gte('updated_at', cutoffDate.toISOString());

    if (!approvalsError && approvals) {
      approvals.forEach(approval => {
        const creatorId = approval.submitted_by;
        if (creatorStats.has(creatorId)) {
          creatorStats.get(creatorId).approvals++;
        }
      });
    }

    const topCreators = Array.from(creatorStats.entries())
      .map(([user_id, stats]) => ({ user_id, ...stats }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 10);

    return {
      activeCreators: uniqueActiveCreators.size,
      newCreators,
      topCreators
    };
  }
}
