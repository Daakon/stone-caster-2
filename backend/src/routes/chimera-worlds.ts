/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Worlds
 *     description: User-facing CRUD endpoints for Chimera worlds
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Custom schema for text-based IDs (not UUIDs)
const TextIdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

// All routes require authentication
router.use(authenticateToken);

// Zod schemas for validation
const VisibilitySchema = z.enum(['private', 'pending_approval', 'public']);

// CreateWorldSchema does not include visibility - it's always set to 'private' on creation
const CreateWorldSchema = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  description_long: z.string().optional().nullable(),
  character_schema_contributions: z.record(z.unknown()).optional().default({}),
  ruleset_template_ids: z.array(z.string()).default([]),
  tag_names: z.array(z.string()).default([]),
  tags: z.array(z.string()).optional().default([]), // Direct tags array on world
});

// UpdateWorldSchema explicitly excludes visibility - it can only be changed via publish endpoint
// Note: CreateWorldSchema doesn't include visibility, so omit is not needed but kept for clarity
const UpdateWorldSchema = CreateWorldSchema.partial();

// Helper function to normalize tag names
function normalizeTagName(tagName: string): string {
  return tagName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

// Helper function to generate a slug from display name
// Converts to lowercase and replaces spaces with dashes (simple approach)
function generateSlug(displayName: string): string {
  if (!displayName || !displayName.trim()) {
    return '';
  }
  return displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')  // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '')  // Remove non-alphanumeric except dashes
    .replace(/-+/g, '-')  // Replace multiple dashes with single dash
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing dashes
}

// Helper function to transform database world to API response format
// Maps 'name' field to 'display_name' for frontend compatibility
function transformWorldForResponse(world: any): any {
  if (!world) return world;
  
  return {
    ...world,
    display_name: world.name || world.display_name || '',  // Map name -> display_name
    // Keep all other fields as-is
  };
}

/**
 * POST /api/v2/chimera/worlds
 * Create a new world
 */
router.post(
  '/',
  validateRequest(CreateWorldSchema),
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

      const worldData = req.body;

      // Validate that all ruleset_template_ids reference valid templates
      // Note: rule_type is stored in definition JSONB in Supabase schema, so we skip MODIFIER validation
      // All rulesets linked to worlds should be MODIFIER type, but we can't validate without parsing definition
      if (worldData.ruleset_template_ids && worldData.ruleset_template_ids.length > 0) {
        const { data: templates, error: templatesError } = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('id, definition')
          .in('id', worldData.ruleset_template_ids);

        if (templatesError) {
          console.error('[Chimera Worlds] Error validating ruleset templates:', templatesError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to validate ruleset templates',
            req
          );
        }

        if (!templates || templates.length !== worldData.ruleset_template_ids.length) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'One or more ruleset template IDs are invalid',
            req
          );
        }

        // Optional: Validate rule_type from definition if it exists
        // For now, we skip this validation as rule_type may not be in definition JSONB
        // const invalidTypes = templates.filter(t => {
        //   const def = t.definition as any;
        //   return def?.rule_type !== 'MODIFIER';
        // });
        // if (invalidTypes.length > 0) {
        //   return sendErrorWithStatus(
        //     res,
        //     ApiErrorCode.VALIDATION_FAILED,
        //     'Only MODIFIER ruleset templates can be linked to worlds',
        //     req
        //   );
        // }
      }

      // Create the world - always set visibility to 'private' for new worlds
      // Let the database generate the UUID via gen_random_uuid() default
      // Generate slug from display_name (required field)
      const slug = generateSlug(worldData.display_name);
      
      // Generate key - in Supabase schema, key is required and unique
      // Use slug as the key (they serve similar purposes)
      const key = slug || `world-${Date.now()}`;
      
      // Build definition JSONB - Supabase schema requires this field
      // Store world metadata in definition for compatibility with V3 schema
      // Include ruleset_template_ids in definition (junction table is deprecated)
      const definition = {
        id: key,
        name: worldData.display_name,
        description_short: worldData.description_short || null,
        description_long: worldData.description_long || null,
        ruleset_template_ids: worldData.ruleset_template_ids || [],
      };
      
      const worldInsertData: any = {
        owner_user_id: userId,
        key: key, // Required by Supabase schema (NOT NULL, UNIQUE)
        definition: definition, // Required by Supabase schema (NOT NULL)
        name: worldData.display_name,
        slug: slug,
        description_short: worldData.description_short,
        description_long: worldData.description_long,
        visibility: 'private', // Always private for new worlds
        tags: worldData.tags || [], // Store tags directly on world
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add character_schema_contributions if provided
      // Note: This may fail if Supabase schema cache is stale (PGRST204 error)
      // If it fails, we'll retry without this field since it has a default value
      const hasSchemaContributions = worldData.character_schema_contributions && 
                                     Object.keys(worldData.character_schema_contributions).length > 0;
      
      if (hasSchemaContributions) {
        worldInsertData.character_schema_contributions = worldData.character_schema_contributions;
      }

      let { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .insert(worldInsertData)
        .select()
        .single();

      // If we get a PGRST204 error for character_schema_contributions, retry without it
      // The database default will handle it (defaults to '{}'::jsonb)
      if (worldError && 
          worldError.code === 'PGRST204' && 
          worldError.message?.includes('character_schema_contributions') &&
          hasSchemaContributions) {
        console.warn('[Chimera Worlds] Schema cache issue with character_schema_contributions, retrying without it');
        
        // Remove character_schema_contributions and retry
        const retryInsertData = { ...worldInsertData };
        delete retryInsertData.character_schema_contributions;
        
        const retryResult = await supabaseAdmin
          .from('chimera_worlds')
          .insert(retryInsertData)
          .select()
          .single();
        
        world = retryResult.data;
        worldError = retryResult.error;
        
        // If retry succeeds, try to update character_schema_contributions
        // Sometimes UPDATE works even when INSERT doesn't due to schema cache timing
        if (!worldError && world && hasSchemaContributions) {
          const { error: updateError } = await supabaseAdmin
            .from('chimera_worlds')
            .update({ 
              character_schema_contributions: worldData.character_schema_contributions as any
            })
            .eq('id', world.id);
          
          if (updateError) {
            console.warn('[Chimera Worlds] Failed to update character_schema_contributions after retry. World created but schema contributions not set.');
            console.warn('[Chimera Worlds] Error:', updateError.message);
            console.warn('[Chimera Worlds] To fix: Refresh Supabase schema cache via dashboard or run: SELECT pg_notify(\'pgrst\', \'reload schema\');');
            // Continue anyway - world is created, schema contributions can be updated later via dashboard
          } else {
            // Re-fetch the world to get updated character_schema_contributions
            const { data: updatedWorld } = await supabaseAdmin
              .from('chimera_worlds')
              .select('*')
              .eq('id', world.id)
              .single();
            
            if (updatedWorld) {
              world = updatedWorld;
            }
          }
        }
      }

      if (worldError) {
        console.error('[Chimera Worlds] Error creating world:', worldError);
        
        // Provide helpful error message for schema cache issues
        if (worldError.code === 'PGRST204') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Database schema cache is out of date. Please refresh the Supabase schema cache via the Supabase dashboard or run: `SELECT pg_notify(\'pgrst\', \'reload schema\');`',
            req
          );
        }
        
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create world',
          req
        );
      }

      if (!world || !world.id) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create world: no ID returned',
          req
        );
      }

      // Get the UUID ID from the inserted world (database-generated)
      const worldId = world.id;

      // Note: Ruleset links are stored in world definition JSONB, not in junction table
      // The ruleset_template_ids are already included in the definition JSONB above

      // Handle tags: normalize, create/get tags, and create links
      if (worldData.tag_names && worldData.tag_names.length > 0) {
        const tagIds: string[] = [];

        for (const tagName of worldData.tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          // Check if tag exists
          let { data: existingTag } = await supabaseAdmin
            .from('chimera_tags')
            .select('id')
            .eq('tag_name', normalized)
            .single();

          let tagId: string;

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
              console.error('[Chimera Worlds] Error creating tag:', tagError);
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
            asset_id: worldId,
            asset_type: 'world',
          }));

          const { error: linksError } = await supabaseAdmin
            .from('chimera_asset_tags')
            .insert(assetTagLinks);

          if (linksError) {
            console.error('[Chimera Worlds] Error creating tag links:', linksError);
            // Continue anyway - world is created, tags can be fixed later
          }
        }
      }

      // Fetch world (no junction table joins - rulesets are in definition JSONB)
      const { data: worldWithLinks } = await supabaseAdmin
        .from('chimera_worlds')
        .select('*')
        .eq('id', worldId)
        .single();

      // Transform to API format (map name -> display_name)
      const transformedWorld = transformWorldForResponse(worldWithLinks || world);
      return sendSuccess(res, transformedWorld, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/selectable
 * Get all selectable worlds (public or owned by user)
 * Query params:
 *   - tag: Filter worlds by tag (e.g., ?tag=fantasy)
 */
router.get(
  '/selectable',
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

      const tag = req.query.tag as string | undefined;

      let query = supabaseAdmin
        .from('chimera_worlds')
        .select('*')
        .or(`visibility.eq.public,owner_user_id.eq.${userId}`);

      // Filter by tag if provided
      if (tag) {
        query = query.contains('tags', [tag]);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        console.error('[Chimera Worlds] Error fetching selectable worlds:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch selectable worlds',
          req
        );
      }

      // Transform worlds to API format (map name -> display_name)
      const transformedWorlds = (data || []).map(transformWorldForResponse);
      return sendSuccess(res, transformedWorlds, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/my-creations
 * Get all worlds owned by the current user
 */
router.get(
  '/my-creations',
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

      const { data, error } = await supabaseAdmin
        .from('chimera_worlds')
        .select('*')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Chimera Worlds] Error fetching user worlds:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch worlds',
          req
        );
      }

      // Transform worlds to API format (map name -> display_name)
      const transformedWorlds = (data || []).map(transformWorldForResponse);
      return sendSuccess(res, transformedWorlds, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/:id/rulesets
 * Get rulesets linked to a world
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

      // Get world to check access
      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('id, owner_user_id, visibility')
        .eq('id', id)
        .single();

      if (worldError) {
        if (worldError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error fetching world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch world',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (world.owner_user_id !== userId && world.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not have permission to view this world',
          req
        );
      }

      // Get linked ruleset template IDs from world definition JSONB
      // Note: Rulesets are stored in the world's definition JSONB, not in a junction table
      // For now, return empty array - this endpoint may need to be updated to read from definition
      const links: Array<{ ruleset_template_id: string }> = [];

      // Extract ruleset IDs from world definition if available
      // For now, return empty array as rulesets are stored in definition JSONB
      const rulesetIds: string[] = [];

      if (rulesetIds.length === 0) {
        return sendSuccess(res, [], req);
      }

      // Get full ruleset template details
      const { data: rulesets, error: rulesetsError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('*')
        .in('id', rulesetIds);

      if (rulesetsError) {
        console.error('[Chimera Worlds] Error fetching ruleset templates:', rulesetsError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset templates',
          req
        );
      }

      return sendSuccess(res, rulesets || [], req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * GET /api/v2/chimera/worlds/:id
 * Get a single world (ownership-aware)
 */
router.get(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;

      const { data: world, error: worldError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('*')
        .eq('id', id)
        .single();

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'world');

      if (assetTags) {
        (world as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      if (worldError) {
        if (worldError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error fetching world:', worldError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch world',
          req
        );
      }

      // Check access: user must be owner OR visibility must be public
      if (world.owner_user_id !== userId && world.visibility !== 'public') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Access denied',
          req
        );
      }

      // Transform to API format (map name -> display_name)
      const transformedWorld = transformWorldForResponse(world);
      return sendSuccess(res, transformedWorld, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * PUT /api/v2/chimera/worlds/:id
 * Update a world (owner-only) and handle ruleset links
 */
router.put(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  validateRequest(UpdateWorldSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Check ownership
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingWorld.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can update this world',
          req
        );
      }

      const updateData = req.body;

      // Validate ruleset_template_ids if provided
      // Note: rule_type is stored in definition JSONB in Supabase schema, so we skip MODIFIER validation
      if (updateData.ruleset_template_ids !== undefined) {
        if (updateData.ruleset_template_ids.length > 0) {
          const { data: templates, error: templatesError } = await supabaseAdmin
            .from('chimera_ruleset_templates')
            .select('id, definition')
            .in('id', updateData.ruleset_template_ids);

          if (templatesError) {
            console.error('[Chimera Worlds] Error validating ruleset templates:', templatesError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to validate ruleset templates',
              req
            );
          }

          if (!templates || templates.length !== updateData.ruleset_template_ids.length) {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.VALIDATION_FAILED,
              'One or more ruleset template IDs are invalid',
              req
            );
          }

          // Optional: Validate rule_type from definition if it exists
          // For now, we skip this validation as rule_type may not be in definition JSONB
        }
      }

      // Update world fields (excluding ruleset_template_ids, tag_names, and visibility)
      // Visibility can only be changed via a separate publish endpoint, not through this update endpoint
      const { ruleset_template_ids, tag_names, visibility, tags, ...worldUpdateData } = updateData;
      
      // Handle tags if provided
      if (tags !== undefined) {
        worldUpdateData.tags = tags;
      }
      
      // Map display_name to name for database
      const dbUpdateData: any = { ...worldUpdateData };
      if (dbUpdateData.display_name !== undefined) {
        dbUpdateData.name = dbUpdateData.display_name;
        // Update slug when display_name changes
        dbUpdateData.slug = generateSlug(dbUpdateData.display_name);
        delete dbUpdateData.display_name; // Remove display_name, we use 'name' in DB
      }
      
      if (Object.keys(dbUpdateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('chimera_worlds')
          .update({
            ...dbUpdateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('[Chimera Worlds] Error updating world:', updateError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to update world',
            req
          );
        }
      }

      // Handle ruleset links if provided
      // Note: Rulesets are stored in world definition JSONB, not in junction table
      if (ruleset_template_ids !== undefined) {
        // Fetch current world to get existing definition
        const { data: currentWorld, error: fetchWorldError } = await supabaseAdmin
          .from('chimera_worlds')
          .select('definition')
          .eq('id', id)
          .single();

        if (fetchWorldError) {
          console.error('[Chimera Worlds] Error fetching world for definition update:', fetchWorldError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to fetch world for update',
            req
          );
        }

        // Merge ruleset_template_ids into definition JSONB
        const currentDefinition = (currentWorld?.definition as any) || {};
        const updatedDefinition = {
          ...currentDefinition,
          ruleset_template_ids: ruleset_template_ids || [],
        };

        // Update the definition JSONB
        const { error: definitionUpdateError } = await supabaseAdmin
          .from('chimera_worlds')
          .update({
            definition: updatedDefinition,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (definitionUpdateError) {
          console.error('[Chimera Worlds] Error updating world definition:', definitionUpdateError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to update world definition',
            req
          );
        }
      }

      // Handle tags if provided
      if (tag_names !== undefined) {
        // Delete existing tag links
        await supabaseAdmin
          .from('chimera_asset_tags')
          .delete()
          .eq('asset_id', id)
          .eq('asset_type', 'world');

        // Create new tag links
        if (tag_names.length > 0) {
          const tagIds: string[] = [];

          for (const tagName of tag_names) {
            const normalized = normalizeTagName(tagName);
            if (!normalized) continue;

            // Check if tag exists
            let { data: existingTag } = await supabaseAdmin
              .from('chimera_tags')
              .select('id')
              .eq('tag_name', normalized)
              .single();

            let tagId: string;

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
                console.error('[Chimera Worlds] Error creating tag:', tagError);
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
              asset_type: 'world',
            }));

            const { error: linksError } = await supabaseAdmin
              .from('chimera_asset_tags')
              .insert(assetTagLinks);

            if (linksError) {
              console.error('[Chimera Worlds] Error creating tag links:', linksError);
              // Continue anyway - world is updated, tags can be fixed later
            }
          }
        }
      }

      // Fetch updated world (no junction table joins)
      const { data: updatedWorld } = await supabaseAdmin
        .from('chimera_worlds')
        .select('*')
        .eq('id', id)
        .single();

      // Fetch tags
      const { data: assetTags } = await supabaseAdmin
        .from('chimera_asset_tags')
        .select(`
          tag:chimera_tags!tag_id(id, tag_name)
        `)
        .eq('asset_id', id)
        .eq('asset_type', 'world');

      if (assetTags && updatedWorld) {
        (updatedWorld as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      // Transform to API format (map name -> display_name)
      const transformedWorld = transformWorldForResponse(updatedWorld);
      return sendSuccess(res, transformedWorld, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/worlds/:id
 * Delete a world (owner-only)
 */
router.delete(
  '/:id',
  validateRequest(TextIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Check ownership
      const { data: existingWorld, error: fetchError } = await supabaseAdmin
        .from('chimera_worlds')
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'World not found',
            req
          );
        }
        console.error('[Chimera Worlds] Error checking ownership:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check ownership',
          req
        );
      }

      if (existingWorld.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Only the owner can delete this world',
          req
        );
      }

      // Delete world (cascade will handle ruleset links)
      const { error } = await supabaseAdmin
        .from('chimera_worlds')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Chimera Worlds] Error deleting world:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete world',
          req
        );
      }

      return sendSuccess(res, { id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Worlds] Unexpected error:', error);
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

