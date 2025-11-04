import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { ContentService } from '../services/content.service.js';
import { supabase } from '../services/supabase.js';
import { z } from 'zod';

const router = Router();

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

    // Query Supabase worlds table
    let query = supabase
      .from('worlds')
      .select('id, version, name, description, status, doc, created_at, updated_at')
      .order('created_at', { ascending: false });

    // Filter by status if activeOnly is true
    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data: worldsData, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // Transform to public catalog DTO
    const data = (worldsData || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      slug: w.doc?.slug || w.id, // Use slug from doc or fallback to id
      tagline: w.doc?.tagline || '',
      short_desc: w.description || w.doc?.short_desc || '',
      hero_quote: w.doc?.hero_quote || '',
      status: w.status,
      created_at: w.created_at,
      updated_at: w.updated_at,
    }));

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

    // Query by id or slug (check both id field and doc.slug)
    const { data: worldsData, error } = await supabase
      .from('worlds')
      .select('id, version, name, description, status, doc, created_at, updated_at')
      .or(`id.eq.${idOrSlug},doc->>slug.eq.${idOrSlug}`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    if (!worldsData || worldsData.length === 0) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
    }

    const world = worldsData[0];
    const data = {
      id: world.id,
      name: world.name,
      slug: world.doc?.slug || world.id,
      tagline: world.doc?.tagline || '',
      short_desc: world.description || world.doc?.short_desc || '',
      hero_quote: world.doc?.hero_quote || '',
      status: world.status,
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
    let items = (data || []).map((row: any) => {
      const { worlds, ...restRow } = row;
      const flatRow = {
        ...restRow,
        world_name: (worlds as any)?.[0]?.name || null
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
    const { worlds, ...restData } = data;
    const worldData = (worlds as any)?.[0];
    const flatRow = {
      ...restData,
      world_name: worldData?.name || null,
      world_slug: worldData?.doc?.slug || null, // Optional: for backward compatibility
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

    // Query NPCs table using regular supabase client (respects RLS)
    let query = supabase
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
      `, { count: 'exact' });

    // Filter by status if activeOnly is true (default to active)
    if (filters.activeOnly !== false) {
      query = query.eq('status', 'active');
    }

    // Filter by visibility - default to public (if column exists)
    // RLS policies should handle visibility, but we filter here too for clarity
    // Note: Some NPCs may not have visibility column, so we don't enforce it strictly
    // The RLS policy will determine what users can actually see

    // Filter by world if provided
    if (filters.world) {
      query = query.eq('world_id', filters.world);
    }

    // Search by name/description if query provided
    if (filters.q) {
      query = query.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    // Pagination
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[catalog/npcs] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch NPCs',
        req
      );
    }

    // Transform to DTO format
    const npcs = (data || []).map((npc: any) => ({
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
        created_at,
        updated_at
      `, { count: 'exact' });
    
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
    
    let items = (data || []).map((row: any) => {
      const { worlds, ...restRow } = row;
      const flatRow = {
        ...restRow,
        world_name: (worlds as any)?.[0]?.name || null
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
    
    const { worlds, ...restData } = data;
    const flatRow = {
      ...restData,
      world_name: (worlds as any)?.[0]?.name || null,
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





