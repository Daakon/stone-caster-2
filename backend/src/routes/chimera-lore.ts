/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Lore
 *     description: User-facing CRUD endpoints for Chimera lore entries (Pure RAG system)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';
import type { ChimeraLoreEntry } from '@shared/types/chimera-lore.js';
import { LoreRepository } from '../db/repos/lore.repo.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Zod schemas for validation
const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const CreateLoreEntrySchema = z.object({
  world_id: z.string().uuid().optional(),
  display_name: z.string().min(1).max(200),
  entry_text: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  story_id: z.string().uuid().optional(),
  tag_names: z.array(z.string()).optional(), // Keep for backward compat, but keywords preferred
}).refine(data => data.world_id || data.entity_id || data.story_id, {
  message: "At least one of world_id, entity_id, or story_id must be provided",
});

const UpdateLoreEntrySchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  entry_text: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  type: z.string().optional(),
  tag_names: z.array(z.string()).optional(),
});

// Helper function to normalize tag names
function normalizeTagName(tagName: string): string {
  return tagName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

const ContextQuerySchema = z.object({
  world_id: z.string().uuid().optional(),
  entity_id: z.string().uuid().optional(),
  story_id: z.string().uuid().optional(), // Also supports backward compat
  display_name: z.string().optional(),
});

/**
 * POST /api/v2/chimera/lore
 * Create a new lore entry (V2)
 */
router.post(
  '/',
  validateRequest(CreateLoreEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { display_name, entry_text, keywords, type, tag_names, entity_id, story_id } = req.body;
      let { world_id } = req.body;

      // RESOLVE CONTEXT AND WORLD ID
      // Priority: Entity > Story > World (Specific to General)

      if (entity_id) {
        // Case 1: Entity Context
        const { data: entity, error: entityError } = await supabaseAdmin
          .from('chimera_entities')
          .select('world_id, owner_user_id')
          .eq('id', entity_id)
          .single();

        if (entityError || !entity) {
          return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Entity not found', req);
        }
        if (entity.owner_user_id !== userId) {
          return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not have permission to add lore to this entity', req);
        }

        // Infer world_id from entity
        world_id = entity.world_id;

      } else if (story_id) {
        // Case 2: Story Context
        const { data: story, error: storyError } = await supabaseAdmin
          .from('chimera_stories')
          .select('world_id, owner_user_id')
          .eq('id', story_id)
          .single();

        if (storyError || !story) {
          return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
        }
        if (story.owner_user_id !== userId) {
          return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not have permission to add lore to this story', req);
        }

        // Infer world_id from story
        world_id = story.world_id;

      } else if (world_id) {
        // Case 3: World Context (General Lore)
        const { data: world, error: worldError } = await supabaseAdmin
          .from('chimera_worlds')
          .select('owner_user_id')
          .eq('id', world_id)
          .single();

        if (worldError || !world) {
          return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
        }
        if (world.owner_user_id !== userId) {
          return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not have permission to add lore to this world', req);
        }
      } else {
        // Should be caught by Zod refine, but double check
        return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Validation Error: No context provided', req);
      }

      // Create the lore entry using Repository
      const repo = new LoreRepository(supabaseAdmin);
      const loreEntry = await repo.createV2(
        world_id,
        { display_name, entry_text, keywords, type, entity_id, story_id },
        userId
      );

      // Handle legacy tags if provided
      if (tag_names && tag_names.length > 0) {
        const tagIds: string[] = [];
        for (const tagName of tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          // Check/Create tag
          let { data: existingTag } = await supabaseAdmin
            .from('chimera_tags')
            .select('id')
            .eq('tag_name', normalized)
            .single();

          let tagId: string;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag } = await supabaseAdmin
              .from('chimera_tags')
              .insert({ tag_name: normalized, is_approved: false })
              .select('id')
              .single();
            if (newTag) tagId = newTag.id;
            else continue;
          }
          tagIds.push(tagId);
        }

        if (tagIds.length > 0) {
          await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(
              tagIds.map(tagId => ({
                tag_id: tagId,
                asset_id: loreEntry.id,
                asset_type: 'lore_entry'
              }))
            );
        }
      }

      // Return consistent format
      const fragment = loreEntry.fragment || {};
      const response = {
        ...loreEntry,
        display_name: fragment.display_name,
        entry_text: fragment.entry_text,
        type: fragment.type,
      };

      return sendSuccess(res, response, req);
    } catch (error) {
      console.error('[Chimera Lore] Error creating lore entry:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to create lore entry',
        req
      );
    }
  }
);

