/**
 * Reviews Admin Service
 * Phase 5: Moderation workflow and review management
 */

import { supabase } from '@/lib/supabase';

export type ReviewState = 'open' | 'changes_requested' | 'rejected' | 'approved';
export type ReviewTargetType = 'entry_point' | 'prompt_segment' | 'npc';

export interface ContentReview {
  id: string;
  target_type: ReviewTargetType;
  target_id: string;
  state: ReviewState;
  submitted_by: string;
  reviewer_id?: string;
  notes: string[];
  created_at: string;
  updated_at: string;
  // Joined data for display
  submitter_name?: string;
  reviewer_name?: string;
  target_title?: string;
}

export interface ReviewFilters {
  state?: ReviewState[];
  target_type?: ReviewTargetType[];
  reviewer?: 'me' | 'all';
  submitted_by?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface ReviewListResponse {
  data: ContentReview[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ReviewAction {
  id: string;
  review_id: string;
  actor_id: string;
  action: 'approve' | 'reject' | 'request_changes' | 'assign' | 'note';
  notes?: string;
  created_at: string;
  // Joined data
  actor_name?: string;
}

export interface ReviewDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
}

export class ReviewsService {
  /**
   * List reviews with filters and pagination
   */
  async listReviews(filters: ReviewFilters = {}): Promise<ReviewListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('content_reviews')
      .select(`
        *,
        submitter:submitted_by (
          id,
          email,
          raw_user_meta_data
        ),
        reviewer:reviewer_id (
          id,
          email,
          raw_user_meta_data
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.state && filters.state.length > 0) {
      query = query.in('state', filters.state);
    }

    if (filters.target_type && filters.target_type.length > 0) {
      query = query.in('target_type', filters.target_type);
    }

    if (filters.reviewer === 'me') {
      query = query.eq('reviewer_id', session.user.id);
    }

    if (filters.submitted_by) {
      query = query.eq('submitted_by', filters.submitted_by);
    }

    if (filters.q) {
      // Search by target_id or join with target tables for title search
      query = query.or(`target_id.ilike.%${filters.q}%`);
    }

    // Apply pagination
    const limit = filters.limit || 20;
    if (filters.cursor) {
      query = query.lt('created_at', filters.cursor);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch reviews: ${error.message}`);
    }

    const hasMore = (data || []).length > limit;
    const reviews = hasMore ? (data || []).slice(0, limit) : (data || []);
    const nextCursor = hasMore ? reviews[reviews.length - 1]?.created_at : undefined;

    // Transform data for display
    const transformedReviews = reviews.map(review => ({
      ...review,
      submitter_name: review.submitter?.email || review.submitter?.raw_user_meta_data?.name || 'Unknown',
      reviewer_name: review.reviewer?.email || review.reviewer?.raw_user_meta_data?.name || 'Unassigned',
      target_title: this.getTargetTitle(review.target_type, review.target_id)
    }));

    return {
      data: transformedReviews,
      hasMore,
      nextCursor
    };
  }

