/**
 * Prompt Segments Admin Service
 * Phase 4: Global CRUD operations for all prompt segment scopes
 */

import { supabase } from '@/lib/supabase';

export interface PromptSegment {
  id: string;
  scope: 'core' | 'ruleset' | 'world' | 'entry' | 'entry_start' | 'npc' | 'game_state' | 'player' | 'rng' | 'input';
  ref_id: string;
  content: string;
  metadata: {
    kind?: string;
    tier?: number;
    locale?: string;
    notes?: string;
    [key: string]: any;
  };
  version: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SegmentFilters {
  scope?: string[];
  refKind?: 'world' | 'ruleset' | 'entry' | 'npc' | 'none';
  refId?: string;
  locale?: string;
  active?: boolean;
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface SegmentListResponse {
  data: PromptSegment[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface NearDuplicate {
  id: string;
  content: string;
  similarity: number;
}

export interface CreateSegmentData {
  scope: 'entry' | 'entry_start';
  ref_id: string;
  content: string;
  metadata?: {
    kind?: string;
    tier?: string;
    locale?: string;
    notes?: string;
    [key: string]: any;
  };
  version?: string;
  active?: boolean;
}

export interface UpdateSegmentData {
  content?: string;
  metadata?: {
    kind?: string;
    tier?: string;
    locale?: string;
    notes?: string;
    [key: string]: any;
  };
  version?: string;
  active?: boolean;
}

export class SegmentsService {
  /**
   * List all segments with filters and pagination
   */
  async listSegments(filters: SegmentFilters = {}): Promise<SegmentListResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('prompt_segments')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    // Apply filters
    if (filters.scope && filters.scope.length > 0) {
      query = query.in('scope', filters.scope);
    }

    if (filters.refId) {
      query = query.eq('ref_id', filters.refId);
    }

    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    if (filters.locale) {
      query = query.eq('metadata->>locale', filters.locale);
    }

    if (filters.q) {
      // Try full-text search first, fallback to ILIKE
      query = query.or(`content.ilike.%${filters.q}%,search_text.fts.${filters.q}`);
    }

    // Apply pagination
    const limit = filters.limit || 20;
    if (filters.cursor) {
      query = query.lt('updated_at', filters.cursor);
    }
    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    const hasMore = (data || []).length > limit;
    const segments = hasMore ? (data || []).slice(0, limit) : (data || []);
    const nextCursor = hasMore ? segments[segments.length - 1]?.updated_at : undefined;

    return {
      data: segments,
      hasMore,
      nextCursor
    };
  }

  /**
   * Get available locales from existing segments
   */
  async getAvailableLocales(): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('metadata')
      .not('metadata->>locale', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch locales: ${error.message}`);
    }

    const locales = new Set<string>();
    (data || []).forEach(segment => {
      if (segment.metadata?.locale) {
        locales.add(segment.metadata.locale);
      }
    });

    return Array.from(locales).sort();
  }

  /**
   * Find near duplicates by content hash
   */
  async findNearDuplicates(params: {
    scope: string;
    refId?: string;
    contentHash: string;
    excludeId?: string;
  }): Promise<NearDuplicate[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Use RPC for content hash comparison
    const { data, error } = await supabase.rpc('find_segment_duplicates', {
      p_scope: params.scope,
      p_content: params.contentHash, // Using contentHash as the content to match
      p_ref_id: params.refId || null,
      p_exclude_id: params.excludeId || null
    });

    if (error) {
      throw new Error(`Failed to find duplicates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Compute content hash for duplicate detection
   */
  computeContentHash(content: string): string {
    // Simple hash function for client-side duplicate detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clone segment to new locale
   */
  async cloneToLocale(segmentId: string, newLocale: string): Promise<PromptSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Get original segment
    const original = await this.getSegment(segmentId);
    
    // Create new segment with updated locale
    const clonedData = {
      ...original,
      metadata: {
        ...original.metadata,
        locale: newLocale
      }
    };

    delete (clonedData as any).id;
    delete (clonedData as any).created_at;
    delete (clonedData as any).updated_at;

    return this.createSegment(clonedData);
  }

  /**
   * Bulk activate/deactivate segments
   */
  async bulkToggleActive(segmentIds: string[], active: boolean): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('prompt_segments')
      .update({ active })
      .in('id', segmentIds);

    if (error) {
      throw new Error(`Failed to bulk toggle segments: ${error.message}`);
    }
  }

  /**
   * Export segments to JSON
   */
  async exportSegments(segmentIds: string[]): Promise<any[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('id, scope, ref_id, version, active, content, metadata')
      .in('id', segmentIds);

    if (error) {
      throw new Error(`Failed to export segments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Import segments from JSON
   */
  async importSegments(segments: any[]): Promise<PromptSegment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Validate segments
    for (const segment of segments) {
      if (!segment.scope || !segment.content) {
        throw new Error('Invalid segment data: missing required fields');
      }
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .upsert(segments, { onConflict: 'id' })
      .select();

    if (error) {
      throw new Error(`Failed to import segments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get segments for an entry point (legacy method for Phase 3 compatibility)
   */
  async getEntrySegments(entryId: string): Promise<PromptSegment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('*')
      .eq('ref_id', entryId)
      .in('scope', ['entry', 'entry_start'])
      .order('scope', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new segment
   */
  async createSegment(data: CreateSegmentData): Promise<PromptSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const segmentData = {
      ...data,
      version: data.version || '1.0.0',
      active: data.active ?? true,
      metadata: data.metadata || {}
    };

    const { data: result, error } = await supabase
      .from('prompt_segments')
      .insert(segmentData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create segment: ${error.message}`);
    }

    return result;
  }

  /**
   * Update a segment
   */
  async updateSegment(id: string, data: UpdateSegmentData): Promise<PromptSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data: result, error } = await supabase
      .from('prompt_segments')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update segment: ${error.message}`);
    }

    return result;
  }

  /**
   * Delete a segment
   */
  async deleteSegment(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('prompt_segments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete segment: ${error.message}`);
    }
  }

  /**
   * Toggle segment active status
   */
  async toggleSegmentActive(id: string): Promise<PromptSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from('prompt_segments')
      .select('active')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch segment: ${fetchError.message}`);
    }

    // Toggle the active state
    const { data: result, error } = await supabase
      .from('prompt_segments')
      .update({ active: !current.active })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to toggle segment: ${error.message}`);
    }

    return result;
  }

  /**
   * Get segment by ID
   */
  async getSegment(id: string): Promise<PromptSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch segment: ${error.message}`);
    }

    return data;
  }

  /**
   * Validate segment metadata JSON
   */
  validateMetadata(metadata: any): { valid: boolean; error?: string } {
    try {
      if (typeof metadata !== 'object' || metadata === null) {
        return { valid: false, error: 'Metadata must be an object' };
      }

      // Check for common required fields
      if (metadata.kind && typeof metadata.kind !== 'string') {
        return { valid: false, error: 'Kind must be a string' };
      }

      if (metadata.tier && typeof metadata.tier !== 'string') {
        return { valid: false, error: 'Tier must be a string' };
      }

      if (metadata.locale && typeof metadata.locale !== 'string') {
        return { valid: false, error: 'Locale must be a string' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid metadata format' };
    }
  }

  /**
   * Get default metadata for a segment type
   */
  getDefaultMetadata(scope: 'entry' | 'entry_start'): Record<string, any> {
    const base = {
      kind: scope === 'entry' ? 'main' : 'start',
      tier: 'standard',
      locale: 'en-US'
    };

    if (scope === 'entry_start') {
      return {
        ...base,
        kind: 'start',
        notes: 'Entry point start prompt'
      };
    }

    return {
      ...base,
      notes: 'Main entry point prompt'
    };
  }
}

export const segmentsService = new SegmentsService();