/**
 * GET /api/v2/chimera/lore/my-creations
 * Get all lore entries owned by the current user
 */
router.get('/my-creations', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Fetch all lore entries owned by the user (direct ownership OR world-based ownership)
    // First, get all worlds owned by the user
    const { data: userWorlds, error: worldsError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('id, owner_user_id, visibility')
      .eq('owner_user_id', userId);

    if (worldsError) {
      console.error('[Chimera Lore] Error fetching user worlds:', worldsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch user worlds',
        req
      );
    }

    const worldIds = (userWorlds || []).map((w) => w.id);

    // Build query: direct ownership OR world-based ownership
    let loreQuery = supabaseAdmin
      .from('chimera_lore')
      .select(`
        *,
        world:chimera_worlds!world_id(visibility, owner_user_id)
      `);

    // Filter: owner_user_id = userId OR world_id IN (user's world IDs)
    if (worldIds.length > 0) {
      loreQuery = loreQuery.or(`owner_user_id.eq.${userId},world_id.in.(${worldIds.join(',')})`);
    } else {
      // No worlds owned, only check direct ownership
      loreQuery = loreQuery.eq('owner_user_id', userId);
    }

    const { data: loreEntries, error: loreError } = await loreQuery
      .order('created_at', { ascending: false });

    if (loreError) {
      console.error('[Chimera Lore] Error fetching lore entries:', loreError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch lore entries',
        req
      );
    }

    // Fetch tags for all lore entries
    if (loreEntries && loreEntries.length > 0) {
      const entryIds = loreEntries.map((entry: any) => String(entry.id));
      const { data: allAssetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          asset_id,
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .in('asset_id', entryIds)
        .eq('asset_type', 'lore_entry');

      // Group tags by asset_id
      const tagsByEntryId = new Map<string, any[]>();
      if (allAssetTags) {
        for (const link of allAssetTags) {
          if (link.tag) {
            const entryId = String(link.asset_id);
            if (!tagsByEntryId.has(entryId)) {
              tagsByEntryId.set(entryId, []);
            }
            tagsByEntryId.get(entryId)!.push(link.tag);
          }
        }
      }

      // Attach tags to each entry
      for (const entry of loreEntries) {
        (entry as any).tags = tagsByEntryId.get(String(entry.id)) || [];
      }
    }

    // Transform lore entries to include visibility from world
    const transformedEntries = (loreEntries || []).map((entry: any) => ({
      ...entry,
      visibility: entry.world?.visibility || 'private',
      owner_user_id: entry.world?.owner_user_id || userId,
      version: 1, // Lore entries don't have version, default to 1
      is_system_asset: false, // Lore entries are not system assets
      content_chunk: entry.entry_text, // Map entry_text to content_chunk for frontend compatibility
      tags: entry.tags || [], // Include tags from above
      embedding: null, // Embeddings are handled separately
    }));

    return sendSuccess(res, transformedEntries, req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/lore/tags
 * Get all approved tags (for use in tag selectors)
 */
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Fetch all approved tags
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('chimera_tags')
      .select('id, tag_name, is_approved')
      .eq('is_approved', true)
      .order('tag_name', { ascending: true });

    if (tagsError) {
      console.error('[Chimera Lore] Error fetching tags:', tagsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch tags',
        req
      );
    }

    return sendSuccess(res, tags || [], req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/lore/:id
 * Get a single lore entry by ID
 */
router.get(
  '/:id',
  validateRequest(UuidParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id } = req.params;

      // Fetch the lore entry
      const { data: loreEntry, error: fetchError } = await supabaseAdmin
        .from('chimera_lore')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !loreEntry) {
        if (fetchError?.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Lore entry not found',
            req
          );
        }
        console.error('[Chimera Lore] Error fetching lore entry:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch lore entry',
          req
        );
      }

      // Check world ownership for access control
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id, visibility')
        .eq('id', loreEntry.world_id)
        .single();

      if (worldError || !world) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'World not found',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (world.owner_user_id !== userId && world.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this lore entry',
          req
        );
      }

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'lore_entry');

      if (assetTags && loreEntry) {
        (loreEntry as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      // Transform to match frontend expectations
      const transformedEntry = {
        ...loreEntry,
        content_chunk: loreEntry.entry_text, // Map entry_text to content_chunk for frontend compatibility
        tags: (loreEntry as any).tags || [],
      };

      return sendSuccess(res, transformedEntry as any, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * GET /api/v2/chimera/lore
 * Get all lore entries for a world (requires ?world_id= query param)
 * Also supports ?story_id= for backward compatibility (gets world_id from story)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Verify context and access
    const query = ContextQuerySchema.safeParse(req.query);
    if (!query.success) {
      return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'Invalid query parameters', req);
    }

    const { world_id, entity_id, story_id } = query.data;

    if (!world_id && !entity_id && !story_id) {
      return sendErrorWithStatus(res, ApiErrorCode.VALIDATION_FAILED, 'world_id, entity_id, or story_id is required', req);
    }

    let targetWorldId = world_id;

    // Entity Context
    if (entity_id) {
      const { data: entity, error } = await supabaseAdmin.from('chimera_entities').select('world_id, owner_user_id').eq('id', entity_id).single();
      if (error || !entity) return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Entity not found', req);

      targetWorldId = entity.world_id; // Infer world for checking public visibility fallback if needed

      // If I own the entity, I can see its lore.
      if (entity.owner_user_id !== userId) {
        // Check if world is public as fallback
        const { data: w } = await supabaseAdmin.from('chimera_worlds').select('visibility').eq('id', targetWorldId).single();
        if (w?.visibility !== 'public') return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'Access denied', req);
      }
    }
    // Story Context (Legacy/backward compat mostly)
    else if (story_id) {
      const { data: story, error } = await supabaseAdmin.from('chimera_stories').select('world_id, owner_user_id').eq('id', story_id).single();
      if (error || !story) return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
      if (story.owner_user_id !== userId) return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'Access denied', req);
      targetWorldId = story.world_id;
    }
    // World Context
    else if (world_id) {
      const { data: world, error } = await supabaseAdmin.from('chimera_worlds').select('owner_user_id, visibility').eq('id', world_id).single();
      if (error || !world) return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
      if (world.owner_user_id !== userId && world.visibility !== 'public') return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'Access denied', req);
    }

    // Use Repository for strict filtering and logging
    const repo = new LoreRepository(supabaseAdmin);
    // repo.findAll throws on error, so we rely on the outer try/catch
    const loreEntries = await repo.findAll({
      world_id,
      entity_id,
      story_id
    });

    // Map to expected format (extract from fragment for backward compatibility)
    const mappedLore = (loreEntries || []).map((entry: any) => {
      const fragment = entry.fragment || {};
      return {
        ...entry,
        display_name: fragment.display_name,
        entry_text: fragment.entry_text,
        type: fragment.type,
      };
    });

    // Fetch tags for all lore entries
    if (mappedLore && mappedLore.length > 0) {
      const entryIds = mappedLore.map((entry: any) => String(entry.id));
      const { data: allAssetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          asset_id,
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .in('asset_id', entryIds)
        .eq('asset_type', 'lore_entry');

      // Group tags by asset_id
      const tagsByEntryId = new Map<string, any[]>();
      if (allAssetTags) {
        for (const link of allAssetTags) {
          if (link.tag) {
            const entryId = String(link.asset_id);
            if (!tagsByEntryId.has(entryId)) {
              tagsByEntryId.set(entryId, []);
            }
            tagsByEntryId.get(entryId)!.push(link.tag);
          }
        }
      }

      // Attach tags to each entry
      for (const entry of mappedLore) {
        (entry as any).tags = tagsByEntryId.get(String(entry.id)) || [];
      }
    }

    return sendSuccess(res, (mappedLore || []) as ChimeraLoreEntry[], req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * PUT /api/v2/chimera/lore/:id
 * Update a lore entry
 */
router.put(
  '/:id',
  validateRequest(UpdateLoreEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Validate UUID param
      const paramResult = UuidParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid lore entry ID',
          req
        );
      }

      const { id } = paramResult.data;
      const updateData = req.body;
      const { tag_names, keywords, type, ...otherUpdateData } = updateData;

      // Fetch the lore entry to verify ownership
      const { data: loreEntry, error: fetchError } = await supabaseAdmin
        .from('chimera_lore')
        .select('world_id, fragment, owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError || !loreEntry) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Lore entry not found',
          req
        );
      }

      // Check world ownership and lifecycle state
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id, visibility')
        .eq('id', loreEntry.world_id)
        .single();

      if (worldError || !world || world.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to update this lore entry',
          req
        );
      }

      // Lifecycle enforcement: Cannot edit lore for published worlds
      if (world.visibility === 'public' && !updateData.visibility) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot edit lore for published worlds. Please clone to create a new version.',
          req
        );
      }

      // Update the lore entry
      const updatePayload: Partial<ChimeraLoreEntry> = {
        updated_at: new Date().toISOString(),
      };

      if (keywords !== undefined) {
        updatePayload.keywords = keywords;
      }

      // We need to merge fragment updates because it's JSONB
      // First fetch existing fragment
      const existingFragment = loreEntry.fragment || {};
      const newFragment = { ...existingFragment };
      let fragmentChanged = false;

      if (otherUpdateData.display_name !== undefined) {
        newFragment.display_name = otherUpdateData.display_name;
        fragmentChanged = true;
      }
      if (otherUpdateData.entry_text !== undefined) {
        newFragment.entry_text = otherUpdateData.entry_text;
        fragmentChanged = true;
      }
      if (type !== undefined) {
        newFragment.type = type;
        fragmentChanged = true;
      }

      if (fragmentChanged) {
        newFragment.updated_at = new Date().toISOString();
        updatePayload.fragment = newFragment;
      }

      const { data: updatedEntry, error: updateError } = await supabaseAdmin
        .from('chimera_lore')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('[Chimera Lore] Error updating lore entry:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update lore entry',
          req
        );
      }

      // Handle tags if provided
      if (tag_names !== undefined) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'lore_entry');

        // Create new tag links
        if (tag_names.length > 0) {
          const tagIds: string[] = [];

          for (const tagName of tag_names) {
            const normalized = normalizeTagName(tagName);
            if (!normalized) continue;

            // Check if tag exists
            const { data: existingTag, error: checkError } = await supabaseAdmin
              .from('chimera_tags')
              .select('id')
              .eq('tag_name', normalized)
              .single();

            let tagId: string;

            // PGRST116 is "not found" which is expected if tag doesn't exist
            if (checkError && checkError.code !== 'PGRST116') {
              console.error('[Chimera Lore] Error checking existing tag:', checkError);
              continue;
            }

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              // Create new tag (unapproved)
              const { data: newTag, error: tagError } = await supabaseAdmin
                .from('chimera_tags')
                .insert({
                  tag_name: normalized,
                  is_approved: false,
                })
                .select('id')
                .single();

              if (tagError) {
                console.error('[Chimera Lore] Error creating tag:', tagError);
                continue;
              }

              if (!newTag || !newTag.id) {
                console.error('[Chimera Lore] Tag created but no ID returned');
                continue;
              }

              tagId = newTag.id;
            }

            tagIds.push(tagId);
          }

          // Create asset tag links
          if (tagIds.length > 0) {
            const assetTagLinks = tagIds.map((tagId) => ({
              tag_id: tagId,
              asset_id: id,
              asset_type: 'lore_entry',
            }));

            const { error: linksError } = await supabaseAdmin
              .from('chimera_asset_tags')
              .insert(assetTagLinks);

            if (linksError) {
              console.error('[Chimera Lore] Error creating tag links:', linksError);
              // Continue anyway - lore entry is updated, tags can be fixed later
            }
          }
        }
      }

      // Fetch tags for response
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'lore_entry');

      if (assetTags && updatedEntry) {
        (updatedEntry as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      return sendSuccess(res, updatedEntry as ChimeraLoreEntry, req);
    } catch (error) {
      console.error('[Chimera Lore] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

/**
 * DELETE /api/v2/chimera/lore/:id
 * Delete a lore entry
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Validate UUID param
    const paramResult = UuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid lore entry ID',
        req
      );
    }

    const { id } = paramResult.data;

    // Fetch the lore entry to verify ownership
    const { data: loreEntry, error: fetchError } = await supabaseAdmin
      .from('chimera_lore')
      .select('world_id')
      .eq('id', id)
      .single();

    if (fetchError || !loreEntry) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Lore entry not found',
        req
      );
    }

    // Check world ownership
    const { data: world, error: worldError } = await supabaseAdmin
      .from('chimera_worlds')
      .select('owner_user_id')
      .eq('id', loreEntry.world_id)
      .single();

    if (worldError || !world || world.owner_user_id !== userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'You do not have permission to delete this lore entry',
        req
      );
    }

    // Delete the lore entry
    const { error: deleteError } = await supabaseAdmin
      .from('chimera_lore')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Chimera Lore] Error deleting lore entry:', deleteError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to delete lore entry',
        req
      );
    }

    return sendSuccess(res, { id, deleted: true }, req);
  } catch (error) {
    console.error('[Chimera Lore] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

export default router;