  /**
   * Get single review by ID
   */
  async getReview(id: string): Promise<ContentReview | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('content_reviews')
      .select(`
        *,
        submitter:submitted_by (
          id,
          email,
          raw_user_meta_data
        ),
        reviewer:reviewer_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch review: ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      submitter_name: data.submitter?.email || data.submitter?.raw_user_meta_data?.name || 'Unknown',
      reviewer_name: data.reviewer?.email || data.reviewer?.raw_user_meta_data?.name || 'Unassigned',
      target_title: this.getTargetTitle(data.target_type, data.target_id)
    };
  }

  /**
   * Update review state and handle lifecycle transitions
   */
  async updateReviewState(
    id: string, 
    state: ReviewState, 
    note?: string
  ): Promise<ContentReview> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get current review
    const review = await this.getReview(id);
    if (!review) {
      throw new Error('Review not found');
    }

    // Update review state
    const { data: updatedReview, error: reviewError } = await supabase
      .from('content_reviews')
      .update({
        state,
        reviewer_id: session.user.id,
        notes: note ? [...(review.notes || []), note] : review.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (reviewError) {
      throw new Error(`Failed to update review: ${reviewError.message}`);
    }

    // Update target lifecycle based on review state
    await this.updateTargetLifecycle(review.target_type, review.target_id, state);

    // Log the action
    await this.logAction(id, session.user.id, state, note);

    return updatedReview;
  }

  /**
   * Assign reviewer to review
   */
  async attachReviewer(id: string): Promise<ContentReview> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('content_reviews')
      .update({
        reviewer_id: session.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign reviewer: ${error.message}`);
    }

    // Log the assignment
    await this.logAction(id, session.user.id, 'assign');

    return data;
  }

  /**
   * Log review action for audit trail
   */
  async logAction(
    reviewId: string, 
    actorId: string, 
    action: string, 
    notes?: string
  ): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('review_actions')
      .insert({
        review_id: reviewId,
        actor_id: actorId,
        action,
        notes,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log action:', error);
      // Don't throw here as it's not critical
    }
  }

  /**
   * Get review actions for audit trail
   */
  async getReviewActions(reviewId: string): Promise<ReviewAction[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('review_actions')
      .select(`
        *,
        actor:actor_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch review actions: ${error.message}`);
    }

    return (data || []).map(action => ({
      ...action,
      actor_name: action.actor?.email || action.actor?.raw_user_meta_data?.name || 'Unknown'
    }));
  }

  /**
   * Get target content for review
   */
  async getTargetContent(targetType: ReviewTargetType, targetId: string): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let tableName = '';
    let selectFields = '';

    switch (targetType) {
      case 'entry_point':
        tableName = 'entry_points';
        selectFields = 'id, title, description, content, lifecycle, updated_at';
        break;
      case 'prompt_segment':
        tableName = 'prompt_segments';
        selectFields = 'id, content, scope, ref_id, version, active, updated_at';
        break;
      case 'npc':
        tableName = 'npcs';
        selectFields = 'id, doc, updated_at';
        break;
      default:
        throw new Error(`Unsupported target type: ${targetType}`);
    }

    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .eq('id', targetId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch target content: ${error.message}`);
    }

    return data;
  }

  /**
   * Get previous approved version for diff
   */
  async getPreviousVersion(targetType: ReviewTargetType, targetId: string): Promise<any> {
    // This would typically query a version history table
    // For now, we'll return null as version history isn't implemented yet
    return null;
  }

  /**
   * Compute diff between versions
   */
  async computeDiff(targetType: ReviewTargetType, targetId: string): Promise<ReviewDiff> {
    const current = await this.getTargetContent(targetType, targetId);
    const previous = await this.getPreviousVersion(targetType, targetId);

    if (!previous) {
      return {
        added: [current.content || current.title || 'New content'],
        removed: [],
        unchanged: []
      };
    }

    // Simple text diff implementation
    const currentText = current.content || current.title || '';
    const previousText = previous.content || previous.title || '';

    const currentLines = currentText.split('\n');
    const previousLines = previousText.split('\n');

    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(currentLines.length, previousLines.length);
    for (let i = 0; i < maxLines; i++) {
      const currentLine = currentLines[i] || '';
      const previousLine = previousLines[i] || '';

      if (currentLine === previousLine) {
        unchanged.push(currentLine);
      } else if (currentLine && !previousLine) {
        added.push(currentLine);
      } else if (!currentLine && previousLine) {
        removed.push(previousLine);
      } else {
        added.push(currentLine);
        removed.push(previousLine);
      }
    }

    return { added, removed, unchanged };
  }

  /**
   * Update target lifecycle based on review state
   */
  private async updateTargetLifecycle(
    targetType: ReviewTargetType, 
    targetId: string, 
    state: ReviewState
  ): Promise<void> {
    let lifecycleValue = '';

    switch (state) {
      case 'approved':
        lifecycleValue = 'active';
        break;
      case 'changes_requested':
        lifecycleValue = 'changes_requested';
        break;
      case 'rejected':
        lifecycleValue = 'rejected';
        break;
      default:
        return; // No lifecycle update needed
    }

    // Update the appropriate table
    let tableName = '';
    switch (targetType) {
      case 'entry_point':
        tableName = 'entry_points';
        break;
      case 'prompt_segment':
        tableName = 'prompt_segments';
        break;
      case 'npc':
        // NPCs don't have lifecycle, skip
        return;
      default:
        return;
    }

    const { error } = await supabase
      .from(tableName)
      .update({ lifecycle: lifecycleValue })
      .eq('id', targetId);

    if (error) {
      console.error('Failed to update target lifecycle:', error);
      // Don't throw as this is not critical for the review process
    }
  }

  /**
   * Get target title for display
   */
  private getTargetTitle(targetType: ReviewTargetType, targetId: string): string {
    // This would typically be resolved from the target data
    // For now, return a placeholder
    return `${targetType} ${targetId}`;
  }
}

export const reviewsService = new ReviewsService();


