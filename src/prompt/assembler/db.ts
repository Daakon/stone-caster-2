// Prompt Assembler Database Adapter
// Handles fetching prompt segments from the database with proper filtering and sorting

import type { Scope, SegmentRow, DbAdapter } from './types';

/**
 * Default database adapter using Supabase/Postgres
 * Fetches prompt segments with proper filtering and sorting
 */
export class SupabaseDbAdapter implements DbAdapter {
  constructor(private supabase: any) {}

  async getSegments(scope: Scope, refId?: string): Promise<SegmentRow[]> {
    let query = this.supabase
      .from('prompt_segments')
      .select('*')
      .eq('scope', scope)
      .eq('active', true);

    if (refId) {
      query = query.eq('ref_id', refId);
    } else if (scope === 'core') {
      // Core segments don't have ref_id
      query = query.is('ref_id', null);
    }

    const { data, error } = await query
      .order('metadata->tier', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch segments for scope ${scope}: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      scope: row.scope as Scope,
      ref_id: row.ref_id,
      version: row.version,
      active: row.active,
      content: row.content,
      metadata: row.metadata || {}
    }));
  }
}

/**
 * Mock database adapter for testing
 * Allows injection of test data without database dependencies
 */
export class MockDbAdapter implements DbAdapter {
  constructor(private segments: SegmentRow[] = []) {}

  async getSegments(scope: Scope, refId?: string): Promise<SegmentRow[]> {
    return this.segments
      .filter(segment => segment.scope === scope && segment.active)
      .filter(segment => {
        if (refId) {
          return segment.ref_id === refId;
        } else if (scope === 'core') {
          return segment.ref_id === null;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by tier (nulls first), then by id
        const aTier = a.metadata?.tier ?? null;
        const bTier = b.metadata?.tier ?? null;
        
        if (aTier === null && bTier === null) return a.id - b.id;
        if (aTier === null) return -1;
        if (bTier === null) return 1;
        if (aTier !== bTier) return aTier - bTier;
        
        return a.id - b.id;
      });
  }

  /**
   * Add segments to the mock adapter
   * @param segments Segments to add
   */
  addSegments(segments: SegmentRow[]): void {
    this.segments.push(...segments);
  }

  /**
   * Clear all segments from the mock adapter
   */
  clearSegments(): void {
    this.segments = [];
  }

  /**
   * Get all segments in the mock adapter
   */
  getAllSegments(): SegmentRow[] {
    return [...this.segments];
  }
}

/**
 * Creates a mock database adapter with sample data for testing
 * @returns MockDbAdapter with sample segments
 */
export function createMockDbAdapter(): MockDbAdapter {
  const adapter = new MockDbAdapter();
  
  // Add sample segments for testing
  adapter.addSegments([
    {
      id: 1,
      scope: 'core',
      ref_id: null,
      version: '1.0.0',
      active: true,
      content: 'You are a helpful AI game master.',
      metadata: { type: 'system', priority: 'high' }
    },
    {
      id: 2,
      scope: 'ruleset',
      ref_id: 'ruleset.classic_v1',
      version: '1.0.0',
      active: true,
      content: 'Use classic D&D rules for combat and skill checks.',
      metadata: { type: 'rules', tier: 0 }
    },
    {
      id: 3,
      scope: 'world',
      ref_id: 'world.mystika',
      version: '1.0.0',
      active: true,
      content: 'The world of Mystika is a realm of ancient magic.',
      metadata: { type: 'world_description', tier: 0 }
    },
    {
      id: 4,
      scope: 'entry',
      ref_id: 'ep.whispercross',
      version: '1.0.0',
      active: true,
      content: 'You find yourself at the Whispercross Inn.',
      metadata: { type: 'adventure_setup', tier: 0 }
    },
    {
      id: 5,
      scope: 'entry_start',
      ref_id: 'ep.whispercross',
      version: '1.0.0',
      active: true,
      content: 'Welcome to your adventure! This is your first turn.',
      metadata: { type: 'first_turn', tier: 0 }
    },
    {
      id: 6,
      scope: 'npc',
      ref_id: 'npc.innkeeper',
      version: '1.0.0',
      active: true,
      content: 'The innkeeper is a friendly old man.',
      metadata: { type: 'npc_description', tier: 0 }
    },
    {
      id: 7,
      scope: 'npc',
      ref_id: 'npc.innkeeper',
      version: '1.0.0',
      active: true,
      content: 'He knows many local secrets and rumors.',
      metadata: { type: 'npc_behavior', tier: 1 }
    },
    {
      id: 8,
      scope: 'npc',
      ref_id: 'npc.innkeeper',
      version: '1.0.0',
      active: true,
      content: 'He has a hidden stash of magical items.',
      metadata: { type: 'npc_secret', tier: 2 }
    }
  ]);

  return adapter;
}

/**
 * Validates that segments are properly formatted
 * @param segments Array of segments to validate
 * @returns Validation result
 */
export function validateSegments(segments: SegmentRow[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const segment of segments) {
    if (!segment.id || typeof segment.id !== 'number') {
      errors.push(`Invalid segment ID: ${segment.id}`);
    }
    if (!segment.scope) {
      errors.push(`Invalid segment scope: ${segment.scope}`);
    }
    if (!segment.content || typeof segment.content !== 'string') {
      errors.push(`Invalid segment content: ${segment.content}`);
    }
    if (typeof segment.active !== 'boolean') {
      errors.push(`Invalid segment active flag: ${segment.active}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Filters segments by metadata criteria
 * @param segments Array of segments to filter
 * @param criteria Metadata criteria to match
 * @returns Filtered segments
 */
export function filterSegmentsByMetadata(
  segments: SegmentRow[],
  criteria: Record<string, any>
): SegmentRow[] {
  return segments.filter(segment => {
    for (const [key, value] of Object.entries(criteria)) {
      if (segment.metadata[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Groups segments by scope
 * @param segments Array of segments to group
 * @returns Segments grouped by scope
 */
export function groupSegmentsByScope(segments: SegmentRow[]): Record<Scope, SegmentRow[]> {
  const grouped: Record<Scope, SegmentRow[]> = {
    core: [],
    ruleset: [],
    world: [],
    entry: [],
    entry_start: [],
    npc: [],
    game_state: [],
    player: [],
    rng: [],
    input: []
  };

  for (const segment of segments) {
    if (grouped[segment.scope]) {
      grouped[segment.scope].push(segment);
    }
  }

  return grouped;
}

/**
 * Creates a segment summary for debugging
 * @param segments Array of segments to summarize
 * @returns Summary string
 */
export function createSegmentSummary(segments: SegmentRow[]): string {
  const grouped = groupSegmentsByScope(segments);
  const summary: string[] = [];

  for (const [scope, scopeSegments] of Object.entries(grouped)) {
    if (scopeSegments.length > 0) {
      summary.push(`${scope}: ${scopeSegments.length} segments`);
    }
  }

  return summary.join(', ');
}
