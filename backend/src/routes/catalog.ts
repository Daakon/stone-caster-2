import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { ContentService } from '../services/content.service.js';
import { supabase } from '../services/supabase.js';
import { z } from 'zod';
import type { PostgrestError } from '@supabase/supabase-js';

const router = Router();

type WorldVisibilityAwareResult<T> = {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
};

type WorldVisibilityAwareExecutor<T> = (
  includeVisibilityColumn: boolean
) => Promise<WorldVisibilityAwareResult<T>>;

const WORLD_VISIBILITY_ERROR_REGEX = /worlds(?:_\d+)?\.visibility/i;
let worldVisibilityColumnAvailable: boolean | null = null;
let worldVisibilityFallbackLogged = false;

const isWorldVisibilityColumnError = (error?: PostgrestError | null) => {
  if (!error) {
    return false;
  }

  if (error.code !== '42703') {
    return false;
  }

  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return WORLD_VISIBILITY_ERROR_REGEX.test(message);
};

const logWorldVisibilityFallbackWarning = () => {
  if (worldVisibilityFallbackLogged) {
    return;
  }

  worldVisibilityFallbackLogged = true;
  console.warn(
    '[catalog] Missing worlds.visibility column; applying review_state-only fallback. Run Phase 0 publishing migration to restore full gating.'
  );
};

const executeWithWorldVisibilityFallback = async <T>(
  executor: WorldVisibilityAwareExecutor<T>
): Promise<WorldVisibilityAwareResult<T>> => {
  const includeVisibilityColumn = worldVisibilityColumnAvailable !== false;
  let response = await executor(includeVisibilityColumn);

  if (response.error && includeVisibilityColumn && isWorldVisibilityColumnError(response.error)) {
    worldVisibilityColumnAvailable = false;
    logWorldVisibilityFallbackWarning();
    response = await executor(false);
  } else if (!response.error && worldVisibilityColumnAvailable === null && includeVisibilityColumn) {
    worldVisibilityColumnAvailable = true;
  }

  return response;
};

const buildWorldRelationshipSelect = (
  includeVisibilityColumn: boolean,
  extraFields: string[] = ['name']
) => {
  const fields = new Set<string>([...extraFields, 'review_state']);
  if (includeVisibilityColumn) {
    fields.add('visibility');
  }
  return `worlds:world_id (${Array.from(fields).join(', ')})`;
};

const extractWorldRecord = (worldField: any) => (Array.isArray(worldField) ? worldField[0] : worldField);

const isWorldPublicAndApproved = (world: any) => {
  if (!world) {
    return false;
  }

  if (worldVisibilityColumnAvailable === false) {
    return world.review_state === 'approved';
  }

  return world.visibility === 'public' && world.review_state === 'approved';
};

// Schema for query parameters
const WorldsQuerySchema = z.object({
  activeOnly: z.enum(['0', '1', 'true', 'false']).optional().transform(val => val === '1' || val === 'true'),
});

const StoriesQuerySchema = z.object({
  activeOnly: z.enum(['0', '1', 'true', 'false']).optional().transform(val => val === '1' || val === 'true'),
});

// GET /api/catalog/worlds
router.get('/worlds', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const queryValidation = WorldsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req
      );
    }

    const { activeOnly } = queryValidation.data;

    const { data: worldsData, error } = await executeWithWorldVisibilityFallback<any[]>(includeVisibility => {
      const selectColumns = [
        'id',
        'version',
        'name',
        'description',
        'status',
        'review_state',
        'doc',
        'created_at',
        'updated_at',
      ];

      if (includeVisibility) {
        selectColumns.push('visibility');
      }

      // Phase 4: Include cover media join
      const selectWithCover = `${selectColumns.join(', ')}, cover_media:cover_media_id (id, provider_key, status, image_review_status, visibility)`;

      let query = supabase
        .from('worlds')
        .select(selectWithCover)
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('status', 'active');
      }

      if (includeVisibility) {
        query = query.eq('visibility', 'public');
      }

      query = query.eq('review_state', 'approved');

      return query;
    });

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // Transform to public catalog DTO
    // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
    const data = (worldsData || []).map((w: any) => {
      // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
      const coverMedia = w.cover_media && 
        typeof w.cover_media === 'object' &&
        w.cover_media.status === 'ready' && 
        w.cover_media.image_review_status === 'approved' &&
        w.cover_media.visibility === 'public'
        ? {
            id: w.cover_media.id,
            provider_key: w.cover_media.provider_key,
          }
        : null;

      return {
        id: w.id,
        name: w.name,
        slug: w.doc?.slug || w.id, // Use slug from doc or fallback to id
        tagline: w.doc?.tagline || '',
        short_desc: w.description || w.doc?.short_desc || '',
        hero_quote: w.doc?.hero_quote || '',
        status: w.status,
        // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
        cover_media: coverMedia,
        created_at: w.created_at,
        updated_at: w.updated_at,
      };
    });

    sendSuccess(res, data, req);
  } catch (error) {
    console.error('catalog.worlds error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch worlds', req);
  }
});

