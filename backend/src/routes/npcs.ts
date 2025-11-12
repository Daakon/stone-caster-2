/**
 * NPCs Routes
 * User-specific NPC endpoints (private NPCs)
 * Separate from catalog for caching and security
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { getSupabaseClient } from '../lib/supabaseClient.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Schema for user NPCs query parameters
const MyNPCsQuerySchema = z.object({
  q: z.string().optional(),
  world: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

/**
 * GET /api/npcs/my
 * Get current user's private NPCs
 * Requires authentication
 * No caching (user-specific, small result sets)
 */
router.get('/my', optionalAuth, async (req: Request, res: Response) => {
  try {
    const queryValidation = MyNPCsQuerySchema.safeParse(req.query);
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
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    // Require authentication (no guests for private NPCs)
    if (!userId || isGuest) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to view your NPCs',
        req
      );
    }

    // Get RLS-respecting Supabase client
    const supabase = getSupabaseClient(req);

    // Query user's private NPCs using RLS-respecting client
    // RLS will automatically filter to user's NPCs where visibility = 'private'
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

    // Filter to user's NPCs (RLS should handle this, but we filter explicitly)
    query = query.eq('user_id', userId);
    
    // Filter by visibility - only private NPCs for this endpoint
    query = query.eq('visibility', 'private');

    // Filter by status if provided
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else {
      // Default to active and draft (exclude archived)
      query = query.in('status', ['active', 'draft']);
    }

    // Filter by world if provided
    if (filters.world) {
      query = query.eq('world_id', filters.world);
    }

    // Search by name/description if query provided
    if (filters.q) {
      query = query.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }

    // Order by updated_at descending (most recently updated first)
    query = query.order('updated_at', { ascending: false });

    // Pagination
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[npcs/my] Supabase query error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch your NPCs',
        req
      );
    }

    // Collect distinct world IDs for batch fetch
    const worldIds = [...new Set((data || []).map((npc: any) => npc.world_id).filter((id: any): id is string => id !== null))];
    
    // Fetch worlds in batch if we have any world IDs
    const worldMap = new Map<string, { id: string; name: string; slug?: string }>();
    if (worldIds.length > 0) {
      const { data: worldsData } = await supabase
        .from('worlds')
        .select('id, name, slug')
        .in('id', worldIds);
      
      if (worldsData) {
        for (const world of worldsData) {
          worldMap.set(world.id, {
            id: world.id,
            name: world.name || '',
            slug: world.slug || undefined,
          });
        }
      }
    }

    // Transform to DTO format with world data
    const npcs = (data || []).map((npc: any) => {
      const world = npc.world_id ? worldMap.get(npc.world_id) : null;
      return {
        id: npc.id,
        name: npc.name,
        slug: npc.slug,
        description: npc.description,
        worldId: npc.world_id,
        world: world || null,
        status: npc.status,
        visibility: npc.visibility,
        archetype: npc.archetype,
        roleTags: npc.role_tags || [],
        portraitUrl: npc.portrait_url,
        doc: npc.doc || {},
        createdAt: npc.created_at,
        updatedAt: npc.updated_at,
      };
    });

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
    console.error('[npcs/my] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch your NPCs',
      req
    );
  }
});

export default router;

