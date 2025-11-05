/**
 * NPC Catalog Route
 * Phase A2: Production-grade RLS-friendly NPC list endpoint
 * Phase A3: NPC detail endpoint with ID/slug lookup
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { listParamsSchema, detailParamsSchema, type ListParams, type DetailParams } from '../validation/catalogNpcs.schema.js';
import { resolveWorldId } from '../services/worldResolver.js';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import type { CatalogNpcListResponse, CatalogNpc, CatalogNpcDetail, CatalogNpcDetailResponse, CatalogWorldMini } from '@shared/types/catalog.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildETag,
  parseIfNoneMatch,
  shouldReturnNotModified,
  setSharedCache,
} from '../lib/httpCache.js';

const router = Router();

/**
 * Helper: Get portrait URL with placeholder fallback
 */
function getPortraitUrl(npcId: string, portraitUrl: string | null): string {
  if (portraitUrl) {
    return portraitUrl;
  }
  // Deterministic placeholder
  return `/assets/portrait/${npcId}.svg`;
}

/**
 * Helper: Normalize search query
 * Returns normalized query or null if empty
 */
function normalizeSearchQuery(q: string | undefined): string | null {
  if (!q) return null;
  const normalized = q.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

/**
 * Helper: Fetch worlds in batch and return map
 * Exported for use in tests
 */
export async function fetchWorldsMap(
  supabase: SupabaseClient,
  worldIds: string[]
): Promise<Map<string, CatalogWorldMini>> {
  const worldMap = new Map<string, CatalogWorldMini>();
  if (worldIds.length === 0) {
    return worldMap;
  }

  const { data: worldsData } = await supabase
    .from('worlds')
    .select('id, slug, name')
    .in('id', worldIds);

  if (worldsData) {
    for (const world of worldsData) {
      worldMap.set(world.id, {
        id: world.id,
        slug: world.slug || '',
        name: world.name || '',
      });
    }
  }

  return worldMap;
}

/**
 * Build query signature for cache key
 * Includes normalized params and auth context (anon vs auth)
 */
function buildQuerySignature(params: ListParams, isAuthenticated: boolean): string {
  const parts = [
    `page=${params.page}`,
    `pageSize=${params.pageSize}`,
    `sort=${params.sort}`,
    `order=${params.order}`,
  ];
  if (params.q) {
    parts.push(`q=${normalizeSearchQuery(params.q) || ''}`);
  }
  if (params.world) {
    parts.push(`world=${params.world}`);
  }
  // Auth context affects RLS visibility
  parts.push(`aud=${isAuthenticated ? 'auth' : 'anon'}`);
  return parts.join('&');
}

/**
 * Compute max updated_at across filtered scope for cache versioning
 */
async function getMaxUpdatedAt(
  supabase: SupabaseClient,
  params: ListParams,
  worldId: string | null
): Promise<string> {
  // Build the same filters as the main query (without pagination/range)
  let versionQuery = supabase
    .from('npcs')
    .select('updated_at, created_at')
    .eq('status', 'active')
    .eq('doc->>visibility', 'public');

  if (worldId) {
    versionQuery = versionQuery.eq('world_id', worldId);
  }

  const normalizedQ = normalizeSearchQuery(params.q);
  if (normalizedQ) {
    if (normalizedQ.length <= 2) {
      versionQuery = versionQuery.ilike('name', `%${normalizedQ}%`);
    } else {
      versionQuery = versionQuery.textSearch('search_vector', normalizedQ, {
        type: 'plain',
        config: 'simple',
      });
    }
  }

  // Get all matching rows (no limit/range) to compute max
  // Note: We don't use .range() here - we need all matching rows for accurate max
  const { data, error } = await versionQuery;

  if (error || !data || data.length === 0) {
    // Fallback to current timestamp if no data
    return new Date().toISOString();
  }

  // Find max updated_at, fallback to created_at if updated_at is null
  const maxUpdated = data.reduce((max, row) => {
    const updatedAt = row.updated_at || row.created_at;
    if (!updatedAt) return max;
    const ts = new Date(updatedAt).getTime();
    return ts > max ? ts : max;
  }, 0);

  if (maxUpdated === 0) {
    return new Date().toISOString();
  }

  return new Date(maxUpdated).toISOString();
}

/**
 * GET /api/catalog/npcs
 * List NPCs with filtering, search, pagination
 * Phase A4: Adds HTTP caching (ETag, Last-Modified, Cache-Control)
 */
router.get('/npcs', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const queryValidation = listParamsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PARAM',
        message: 'Invalid query parameters',
        details: queryValidation.error.errors,
      });
    }

    const params = queryValidation.data;

    // Get RLS-respecting Supabase client
    const supabase = getSupabaseClient(req);

    // Determine auth context for cache signature
    const isAuthenticated = !!(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

    // World resolver memo (per-request cache)
    const worldResolverMemo = new Map<string, string | null>();

    // Resolve world if provided (handles both UUID and slug)
    let worldId: string | null = null;
    if (params.world) {
      // Check memo first
      if (worldResolverMemo.has(params.world)) {
        worldId = worldResolverMemo.get(params.world) || null;
      } else {
        worldId = await resolveWorldId(params.world, supabase);
        worldResolverMemo.set(params.world, worldId);
      }
      if (!worldId) {
        // World not found - return empty result with 200
        const emptyResponse: CatalogNpcListResponse = {
          ok: true,
          meta: {
            page: params.page,
            pageSize: params.pageSize,
            total: 0,
            hasMore: false,
            sort: params.sort,
            order: params.order,
            q: params.q,
            world: params.world,
          },
          data: [],
        };
        return res.status(200).json(emptyResponse);
      }
    }

    // Compute version timestamp (max updated_at across filtered scope)
    // Do this after worldId resolution to get accurate version
    const versionISO = await getMaxUpdatedAt(supabase, params, worldId);

    // Build query signature for cache key
    const querySignature = buildQuerySignature(params, isAuthenticated);

    // Build ETag
    const etag = buildETag(`npcs:list:${querySignature}`, versionISO);

    // Check conditional requests
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'] || null;
    const reqETags = parseIfNoneMatch(ifNoneMatch);

    if (shouldReturnNotModified(reqETags, etag, ifModifiedSince, versionISO)) {
      res.status(304);
      res.removeHeader('Content-Type');
      res.end();
      return;
    }

    // Build query
    let query = supabase
      .from('npcs')
      .select('id, name, status, world_id, portrait_url, doc, created_at, updated_at', { count: 'exact' });

    // Filter: status = 'active'
    query = query.eq('status', 'active');

    // Filter: visibility = 'public' (from doc JSONB)
    // RLS policies also enforce this, but include for query optimization
    query = query.eq('doc->>visibility', 'public');

    // Filter by world if provided
    if (worldId) {
      query = query.eq('world_id', worldId);
    }

    // Search: normalize and use search_vector if q provided
    const normalizedQ = normalizeSearchQuery(params.q);
    if (normalizedQ) {
      // For short queries (<= 2 chars), use prefix search with ilike for better performance
      if (normalizedQ.length <= 2) {
        query = query.ilike('name', `%${normalizedQ}%`);
      } else {
        // Use textSearch with plain type for search_vector
        query = query.textSearch('search_vector', normalizedQ, {
          type: 'plain',
          config: 'simple',
        });
      }
    }

    // Sorting
    // If popularity is requested but no popularity column exists, map to created_at
    let actualSort: 'name' | 'created_at' | 'popularity' = params.sort;
    let sortColumn: string;
    switch (params.sort) {
      case 'name':
        sortColumn = 'name';
        break;
      case 'created_at':
        sortColumn = 'created_at';
        break;
      case 'popularity':
        // Fallback to created_at if no popularity field
        sortColumn = 'created_at';
        actualSort = 'created_at'; // Update meta to reflect actual sort
        break;
      default:
        sortColumn = 'created_at';
        actualSort = 'created_at';
    }

    query = query.order(sortColumn, { ascending: params.order === 'asc' });

    // Pagination
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data: npcsData, error, count } = await query;

    if (error) {
      console.error('[catalog/npcs] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch NPCs',
        req
      );
    }

    const npcs = (npcsData || []) as Array<{
      id: string;
      name: string;
      status: string;
      world_id: string | null;
      portrait_url: string | null;
      doc: Record<string, any>;
      created_at: string;
    }>;

    // Collect distinct world IDs for batch fetch
    const worldIds = [...new Set(npcs.map(npc => npc.world_id).filter((id): id is string => id !== null))];

    // Fetch worlds in batch
    const worldMap = await fetchWorldsMap(supabase, worldIds);

    // Transform to CatalogNpc format
    const catalogNpcs: CatalogNpc[] = npcs.map((npc) => {
      const doc = npc.doc || {};
      return {
        id: npc.id,
        name: npc.name,
        status: npc.status as 'active' | 'draft' | 'archived',
        world: npc.world_id ? worldMap.get(npc.world_id) || null : null,
        portrait_url: getPortraitUrl(npc.id, npc.portrait_url),
        short_desc: doc.short_desc || null,
        tags: doc.tags || undefined,
        created_at: npc.created_at,
      };
    });

    // Calculate hasMore
    const total = count || 0;
    const hasMore = total > params.page * params.pageSize;

    // Build response
    const response: CatalogNpcListResponse = {
      ok: true,
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        hasMore,
        sort: actualSort,
        order: params.order,
        q: normalizedQ || params.q,
        world: params.world,
      },
      data: catalogNpcs,
    };

    // Set cache headers (Phase A4)
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date(versionISO).toUTCString());
    // Vary header union (append if already set)
    const varyPrev = res.getHeader('Vary');
    const varyNeeded = 'Authorization, Accept-Encoding';
    res.setHeader('Vary', varyPrev ? `${varyPrev}, ${varyNeeded}` : varyNeeded);
    setSharedCache(res, { seconds: 60 });

    // Return response directly (sendSuccess adds meta.traceId, but our response already has meta)
    // The response shape matches CatalogNpcListResponse exactly
    res.status(200).json(response);
  } catch (error) {
    console.error('[catalog/npcs] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch NPCs',
      req
    );
  }
});