// GET /api/catalog/worlds/:idOrSlug
router.get('/worlds/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    const { data: worldsData, error } = await executeWithWorldVisibilityFallback<any[]>(includeVisibility => {
      const selectColumns = [
        'id',
        'version',
        'name',
        'description',
        'status',
        'review_state',
        'doc',
        'created_at',
        'updated_at',
      ];

      if (includeVisibility) {
        selectColumns.push('visibility');
      }

      // Phase 4: Include cover media join
      selectColumns.push('cover_media_id');
      const selectWithCover = `${selectColumns.join(', ')}, cover_media:cover_media_id (id, provider_key, status, image_review_status, visibility)`;

      let query = supabase
        .from('worlds')
        .select(selectWithCover)
        .or(`id.eq.${idOrSlug},doc->>slug.eq.${idOrSlug}`)
        .eq('review_state', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (includeVisibility) {
        query = query.eq('visibility', 'public');
      }

      return query;
    });

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    if (!worldsData || worldsData.length === 0) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
    }

    const world = worldsData[0];
    // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
    // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
    const coverMedia = world.cover_media && 
      typeof world.cover_media === 'object' &&
      world.cover_media.status === 'ready' && 
      world.cover_media.image_review_status === 'approved' &&
      world.cover_media.visibility === 'public'
      ? {
          id: world.cover_media.id,
          provider_key: world.cover_media.provider_key,
        }
      : null;

    const data = {
      id: world.id,
      name: world.name,
      slug: world.doc?.slug || world.id,
      tagline: world.doc?.tagline || '',
      short_desc: world.description || world.doc?.short_desc || '',
      hero_quote: world.doc?.hero_quote || '',
      status: world.status,
      // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
      cover_media: coverMedia,
      created_at: world.created_at,
      updated_at: world.updated_at,
    };

    sendSuccess(res, data, req);
  } catch (error) {
    console.error('catalog.world detail error', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch world', req);
  }
});

