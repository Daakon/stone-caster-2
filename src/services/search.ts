// Search Service
// Handles entry point search with keyset pagination and RLS

import { createClient } from '@supabase/supabase-js';

export interface SearchFilters {
  query?: string;
  worldId?: string;
  type?: string[];
  tags?: string[];
  limit?: number;
  cursor?: string;
}

export interface SearchResult {
  id: string;
  slug: string;
  type: string;
  title: string;
  synopsis: string;
  worldId: string;
  rulesetId: string;
  tags: string[];
  contentRating: string;
}

export interface SearchResponse {
  items: SearchResult[];
  nextCursor: string | null;
}

/**
 * Decodes cursor for keyset pagination
 * @param cursor Base64 encoded cursor
 * @returns Decoded cursor object
 */
function decodeCursor(cursor: string): { sortWeight: number; createdAt: string; id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      sortWeight: decoded.sort_weight,
      createdAt: decoded.created_at,
      id: decoded.id
    };
  } catch {
    return null;
  }
}

/**
 * Encodes cursor for keyset pagination
 * @param sortWeight Sort weight value
 * @param createdAt Created timestamp
 * @param id Entry point ID
 * @returns Base64 encoded cursor
 */
function encodeCursor(sortWeight: number, createdAt: string, id: string): string {
  const cursor = {
    sort_weight: sortWeight,
    created_at: createdAt,
    id: id
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Searches entry points with filters and pagination
 * @param filters Search filters
 * @param supabase Supabase client (scoped to user)
 * @returns Search results with pagination
 */
export async function searchEntryPoints(
  filters: SearchFilters,
  supabase: any
): Promise<SearchResponse> {
  const {
    query,
    worldId,
    type,
    tags,
    limit = 20,
    cursor
  } = filters;

  // Validate limit
  const maxLimit = Math.min(limit, 100);
  
  // Build base query
  let queryBuilder = supabase
    .from('entry_points')
    .select(`
      id,
      slug,
      type,
      title,
      synopsis,
      world_id,
      ruleset_id,
      tags,
      content_rating,
      sort_weight,
      created_at
    `)
    .eq('lifecycle', 'active')
    .eq('visibility', 'public');

  // Apply filters
  if (worldId) {
    queryBuilder = queryBuilder.eq('world_id', worldId);
  }

  if (type && type.length > 0) {
    queryBuilder = queryBuilder.in('type', type);
  }

  if (tags && tags.length > 0) {
    queryBuilder = queryBuilder.overlaps('tags', tags);
  }

  if (query) {
    // Use plainto_tsquery for safer text search
    queryBuilder = queryBuilder.textSearch('search_text', query, {
      type: 'websearch',
      config: 'english'
    });
  }

  // Apply cursor for keyset pagination
  if (cursor) {
    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      queryBuilder = queryBuilder.or(`
        sort_weight.lt.${decodedCursor.sortWeight},
        and(sort_weight.eq.${decodedCursor.sortWeight},created_at.lt.${decodedCursor.createdAt}),
        and(sort_weight.eq.${decodedCursor.sortWeight},created_at.eq.${decodedCursor.createdAt},id.lt.${decodedCursor.id})
      `);
    }
  }

  // Apply ordering and limit
  const { data, error } = await queryBuilder
    .order('sort_weight', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(maxLimit + 1); // Get one extra to check if there's a next page

  if (error) {
    console.error('Search error:', error);
    return { items: [], nextCursor: null };
  }

  // Check if there's a next page
  const hasNextPage = data.length > maxLimit;
  const items = hasNextPage ? data.slice(0, maxLimit) : data;

  // Generate next cursor if there's a next page
  let nextCursor: string | null = null;
  if (hasNextPage && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor(
      lastItem.sort_weight,
      lastItem.created_at,
      lastItem.id
    );
  }

  // Transform results
  const searchResults: SearchResult[] = items.map(item => ({
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    synopsis: item.synopsis,
    worldId: item.world_id,
    rulesetId: item.ruleset_id,
    tags: item.tags,
    contentRating: item.content_rating
  }));

  return {
    items: searchResults,
    nextCursor
  };
}

/**
 * Gets entry point details by ID
 * @param entryPointId Entry point identifier
 * @param supabase Supabase client
 * @returns Entry point details or null
 */
export async function getEntryPoint(
  entryPointId: string,
  supabase: any
): Promise<SearchResult | null> {
  const { data, error } = await supabase
    .from('entry_points')
    .select(`
      id,
      slug,
      type,
      title,
      synopsis,
      world_id,
      ruleset_id,
      tags,
      content_rating
    `)
    .eq('id', entryPointId)
    .eq('lifecycle', 'active')
    .eq('visibility', 'public')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    type: data.type,
    title: data.title,
    synopsis: data.synopsis,
    worldId: data.world_id,
    rulesetId: data.ruleset_id,
    tags: data.tags,
    contentRating: data.content_rating
  };
}