/**
 * GET /api/catalog/npcs/:idOrSlug
 * Get NPC detail by ID or slug
 */
router.get('/npcs/:idOrSlug', async (req: Request, res: Response) => {
  try {
    // Validate path parameter
    const paramValidation = detailParamsSchema.safeParse({ idOrSlug: req.params.idOrSlug });
    if (!paramValidation.success) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PARAM',
        message: 'Invalid idOrSlug parameter',
        details: paramValidation.error.errors,
      });
    }

    const { idOrSlug } = paramValidation.data;

    // Get RLS-respecting Supabase client
    const supabase = getSupabaseClient(req);

    // Determine lookup mode: UUID v4 regex check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isLikelyUuid = uuidPattern.test(idOrSlug);

    // Determine auth context for cache signature
    const isAuthenticated = !!(req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

    // Build query
    let query = supabase
      .from('npcs')
      .select('id, name, status, world_id, portrait_url, doc, created_at, updated_at, slug')
      .eq('status', 'active')
      .eq('doc->>visibility', 'public');

    // Apply lookup filter
    if (isLikelyUuid) {
      query = query.eq('id', idOrSlug);
    } else {
      // Try slug column first, fallback to doc->>'slug'
      query = query.or(`slug.eq.${idOrSlug},doc->>slug.eq.${idOrSlug}`);
    }

    query = query.single();

    // Execute query
    const { data: npc, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return 404 with negative caching
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
        return res.status(404).json({
          ok: false,
          code: 'NPC_NOT_FOUND',
          message: 'NPC not found or not accessible',
        } as CatalogNpcDetailResponse);
      }
      console.error('[catalog/npcs/:idOrSlug] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch NPC',
        req
      );
    }

    if (!npc) {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
      return res.status(404).json({
        ok: false,
        code: 'NPC_NOT_FOUND',
        message: 'NPC not found or not accessible',
      } as CatalogNpcDetailResponse);
    }

    // Get resource key (use resolved NPC id)
    const resourceKey = npc.id;
    const versionISO = npc.updated_at || npc.created_at || new Date().toISOString();

    // Build ETag
    const etag = buildETag(`npcs:detail:${resourceKey}:${isAuthenticated ? 'auth' : 'anon'}`, versionISO);

    // Check conditional requests
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'] || null;
    const reqETags = parseIfNoneMatch(ifNoneMatch);

    if (shouldReturnNotModified(reqETags, etag, ifModifiedSince, versionISO)) {
      res.status(304);
      res.removeHeader('Content-Type');
      res.end();
      return;
    }

    // Fetch world if present
    let world: CatalogWorldMini | null = null;
    if (npc.world_id) {
      const worldMap = await fetchWorldsMap(supabase, [npc.world_id]);
      world = worldMap.get(npc.world_id) || null;
    }

    // Transform to CatalogNpcDetail
    const doc = npc.doc || {};
    const detail: CatalogNpcDetail = {
      id: npc.id,
      name: npc.name,
      status: npc.status as 'active' | 'draft' | 'archived',
      world,
      portrait_url: getPortraitUrl(npc.id, npc.portrait_url),
      short_desc: doc.short_desc || null,
      description: doc.long_desc || doc.description || null,
      tags: doc.tags || undefined,
      created_at: npc.created_at,
      doc: doc || null,
    };

    const response: CatalogNpcDetailResponse = {
      ok: true,
      data: detail,
    };

    // Set cache headers (Phase A4)
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', new Date(versionISO).toUTCString());
    // Vary header union (append if already set)
    const varyPrev = res.getHeader('Vary');
    const varyNeeded = 'Authorization, Accept-Encoding';
    res.setHeader('Vary', varyPrev ? `${varyPrev}, ${varyNeeded}` : varyNeeded);
    setSharedCache(res, { seconds: 60 });

    res.status(200).json(response);
  } catch (error) {
    console.error('[catalog/npcs/:idOrSlug] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch NPC',
      req
    );
  }
});

export default router;