// GET /api/catalog/stories (unified - mirrors entry-points)
router.get('/stories', async (req: Request, res: Response) => {
  try {
    // Use the same validation schema as entry-points
    const queryValidation = ListQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.errors
      });
    }
    
    const filters = queryValidation.data;
    
    // Query entry_points table (admin source of truth)
    // Phase 4: Include cover_media_id and join with media_assets for cover info
    let query = supabase
      .from('entry_points')
      .select(`
        id,
        slug,
        type,
        title,
        subtitle,
        description,
        synopsis,
        tags,
        world_id,
        worlds:world_id (name),
        content_rating,
        lifecycle,
        visibility,
        prompt,
        cover_media_id,
        cover_media:cover_media_id (
          id,
          provider_key,
          status,
          image_review_status,
          visibility
        ),
        created_at,
        updated_at
      `, { count: 'exact' });
    
    // Apply filters (same as entry-points)
    if (filters.activeOnly) {
      query = query.eq('lifecycle', 'active');
    }
    
    if (filters.visibility) {
      query = query.in('visibility', filters.visibility);
    } else {
      query = query.eq('visibility', 'public');
    }
    
    if (filters.world) {
      query = query.eq('world_id', filters.world);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }
    
    if (filters.rating && filters.rating.length > 0) {
      query = query.in('content_rating', filters.rating);
    }
    
    if (filters.q) {
      query = query.or(
        `title.ilike.%${filters.q}%,description.ilike.%${filters.q}%,synopsis.ilike.%${filters.q}%`
      );
    }
    
    const sortConfig = buildSortClause(filters.sort);
    query = query.order(sortConfig.column, { ascending: sortConfig.ascending });
    
    const from = filters.offset;
    const to = from + filters.limit - 1;
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    // Transform using unified DTO mapper
    // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
    let items = (data || []).map((row: any) => {
      const { worlds, cover_media, ...restRow } = row;
      // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
      // Defensive check: cover_media may be null if LEFT JOIN finds no match
      const coverMediaData = cover_media && 
        typeof cover_media === 'object' &&
        cover_media.status === 'ready' && 
        cover_media.image_review_status === 'approved' &&
        cover_media.visibility === 'public'
          ? {
              id: cover_media.id,
              provider_key: cover_media.provider_key,
            }
          : null;

      const flatRow = {
        ...restRow,
        world_name: (worlds as any)?.[0]?.name || null,
        // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
        cover_media: coverMediaData,
      };
      
      return transformToCatalogDTO(flatRow, false);
    });
    
    // Post-filter by playableOnly
    if (filters.playableOnly) {
      items = items.filter(item => item.is_playable);
    }
    
    // Return unified response format
    res.json({
      ok: true,
      data: items,
      meta: {
        total: count || 0,
        limit: filters.limit,
        offset: filters.offset,
        filters: {
          world: filters.world,
          q: filters.q,
          tags: filters.tags,
          rating: filters.rating,
          visibility: filters.visibility,
          activeOnly: filters.activeOnly,
          playableOnly: filters.playableOnly
        },
        sort: filters.sort
      }
    });
  } catch (error) {
    console.error('catalog.stories error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch stories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/catalog/stories/:idOrSlug (unified - mirrors entry-points)
router.get('/stories/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    
    // Query entry_points table (admin source of truth)
    // Phase 4: Include cover_media_id and join with media_assets for cover info
    const { data, error } = await supabase
      .from('entry_points')
      .select(`
        id,
        slug,
        type,
        title,
        subtitle,
        description,
        synopsis,
        tags,
        world_id,
        worlds:world_id (name, doc),
        content_rating,
        lifecycle,
        visibility,
        prompt,
        cover_media_id,
        cover_media:cover_media_id (
          id,
          provider_key,
          status,
          image_review_status,
          visibility
        ),
        created_at,
        updated_at
      `)
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .limit(1)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        ok: false,
        error: 'Story not found'
      });
    }
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    // Fetch rulesets for this entry point
    const { data: rulesetsData, error: rulesetsError } = await supabase
      .from('entry_point_rulesets')
      .select(`
        rulesets:ruleset_id (id, name),
        sort_order
      `)
      .eq('entry_point_id', data.id)
      .order('sort_order');
    
    if (rulesetsError) {
      console.error('Rulesets query error:', rulesetsError);
    }
    
    // Transform using unified DTO mapper
    // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
    const { worlds, cover_media, ...restData } = data;
    const worldData = (worlds as any)?.[0];
    // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
    const coverMediaData = cover_media && 
      typeof cover_media === 'object' &&
      cover_media.status === 'ready' && 
      cover_media.image_review_status === 'approved' &&
      cover_media.visibility === 'public'
        ? {
            id: cover_media.id,
            provider_key: cover_media.provider_key,
          }
        : null;

    const flatRow = {
      ...restData,
      world_name: worldData?.name || null,
      world_slug: worldData?.doc?.slug || null, // Optional: for backward compatibility
      // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
      cover_media: coverMediaData,
      rulesets: (rulesetsData || []).map((r: any) => ({
        id: r.rulesets?.id,
        name: r.rulesets?.name,
        sort_order: r.sort_order
      }))
    };
    
    const dto = transformToCatalogDTO(flatRow, true);
    
    res.json({
      ok: true,
      data: dto
    });
  } catch (error) {
    console.error('catalog.story detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch story',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Schema for NPCs query parameters
const NPCsQuerySchema = z.object({
  q: z.string().optional(),
  world: z.string().uuid().optional(),
  activeOnly: z.enum(['0', '1', 'true', 'false']).optional().transform(val => val === '1' || val === 'true'),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

// GET /api/catalog/npcs
router.get('/npcs', async (req: Request, res: Response) => {
  try {
    const queryValidation = NPCsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req,
        queryValidation.error.errors
      );
    }

    const filters = queryValidation.data;

    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    const { data, error, count } = await executeWithWorldVisibilityFallback<any[]>(includeVisibility => {
      const worldRelationship = buildWorldRelationshipSelect(includeVisibility, ['id']);

      let query = supabase
        .from('npcs')
        .select(
          `
        id,
        name,
        slug,
        description,
        world_id,
        status,
        visibility,
        review_state,
        dependency_invalid,
        ${worldRelationship},
        archetype,
        role_tags,
        portrait_url,
        doc,
        created_at,
        updated_at
      `,
          { count: 'exact' }
        );

      if (filters.activeOnly !== false) {
        query = query.eq('status', 'active');
      }

      query = query.eq('visibility', 'public');
      query = query.eq('review_state', 'approved');
      query = query.eq('dependency_invalid', false);

      if (filters.world) {
        query = query.eq('world_id', filters.world);
      }

      if (filters.q) {
        query = query.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + limit - 1);

      return query;
    });

    if (error) {
      console.error('[catalog/npcs] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch NPCs',
        req
      );
    }

    // Phase 2: Post-filter to ensure parent world is public+approved for NPCs
    const npcs = (data || [])
      .filter((npc: any) => {
        const worldRecord = extractWorldRecord(npc.worlds);
        if (!npc.world_id || !worldRecord) {
          return false;
        }
        return isWorldPublicAndApproved(worldRecord);
      })
      .map((npc: any) => ({
        id: npc.id,
        name: npc.name,
        slug: npc.slug,
        description: npc.description,
        worldId: npc.world_id,
        status: npc.status,
        visibility: npc.visibility,
        archetype: npc.archetype,
        roleTags: npc.role_tags || [],
        portraitUrl: npc.portrait_url,
        doc: npc.doc || {},
        createdAt: npc.created_at,
        updatedAt: npc.updated_at,
      }));

    sendSuccess(
      res,
      {
        items: npcs,
        total: count || 0,
        limit,
        offset,
      },
      req
    );
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

// GET /api/catalog/npcs/:id
router.get('/npcs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: npc, error } = await supabase
      .from('npcs')
      .select(`
        id,
        name,
        slug,
        description,
        world_id,
        status,
        visibility,
        archetype,
        role_tags,
        portrait_url,
        doc,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'NPC not found', req);
      }
      console.error('[catalog/npcs/:id] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch NPC',
        req
      );
    }

    const npcDto = {
      id: npc.id,
      name: npc.name,
      slug: npc.slug,
      description: npc.description,
      worldId: npc.world_id,
      status: npc.status,
      visibility: npc.visibility,
      archetype: npc.archetype,
      roleTags: npc.role_tags || [],
      portraitUrl: npc.portrait_url,
      doc: npc.doc || {},
      createdAt: npc.created_at,
      updatedAt: npc.updated_at,
    };

    sendSuccess(res, npcDto, req);
  } catch (error) {
    console.error('[catalog/npcs/:id] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch NPC',
      req
    );
  }
});

// GET /api/catalog/rulesets — placeholder
router.get('/rulesets', async (req: Request, res: Response) => {
  sendSuccess(res, [], req);
});

// GET /api/catalog/rulesets/:id — placeholder
router.get('/rulesets/:id', async (req: Request, res: Response) => {
  return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Ruleset not found', req);
});

// ============================================================================
// UNIFIED CATALOG - ENTRY POINTS (New)
// ============================================================================

const ListQuerySchema = z.object({
  // Filters
  world: z.string().uuid().optional(),
  q: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform(val => 
    val ? (Array.isArray(val) ? val : [val]) : undefined
  ),
  rating: z.union([z.string(), z.array(z.string())]).optional().transform(val => 
    val ? (Array.isArray(val) ? val : [val]) : undefined
  ),
  visibility: z.union([z.string(), z.array(z.string())]).optional().transform(val => 
    val ? (Array.isArray(val) ? val : [val]) : undefined
  ),
  activeOnly: z.enum(['0', '1', 'true', 'false']).optional().transform(val => 
    val === undefined ? true : (val === '1' || val === 'true')
  ),
  playableOnly: z.enum(['0', '1', 'true', 'false']).optional().transform(val => 
    val === undefined ? true : (val === '1' || val === 'true')
  ),
  
  // Sorting
  sort: z.enum(['-updated', '-created', '-popularity', 'alpha', 'custom']).optional().default('-updated'),
  
  // Pagination
  limit: z.string().optional().transform(val => {
    const num = val ? parseInt(val, 10) : 20;
    return Math.min(Math.max(num, 1), 100);
  }),
  offset: z.string().optional().transform(val => {
    const num = val ? parseInt(val, 10) : 0;
    return Math.max(num, 0);
  }),
});

function computeIsPlayable(row: any): boolean {
  if (row.lifecycle !== 'active') return false;
  if (row.visibility === 'private') return false;
  if (!row.prompt || (typeof row.prompt === 'object' && Object.keys(row.prompt).length === 0)) {
    return false;
  }
  // entry_id column was removed - entry_points.id is now the primary identifier
  if (!row.id) return false;
  return true;
}

function computeHasPrompt(row: any): boolean {
  return row.prompt && (typeof row.prompt !== 'object' || Object.keys(row.prompt).length > 0);
}

function transformToCatalogDTO(row: any, includeDetail = false): any {
  const dto: any = {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle || null,
    description: row.description || row.synopsis || 'No description available',
    synopsis: row.synopsis || null,
    tags: row.tags || [],
    world_id: row.world_id || null,
    world_name: row.world_name || null,
    world_slug: row.world_slug || null,
    content_rating: row.content_rating,
    is_playable: computeIsPlayable(row),
    has_prompt: computeHasPrompt(row),
    // Phase 4: Include cover media if available
    cover_media: row.cover_media || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  
  if (includeDetail) {
    dto.hero_quote = row.prompt?.hero_quote || null;
    dto.rulesets = row.rulesets || [];
  }
  
  return dto;
}

function buildSortClause(sort: string): { column: string; ascending: boolean } {
  switch (sort) {
    case '-created':
      return { column: 'created_at', ascending: false };
    case '-popularity':
      // Note: popularity_score doesn't exist yet in schema
      return { column: 'updated_at', ascending: false };
    case 'alpha':
      return { column: 'title', ascending: true };
    case 'custom':
      // Note: sort_weight doesn't exist yet in schema
      return { column: 'updated_at', ascending: false };
    case '-updated':
    default:
      return { column: 'updated_at', ascending: false };
  }
}

// GET /api/catalog/entry-points
router.get('/entry-points', async (req: Request, res: Response) => {
  try {
    const queryValidation = ListQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid query parameters',
        details: queryValidation.error.errors
      });
    }
    
    const filters = queryValidation.data;
    
    const sortConfig = buildSortClause(filters.sort);
    const from = filters.offset;
    const to = from + filters.limit - 1;

    const { data, error, count } = await executeWithWorldVisibilityFallback<any[]>(includeVisibility => {
      const worldRelationship = buildWorldRelationshipSelect(includeVisibility);

      // Phase 4: Include cover_media_id and join with media_assets for cover info
      let query = supabase
        .from('entry_points')
        .select(
          `
        id,
        slug,
        type,
        title,
        subtitle,
        description,
        synopsis,
        tags,
        world_id,
        ${worldRelationship},
        content_rating,
        lifecycle,
        visibility,
        publish_visibility,
        review_state,
        dependency_invalid,
        prompt,
        cover_media_id,
        cover_media:cover_media_id (
          id,
          provider_key,
          status,
          image_review_status,
          visibility
        ),
        created_at,
        updated_at
      `,
          { count: 'exact' }
        );

      if (filters.activeOnly) {
        query = query.eq('lifecycle', 'active');
      }

      if (filters.visibility) {
        query = query.in('visibility', filters.visibility);
      } else {
        query = query.eq('visibility', 'public');
      }

      query = query.eq('review_state', 'approved');
      query = query.eq('dependency_invalid', false);

      if (filters.world) {
        query = query.eq('world_id', filters.world);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters.rating && filters.rating.length > 0) {
        query = query.in('content_rating', filters.rating);
      }

      if (filters.q) {
        query = query.or(
          `title.ilike.%${filters.q}%,description.ilike.%${filters.q}%,synopsis.ilike.%${filters.q}%`
        );
      }

      query = query.order(sortConfig.column, { ascending: sortConfig.ascending });
      query = query.range(from, to);

      return query;
    });
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    // Phase 2: Post-filter to ensure parent world is public+approved for story/npc
    let items = (data || [])
      .filter((row: any) => {
        const worldRecord = extractWorldRecord(row.worlds);
        if (row.world_id && worldRecord) {
          return isWorldPublicAndApproved(worldRecord);
        }
        return true;
      })
      .map((row: any) => {
        const { worlds, cover_media, ...restRow } = row;
        // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
        // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
        const coverMediaData = cover_media && 
          typeof cover_media === 'object' &&
          cover_media.status === 'ready' && 
          cover_media.image_review_status === 'approved' &&
          cover_media.visibility === 'public'
            ? {
                id: cover_media.id,
                provider_key: cover_media.provider_key,
              }
            : null;

        const flatRow = {
          ...restRow,
          world_name: Array.isArray(worlds) ? (worlds[0]?.name || null) : (worlds?.name || null),
          // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
          cover_media: coverMediaData,
        };
        
        return transformToCatalogDTO(flatRow, false);
      });
    
    if (filters.playableOnly) {
      items = items.filter(item => item.is_playable);
    }
    
    res.json({
      ok: true,
      data: items,
      meta: {
        total: count || 0,
        limit: filters.limit,
        offset: filters.offset,
        filters: {
          world: filters.world,
          q: filters.q,
          tags: filters.tags,
          rating: filters.rating,
          visibility: filters.visibility,
          activeOnly: filters.activeOnly,
          playableOnly: filters.playableOnly
        },
        sort: filters.sort
      }
    });
  } catch (error) {
    console.error('catalog.entry-points error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch entry points',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/catalog/entry-points/:idOrSlug
router.get('/entry-points/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    
    // Phase 4: Include cover_media_id and join with media_assets for cover info
    const { data, error } = await supabase
      .from('entry_points')
      .select(`
        id,
        slug,
        type,
        title,
        subtitle,
        description,
        synopsis,
        tags,
        world_id,
        worlds:world_id (name),
        content_rating,
        lifecycle,
        visibility,
        prompt,
        cover_media_id,
        cover_media:cover_media_id (
          id,
          provider_key,
          status,
          image_review_status,
          visibility
        ),
        created_at,
        updated_at
      `)
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .limit(1)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        ok: false,
        error: 'Entry point not found'
      });
    }
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    const { data: rulesetsData, error: rulesetsError } = await supabase
      .from('entry_point_rulesets')
      .select(`
        rulesets:ruleset_id (id, name),
        sort_order
      `)
      .eq('entry_point_id', data.id)
      .order('sort_order');
    
    if (rulesetsError) {
      console.error('Rulesets query error:', rulesetsError);
    }
    
    const { worlds, cover_media, ...restData } = data;
    // Phase 4 refinement: Defensive handling - LEFT JOIN means cover_media may be null/undefined
    // Phase 4 refinement: Only use cover_media (not cover_media_id) for UI
    const coverMediaData = cover_media && 
      typeof cover_media === 'object' &&
      cover_media.status === 'ready' && 
      cover_media.image_review_status === 'approved' &&
      cover_media.visibility === 'public'
        ? {
            id: cover_media.id,
            provider_key: cover_media.provider_key,
          }
        : null;

    const flatRow = {
      ...restData,
      world_name: (worlds as any)?.[0]?.name || null,
      // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
      cover_media: coverMediaData,
      rulesets: (rulesetsData || []).map((r: any) => ({
        id: r.rulesets?.id,
        name: r.rulesets?.name,
        sort_order: r.sort_order
      }))
    };
    
    const dto = transformToCatalogDTO(flatRow, true);
    
    res.json({
      ok: true,
      data: dto
    });
  } catch (error) {
    console.error('catalog.entry-point detail error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch entry point',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;





