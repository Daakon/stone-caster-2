/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Lore
 *     description: User-facing CRUD endpoints for Chimera lore entries (Pure RAG system)
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';
import type { ChimeraLoreEntry } from '@shared/types/chimera-lore.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Zod schemas for validation
const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const CreateLoreEntrySchema = z.object({
  story_id: z.string().min(1),
  display_name: z.string().min(1).max(200),
  entry_text: z.string().min(1),
});

const UpdateLoreEntrySchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  entry_text: z.string().min(1).optional(),
});

const StoryIdQuerySchema = z.object({
  story_id: z.string().min(1),
});

/**
 * POST /api/v2/chimera/lore
 * Create a new lore entry
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

      const { story_id, display_name, entry_text } = req.body;

      // Verify story exists and user has access
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('id, owner_user_id')
        .eq('id', story_id)
        .single();

      if (storyError || !story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Check ownership
      if (story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to add lore to this story',
          req
        );
      }

      // Create the lore entry
      const { data: loreEntry, error: loreError } = await supabaseAdmin
        .from('chimera_lore_entries')
        .insert({
          story_id,
          display_name,
          entry_text,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (loreError) {
        console.error('[Chimera Lore] Error creating lore entry:', loreError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create lore entry',
          req
        );
      }

      return sendSuccess(res, loreEntry as ChimeraLoreEntry, req);
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

    // Fetch all lore entries for stories owned by the user
    // First, get all stories owned by the user
    const { data: userStories, error: storiesError } = await supabaseAdmin
      .from('chimera_stories')
      .select('id')
      .eq('owner_user_id', userId);

    if (storiesError) {
      console.error('[Chimera Lore] Error fetching user stories:', storiesError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch user stories',
        req
      );
    }

    const storyIds = (userStories || []).map((s) => s.id);

    if (storyIds.length === 0) {
      return sendSuccess(res, [], req);
    }

    // Fetch lore entries with story visibility
    const { data: loreEntries, error: loreError } = await supabaseAdmin
      .from('chimera_lore_entries')
      .select(`
        *,
        story:chimera_stories!story_id(visibility, owner_user_id)
      `)
      .in('story_id', storyIds)
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

    // Transform lore entries to include visibility from story
    const transformedEntries = (loreEntries || []).map((entry: any) => ({
      ...entry,
      visibility: entry.story?.visibility || 'private',
      owner_user_id: entry.story?.owner_user_id || userId,
      version: 1, // Lore entries don't have version, default to 1
      is_system_asset: false, // Lore entries are not system assets
      content_chunk: entry.entry_text, // Map entry_text to content_chunk for frontend compatibility
      tags: [], // Lore entries don't have tags yet
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
 * GET /api/v2/chimera/lore
 * Get all lore entries for a story (requires ?story_id= query param)
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

    // Validate query params
    const queryResult = StoryIdQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'story_id query parameter is required',
        req
      );
    }

    const { story_id } = queryResult.data;

    // Verify story exists and user has access
    const { data: story, error: storyError } = await supabaseAdmin
      .from('chimera_stories')
      .select('id, owner_user_id')
      .eq('id', story_id)
      .single();

    if (storyError || !story) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Story not found',
        req
      );
    }

    // Check ownership
    if (story.owner_user_id !== userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'You do not have permission to view lore for this story',
        req
      );
    }

    // Fetch lore entries
    const { data: loreEntries, error: loreError } = await supabaseAdmin
      .from('chimera_lore_entries')
      .select('*')
      .eq('story_id', story_id)
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

    return sendSuccess(res, (loreEntries || []) as ChimeraLoreEntry[], req);
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

      // Fetch the lore entry to verify ownership
      const { data: loreEntry, error: fetchError } = await supabaseAdmin
        .from('chimera_lore_entries')
        .select('story_id')
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

      // Check story ownership
      const { data: story, error: storyError } = await supabaseAdmin
        .from('chimera_stories')
        .select('owner_user_id')
        .eq('id', loreEntry.story_id)
        .single();

      if (storyError || !story || story.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to update this lore entry',
          req
        );
      }

      // Update the lore entry
      const updatePayload: Partial<ChimeraLoreEntry> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.display_name !== undefined) {
        updatePayload.display_name = updateData.display_name;
      }
      if (updateData.entry_text !== undefined) {
        updatePayload.entry_text = updateData.entry_text;
      }

      const { data: updatedEntry, error: updateError } = await supabaseAdmin
        .from('chimera_lore_entries')
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
      .from('chimera_lore_entries')
      .select('story_id')
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

    // Check story ownership
    const { data: story, error: storyError } = await supabaseAdmin
      .from('chimera_stories')
      .select('owner_user_id')
      .eq('id', loreEntry.story_id)
      .single();

    if (storyError || !story || story.owner_user_id !== userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        'You do not have permission to delete this lore entry',
        req
      );
    }

    // Delete the lore entry
    const { error: deleteError } = await supabaseAdmin
      .from('chimera_lore_entries')
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
