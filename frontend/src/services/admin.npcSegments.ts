/**
 * NPC Segments Service
 * Phase 6: Tiered prompt segments for NPCs (scope=npc, tiers 0-3)
 */

import { supabase } from '@/lib/supabase';

export interface NPCSegment {
  id: string;
  scope: 'npc';
  ref_id: string; // NPC ID
  content: string;
  metadata: {
    tier: number; // 0-3 required
    locale?: string;
    kind?: string;
    [key: string]: any;
  };
  version: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNPCSegmentPayload {
  ref_id: string; // NPC ID
  content: string;
  metadata: {
    tier: number;
    locale?: string;
    kind?: string;
    [key: string]: any;
  };
  version?: string;
  active?: boolean;
}

export interface UpdateNPCSegmentPayload {
  content?: string;
  metadata?: {
    tier?: number;
    locale?: string;
    kind?: string;
    [key: string]: any;
  };
  version?: string;
  active?: boolean;
}

export interface NPCSegmentFilters {
  npcId: string;
  tier?: number;
  locale?: string;
  active?: boolean;
}

export class NPCSegmentsService {
  /**
   * List NPC segments with filters
   */
  async listNPCSegments(filters: NPCSegmentFilters): Promise<NPCSegment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('prompt_segments')
      .select('*')
      .eq('scope', 'npc')
      .eq('ref_id', filters.npcId)
      .order('metadata->>tier', { ascending: true })
      .order('created_at', { ascending: false });

    if (filters.tier !== undefined) {
      query = query.eq('metadata->>tier', filters.tier);
    }

    if (filters.locale) {
      query = query.eq('metadata->>locale', filters.locale);
    }

    if (filters.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch NPC segments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get segments grouped by tier
   */
  async getNPCSegmentsByTier(npcId: string): Promise<Record<number, NPCSegment[]>> {
    const segments = await this.listNPCSegments({ npcId });
    
    const grouped: Record<number, NPCSegment[]> = {
      0: [],
      1: [],
      2: [],
      3: []
    };

    segments.forEach(segment => {
      const tier = segment.metadata.tier;
      if (tier >= 0 && tier <= 3) {
        grouped[tier].push(segment);
      }
    });

    return grouped;
  }

  /**
   * Get single NPC segment
   */
  async getNPCSegment(id: string): Promise<NPCSegment | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('*')
      .eq('id', id)
      .eq('scope', 'npc')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch NPC segment: ${error.message}`);
    }

    return data;
  }

  /**
   * Create NPC segment
   */
  async createNPCSegment(payload: CreateNPCSegmentPayload): Promise<NPCSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Validate tier
    if (payload.metadata.tier < 0 || payload.metadata.tier > 3) {
      throw new Error('Tier must be between 0 and 3');
    }

    // Check for duplicates
    const duplicates = await this.findDuplicateSegments(
      payload.ref_id,
      payload.content,
      payload.metadata.locale,
      payload.metadata.tier
    );

    if (duplicates.length > 0) {
      throw new Error('Duplicate content detected. Please check for existing segments with similar content.');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .insert({
        scope: 'npc',
        ref_id: payload.ref_id,
        content: payload.content,
        metadata: payload.metadata,
        version: payload.version || '1.0.0',
        active: payload.active ?? true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create NPC segment: ${error.message}`);
    }

    return data;
  }

  /**
   * Update NPC segment
   */
  async updateNPCSegment(id: string, payload: UpdateNPCSegmentPayload): Promise<NPCSegment> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    // Validate tier if provided
    if (payload.metadata?.tier !== undefined) {
      if (payload.metadata.tier < 0 || payload.metadata.tier > 3) {
        throw new Error('Tier must be between 0 and 3');
      }
    }

    // Check for duplicates if content is being updated
    if (payload.content) {
      const segment = await this.getNPCSegment(id);
      if (segment) {
        const duplicates = await this.findDuplicateSegments(
          segment.ref_id,
          payload.content,
          payload.metadata?.locale || segment.metadata.locale,
          payload.metadata?.tier || segment.metadata.tier,
          id // Exclude current segment
        );

        if (duplicates.length > 0) {
          throw new Error('Duplicate content detected. Please check for existing segments with similar content.');
        }
      }
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('scope', 'npc')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update NPC segment: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete NPC segment
   */
  async deleteNPCSegment(id: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { error } = await supabase
      .from('prompt_segments')
      .delete()
      .eq('id', id)
      .eq('scope', 'npc');

    if (error) {
      throw new Error(`Failed to delete NPC segment: ${error.message}`);
    }
  }

  /**
   * Clone segment to new locale
   */
  async cloneSegmentToLocale(segmentId: string, newLocale: string): Promise<NPCSegment> {
    const segment = await this.getNPCSegment(segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }

    const clonedPayload: CreateNPCSegmentPayload = {
      ref_id: segment.ref_id,
      content: segment.content,
      metadata: {
        ...segment.metadata,
        locale: newLocale
      },
      version: segment.version,
      active: segment.active
    };

    return this.createNPCSegment(clonedPayload);
  }

  /**
   * Promote/demote segment tier
   */
  async changeSegmentTier(segmentId: string, newTier: number): Promise<NPCSegment> {
    if (newTier < 0 || newTier > 3) {
      throw new Error('Tier must be between 0 and 3');
    }

    return this.updateNPCSegment(segmentId, {
      metadata: { tier: newTier }
    });
  }

  /**
   * Find duplicate segments
   */
  private async findDuplicateSegments(
    npcId: string,
    content: string,
    locale?: string,
    tier?: number,
    excludeId?: string
  ): Promise<NPCSegment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    let query = supabase
      .from('prompt_segments')
      .select('*')
      .eq('scope', 'npc')
      .eq('ref_id', npcId)
      .eq('content', content);

    if (locale) {
      query = query.eq('metadata->>locale', locale);
    }

    if (tier !== undefined) {
      query = query.eq('metadata->>tier', tier);
    }

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to check for duplicates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get available locales for NPC segments
   */
  async getAvailableLocales(npcId: string): Promise<string[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const { data, error } = await supabase
      .from('prompt_segments')
      .select('metadata')
      .eq('scope', 'npc')
      .eq('ref_id', npcId)
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
   * Get segment statistics by tier
   */
  async getSegmentStats(npcId: string): Promise<Record<number, { total: number; active: number }>> {
    const segments = await this.listNPCSegments({ npcId });
    
    const stats: Record<number, { total: number; active: number }> = {
      0: { total: 0, active: 0 },
      1: { total: 0, active: 0 },
      2: { total: 0, active: 0 },
      3: { total: 0, active: 0 }
    };

    segments.forEach(segment => {
      const tier = segment.metadata.tier;
      if (tier >= 0 && tier <= 3) {
        stats[tier].total++;
        if (segment.active) {
          stats[tier].active++;
        }
      }
    });

    return stats;
  }
}

export const npcSegmentsService = new NPCSegmentsService();
