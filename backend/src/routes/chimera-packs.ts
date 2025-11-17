/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Content Packs
 *     description: User-facing CRUD endpoints for Chimera content packs
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// Zod schemas for validation
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);
const PackTypeSchema = z.enum(['NPC', 'ITEM', 'LORE', 'MIXED']);

const CreatePackSchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  pack_type: PackTypeSchema,
  entity_template_ids: z.array(z.string()).default([]),
  ruleset_template_ids: z.array(z.string()).default([]),
  lore_template_ids: z.array(z.string()).default([]),
  depends_on_pack_ids: z.array(z.string()).default([]),
  inter_entity_state: z.record(z.unknown()).optional().nullable(),
});

const UpdatePackSchema = CreatePackSchema.partial().extend({
  visibility: VisibilitySchema.optional(),
});

// Generate ID (using simple timestamp-based approach, can be replaced with CUID)
function generateId(): string {
  return `chimera_pack_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/v2/chimera/packs/selectable
 * Returns all public/private packs (for dependency selection)
 * Optional query parameter: ?exclude=<pack_id> - excludes the specified pack from results
 */
router.get('/selectable', async (req: Request, res: Response) => {
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

    // Get packs that are either public or owned by the user
    let query = supabaseAdmin
      .from('chimera_content_packs')
      .select('id, display_name, version, pack_type, visibility')
      .or(`visibility.eq.public,owner_user_id.eq.${userId}`);

    // Exclude a specific pack if requested (to prevent self-dependencies)
    const excludePackId = req.query.exclude as string | undefined;
    if (excludePackId && excludePackId.trim()) {
      query = query.neq('id', excludePackId.trim());
    }

    const { data: packs, error } = await query.order('display_name', { ascending: true });

    if (error) {
      console.error('[Chimera Packs] Error fetching selectable packs:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch packs',
        req
      );
    }

    return sendSuccess(res, packs || [], req);
  } catch (error) {
    console.error('[Chimera Packs] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * GET /api/v2/chimera/packs/my-creations
 * Get all packs owned by the current user
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

    const { data: packs, error } = await supabaseAdmin
      .from('chimera_content_packs')
      .select(`
        *,
        entity_links:chimera_content_pack_entity_links(entity_template_id),
        ruleset_links:chimera_content_pack_ruleset_links(ruleset_template_id),
        lore_links:chimera_content_pack_lore_links(lore_template_id),
        dependencies:chimera_pack_dependencies!pack_id(depends_on_pack_id)
      `)
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Chimera Packs] Error fetching packs:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch packs',
        req
      );
    }

    return sendSuccess(res, packs || [], req);
  } catch (error) {
    console.error('[Chimera Packs] Unexpected error:', error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * POST /api/v2/chimera/packs
 * Create a new content pack
 */
router.post(
  '/',
  validateRequest(CreatePackSchema),
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

      const packData = req.body;
      const id = generateId();

      // Create the pack - always set visibility to 'private' for new packs
      const { error: createError } = await supabaseAdmin
        .from('chimera_content_packs')
        .insert({
          id,
          owner_user_id: userId,
          visibility: 'private',
          display_name: packData.display_name,
          description_short: packData.description_short,
          pack_type: packData.pack_type,
          inter_entity_state: packData.inter_entity_state || null,
          version: 1,
        });

      if (createError) {
        console.error('[Chimera Packs] Error creating pack:', createError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create pack',
          req
        );
      }

      // Create entity links
      if (packData.entity_template_ids && packData.entity_template_ids.length > 0) {
        const entityLinks = packData.entity_template_ids.map((entityId: string) => ({
          pack_id: id,
          entity_template_id: entityId,
        }));

        const { error: entityLinksError } = await supabaseAdmin
          .from('chimera_content_pack_entity_links')
          .insert(entityLinks);

        if (entityLinksError) {
          console.error('[Chimera Packs] Error creating entity links:', entityLinksError);
          // Rollback pack creation
          await supabaseAdmin.from('chimera_content_packs').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create entity links',
            req
          );
        }
      }

      // Create ruleset links
      if (packData.ruleset_template_ids && packData.ruleset_template_ids.length > 0) {
        const rulesetLinks = packData.ruleset_template_ids.map((rulesetId: string) => ({
          pack_id: id,
          ruleset_template_id: rulesetId,
        }));

        const { error: rulesetLinksError } = await supabaseAdmin
          .from('chimera_content_pack_ruleset_links')
          .insert(rulesetLinks);

        if (rulesetLinksError) {
          console.error('[Chimera Packs] Error creating ruleset links:', rulesetLinksError);
          // Rollback
          await supabaseAdmin.from('chimera_content_pack_entity_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_packs').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create ruleset links',
            req
          );
        }
      }

      // Create lore links
      if (packData.lore_template_ids && packData.lore_template_ids.length > 0) {
        const loreLinks = packData.lore_template_ids.map((loreId: string) => ({
          pack_id: id,
          lore_template_id: loreId,
        }));

        const { error: loreLinksError } = await supabaseAdmin
          .from('chimera_content_pack_lore_links')
          .insert(loreLinks);

        if (loreLinksError) {
          console.error('[Chimera Packs] Error creating lore links:', loreLinksError);
          // Rollback
          await supabaseAdmin.from('chimera_content_pack_ruleset_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_pack_entity_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_packs').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create lore links',
            req
          );
        }
      }

      // Create dependencies
      if (packData.depends_on_pack_ids && packData.depends_on_pack_ids.length > 0) {
        const dependencies = packData.depends_on_pack_ids.map((depPackId: string) => ({
          pack_id: id,
          depends_on_pack_id: depPackId,
        }));

        const { error: depsError } = await supabaseAdmin
          .from('chimera_pack_dependencies')
          .insert(dependencies);

        if (depsError) {
          console.error('[Chimera Packs] Error creating dependencies:', depsError);
          // Rollback
          await supabaseAdmin.from('chimera_content_pack_lore_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_pack_ruleset_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_pack_entity_links').delete().eq('pack_id', id);
          await supabaseAdmin.from('chimera_content_packs').delete().eq('id', id);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to create dependencies',
            req
          );
        }
      }

      // Fetch the complete pack with relations
      const { data: completePack, error: fetchError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select(`
          *,
          entity_links:chimera_content_pack_entity_links(entity_template_id),
          ruleset_links:chimera_content_pack_ruleset_links(ruleset_template_id),
          lore_links:chimera_content_pack_lore_links(lore_template_id),
          dependencies:chimera_pack_dependencies!pack_id(depends_on_pack_id)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Packs] Error fetching created pack:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Pack created but failed to fetch',
          req
        );
      }

      return sendSuccess(res, completePack, req);
    } catch (error) {
      console.error('[Chimera Packs] Unexpected error:', error);
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
 * GET /api/v2/chimera/packs/:id/rulesets
 * Get rulesets linked to a pack
 */
router.get(
  '/:id/rulesets',
  validateRequest(TextIdParamSchema, 'params'),
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

      // Get pack to check access
      const { data: pack, error: packError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select('id, owner_user_id, visibility')
        .eq('id', id)
        .single();

      if (packError) {
        if (packError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Pack not found',
            req
          );
        }
        console.error('[Chimera Packs] Error fetching pack:', packError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch pack',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (pack.owner_user_id !== userId && pack.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this pack',
          req
        );
      }

      // Get linked ruleset template IDs
      const { data: links, error: linksError } = await supabaseAdmin
        .from('chimera_content_pack_ruleset_links')
        .select('ruleset_template_id')
        .eq('pack_id', id);

      if (linksError) {
        console.error('[Chimera Packs] Error fetching ruleset links:', linksError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset links',
          req
        );
      }

      const rulesetIds = (links || []).map((l) => l.ruleset_template_id);

      if (rulesetIds.length === 0) {
        return sendSuccess(res, [], req);
      }

      // Get full ruleset template details
      const { data: rulesets, error: rulesetsError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('*')
        .in('id', rulesetIds);

      if (rulesetsError) {
        console.error('[Chimera Packs] Error fetching ruleset templates:', rulesetsError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset templates',
          req
        );
      }

      return sendSuccess(res, rulesets || [], req);
    } catch (error) {
      console.error('[Chimera Packs] Unexpected error:', error);
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
 * GET /api/v2/chimera/packs/:id
 * Get a single pack (ownership-aware)
 */
router.get(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;

      const { data: pack, error: packError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select(`
          *,
          entity_links:chimera_content_pack_entity_links(entity_template_id),
          ruleset_links:chimera_content_pack_ruleset_links(ruleset_template_id),
          lore_links:chimera_content_pack_lore_links(lore_template_id),
          dependencies:chimera_pack_dependencies!pack_id(depends_on_pack_id)
        `)
        .eq('id', id)
        .single();

      if (packError) {
        if (packError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Pack not found',
            req
          );
        }
        console.error('[Chimera Packs] Error fetching pack:', packError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch pack',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (pack.owner_user_id !== userId && pack.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Access denied',
          req
        );
      }

      return sendSuccess(res, pack, req);
    } catch (error) {
      console.error('[Chimera Packs] Unexpected error:', error);
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
 * PUT /api/v2/chimera/packs/:id
 * Update a pack (owner-only) and handle diffing all links and dependencies
 * Also increments version number
 */
router.put(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdatePackSchema),
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
      const updateData = req.body;

      // Check ownership
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select('owner_user_id, version')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Pack not found',
            req
          );
        }
        console.error('[Chimera Packs] Error checking ownership:', checkError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to verify ownership',
          req
        );
      }

      if (existing.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to update this pack',
          req
        );
      }

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        version: existing.version + 1, // Increment version
      };

      if (updateData.display_name !== undefined) {
        updatePayload.display_name = updateData.display_name;
      }
      if (updateData.description_short !== undefined) {
        updatePayload.description_short = updateData.description_short;
      }
      if (updateData.pack_type !== undefined) {
        updatePayload.pack_type = updateData.pack_type;
      }
      if (updateData.visibility !== undefined) {
        updatePayload.visibility = updateData.visibility;
      }
      if (updateData.inter_entity_state !== undefined) {
        updatePayload.inter_entity_state = updateData.inter_entity_state;
      }

      // Update the pack
      const { error: updateError } = await supabaseAdmin
        .from('chimera_content_packs')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) {
        console.error('[Chimera Packs] Error updating pack:', updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update pack',
          req
        );
      }

      // Helper function to diff and update links
      const diffAndUpdateLinks = async (
        tableName: string,
        packIdColumn: string,
        linkIdColumn: string,
        currentIds: string[],
        newIds: string[]
      ) => {
        const currentSet = new Set(currentIds);
        const newSet = new Set(newIds);

        const toAdd = Array.from(newSet).filter((id) => !currentSet.has(id));
        const toRemove = Array.from(currentSet).filter((id) => !newSet.has(id));

        // Remove old links
        if (toRemove.length > 0) {
          const { error: deleteError } = await supabaseAdmin
            .from(tableName)
            .delete()
            .eq(packIdColumn, id)
            .in(linkIdColumn, toRemove);

          if (deleteError) {
            throw new Error(`Failed to delete ${tableName} links: ${deleteError.message}`);
          }
        }

        // Add new links
        if (toAdd.length > 0) {
          const newLinks = toAdd.map((linkId) => ({
            [packIdColumn]: id,
            [linkIdColumn]: linkId,
          }));

          const { error: insertError } = await supabaseAdmin.from(tableName).insert(newLinks);

          if (insertError) {
            throw new Error(`Failed to insert ${tableName} links: ${insertError.message}`);
          }
        }
      };

      // Handle entity links diffing
      if (updateData.entity_template_ids !== undefined) {
        const { data: currentEntityLinks } = await supabaseAdmin
          .from('chimera_content_pack_entity_links')
          .select('entity_template_id')
          .eq('pack_id', id);

        const currentEntityIds = (currentEntityLinks || []).map((l) => l.entity_template_id);
        await diffAndUpdateLinks(
          'chimera_content_pack_entity_links',
          'pack_id',
          'entity_template_id',
          currentEntityIds,
          updateData.entity_template_ids
        );
      }

      // Handle ruleset links diffing
      if (updateData.ruleset_template_ids !== undefined) {
        const { data: currentRulesetLinks } = await supabaseAdmin
          .from('chimera_content_pack_ruleset_links')
          .select('ruleset_template_id')
          .eq('pack_id', id);

        const currentRulesetIds = (currentRulesetLinks || []).map((l) => l.ruleset_template_id);
        await diffAndUpdateLinks(
          'chimera_content_pack_ruleset_links',
          'pack_id',
          'ruleset_template_id',
          currentRulesetIds,
          updateData.ruleset_template_ids
        );
      }

      // Handle lore links diffing
      if (updateData.lore_template_ids !== undefined) {
        const { data: currentLoreLinks } = await supabaseAdmin
          .from('chimera_content_pack_lore_links')
          .select('lore_template_id')
          .eq('pack_id', id);

        const currentLoreIds = (currentLoreLinks || []).map((l) => l.lore_template_id);
        await diffAndUpdateLinks(
          'chimera_content_pack_lore_links',
          'pack_id',
          'lore_template_id',
          currentLoreIds,
          updateData.lore_template_ids
        );
      }

      // Handle dependencies diffing
      if (updateData.depends_on_pack_ids !== undefined) {
        const { data: currentDeps } = await supabaseAdmin
          .from('chimera_pack_dependencies')
          .select('depends_on_pack_id')
          .eq('pack_id', id);

        const currentDepIds = (currentDeps || []).map((d) => d.depends_on_pack_id);
        await diffAndUpdateLinks(
          'chimera_pack_dependencies',
          'pack_id',
          'depends_on_pack_id',
          currentDepIds,
          updateData.depends_on_pack_ids
        );
      }

      // Fetch the complete updated pack
      const { data: updatedPack, error: fetchError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select(`
          *,
          entity_links:chimera_content_pack_entity_links(entity_template_id),
          ruleset_links:chimera_content_pack_ruleset_links(ruleset_template_id),
          lore_links:chimera_content_pack_lore_links(lore_template_id),
          dependencies:chimera_pack_dependencies!pack_id(depends_on_pack_id)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('[Chimera Packs] Error fetching updated pack:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Pack updated but failed to fetch',
          req
        );
      }

      return sendSuccess(res, updatedPack, req);
    } catch (error) {
      console.error('[Chimera Packs] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error',
        req
      );
    }
  }
);

/**
 * DELETE /api/v2/chimera/packs/:id
 * Delete a pack (owner-only)
 */
router.delete(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
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

      // Check ownership
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('chimera_content_packs')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Pack not found',
            req
          );
        }
        console.error('[Chimera Packs] Error checking ownership:', checkError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to verify ownership',
          req
        );
      }

      if (existing.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to delete this pack',
          req
        );
      }

      // Delete the pack (cascade will handle links)
      const { error: deleteError } = await supabaseAdmin
        .from('chimera_content_packs')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('[Chimera Packs] Error deleting pack:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete pack',
          req
        );
      }

      return sendSuccess(res, { id }, req);
    } catch (error) {
      console.error('[Chimera Packs] Unexpected error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Internal server error',
        req
      );
    }
  }
);

export default router;

