/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Admin
 *     description: Admin-only CRUD endpoints for Chimera ruleset templates
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { supabaseAdmin } from '../services/supabase.js';

const router = Router();

// Admin-only routes - require publisher role (admin)
const requireAdmin = requireRole('publisher');

// Schema for UUID ruleset ID
const RulesetIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Zod schemas for validation
const RuleTypeSchema = z.enum(['MAIN_SYSTEM', 'SUBSYSTEM', 'MODIFIER']);

const CreateRulesetTemplateSchemaBase = z.object({
  display_name: z.string().min(1).max(200),
  description_short: z.string().max(500).optional().nullable(),
  description_long: z.string().optional().nullable(),
  rule_type: RuleTypeSchema,
  main_system_dependency: z.string().uuid().optional().nullable(),
  exclusion_group_id: z.string().uuid().optional().nullable(),
  new_exclusion_group_name: z.string().min(1).max(100).optional().nullable(),
  rule_category: z.string().min(1).max(100),
  definition: z.record(z.unknown()).default({}),
});

const CreateRulesetTemplateSchema = CreateRulesetTemplateSchemaBase.refine(
  (data) => !(data.exclusion_group_id && data.new_exclusion_group_name),
  {
    message: 'Cannot provide both exclusion_group_id and new_exclusion_group_name',
    path: ['exclusion_group_id'],
  }
);

const UpdateRulesetTemplateSchema = CreateRulesetTemplateSchemaBase.partial().refine(
  (data) => !(data.exclusion_group_id && data.new_exclusion_group_name),
  {
    message: 'Cannot provide both exclusion_group_id and new_exclusion_group_name',
    path: ['exclusion_group_id'],
  }
);

// Generate ID (using simple timestamp-based approach, can be replaced with CUID)
function generateId(): string {
  return `chimera_rst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/v2/chimera/admin/rulesets
 * Get all ruleset templates
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Chimera Admin] Error fetching ruleset templates:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset templates',
          req
        );
      }

      // Transform V3 format to V2 format for frontend compatibility
      const transformed = (data || []).map((row: any) => {
        // Check if this is V3 format (has 'key' and 'definition' with RulesetDefinition)
        if (row.key && row.definition && typeof row.definition === 'object') {
          const def = row.definition;
          return {
            id: row.id,
            key: row.key, // Include key for edit link compatibility
            display_name: def.name || row.key,
            description_short: null,
            description_long: null,
            version: 1, // V3 doesn't have version, default to 1
            rule_type: 'MODIFIER' as const, // Default, can be enhanced later
            main_system_dependency: null,
            exclusion_group: row.exclusion_group || def.exclusion_group || null,
            rule_category: row.ui_category || def.ui_category || 'expansion',
            definition: def,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        }
        // Already in V2 format, return as-is (but ensure key is available if missing)
        return {
          ...row,
          key: row.key || row.id, // Use id as fallback for key
        };
      });

      return sendSuccess(res, transformed, req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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
 * GET /api/v2/chimera/admin/rulesets/exclusion-groups
 * Get all exclusion groups (V3: Returns empty array - exclusion_group is now a TEXT column)
 */
router.get(
  '/exclusion-groups',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      // V3: exclusion_group is a TEXT column, not a separate table
      // Return empty array for backward compatibility
      return sendSuccess(res, [], req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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
 * GET /api/v2/chimera/admin/rulesets/:id
 * Get a single ruleset template by ID (UUID) or key
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Try to find by UUID first, then by key (for V3 compatibility)
      let data = null;
      let error = null;

      // Check if it looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isUUID) {
        const result = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('*')
          .eq('id', id)
          .single();
        data = result.data;
        error = result.error;
      }

      // If not found by UUID, try by key (V3 format)
      if (!data && error?.code === 'PGRST116') {
        const result = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('*')
          .eq('key', id)
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Ruleset template not found',
            req
          );
        }
        console.error('[Chimera Admin] Error fetching ruleset template:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch ruleset template',
          req
        );
      }

      // Transform V3 format to V2 format if needed
      if (data && data.key && data.definition && typeof data.definition === 'object') {
        const def = data.definition;
        data = {
          id: data.id,
          display_name: def.name || data.key,
          description_short: null,
          description_long: null,
          version: 1,
          rule_type: 'MODIFIER' as const,
          main_system_dependency: null,
          exclusion_group: data.exclusion_group || def.exclusion_group || null,
          rule_category: data.ui_category || def.ui_category || 'expansion',
          definition: def,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }

      return sendSuccess(res, data, req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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
 * POST /api/v2/chimera/admin/rulesets
 * Create a new ruleset template
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(CreateRulesetTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const templateData = req.body;
      const id = generateId();

      // Validate main_system_dependency if provided
      if (templateData.main_system_dependency) {
        const { data: mainSystem } = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('id, rule_type')
          .eq('id', templateData.main_system_dependency)
          .single();

        if (!mainSystem) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'main_system_dependency references a non-existent template',
            req
          );
        }

        if (mainSystem.rule_type !== 'MAIN_SYSTEM') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'main_system_dependency must reference a MAIN_SYSTEM template',
            req
          );
        }
      }

      // Handle exclusion group: either use existing ID or create new group
      let exclusionGroupId: string | null = null;
      if (templateData.exclusion_group_id) {
        // Validate that the exclusion group exists
        const { data: existingGroup, error: groupError } = await supabaseAdmin
          .from('chimera_exclusion_groups')
          .select('id')
          .eq('id', templateData.exclusion_group_id)
          .single();

        if (groupError || !existingGroup) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'exclusion_group_id references a non-existent group',
            req
          );
        }
        exclusionGroupId = templateData.exclusion_group_id;
      } else if (templateData.new_exclusion_group_name) {
        // Normalize the group name (uppercase, replace spaces with underscores)
        const normalizedName = templateData.new_exclusion_group_name
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '');

        // Check if group already exists
        const { data: existingGroup, error: checkError } = await supabaseAdmin
          .from('chimera_exclusion_groups')
          .select('id')
          .eq('group_name', normalizedName)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Chimera Admin] Error checking exclusion group:', checkError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to check exclusion group',
            req
          );
        }

        if (existingGroup) {
          // Group already exists, use its ID
          exclusionGroupId = existingGroup.id;
        } else {
          // Create new group
          const { data: newGroup, error: createError } = await supabaseAdmin
            .from('chimera_exclusion_groups')
            .insert({
              group_name: normalizedName,
            })
            .select('id')
            .single();

          if (createError || !newGroup) {
            console.error('[Chimera Admin] Error creating exclusion group:', createError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to create exclusion group',
              req
            );
          }
          exclusionGroupId = newGroup.id;
        }
      }

      // Build insert payload, excluding exclusion_group_id and new_exclusion_group_name from templateData
      const { exclusion_group_id, new_exclusion_group_name, ...insertData } = templateData;
      const { data, error } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .insert({
          id,
          ...insertData,
          exclusion_group_id: exclusionGroupId,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        console.error('[Chimera Admin] Error creating ruleset template:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to create ruleset template',
          req
        );
      }

      return sendSuccess(res, data, req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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
 * PUT /api/v2/chimera/admin/rulesets/:id
 * Update an existing ruleset template (increments version)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(RulesetIdParamSchema, 'params'),
  validateRequest(UpdateRulesetTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // First, fetch the current template to get the version
      const { data: currentTemplate, error: fetchError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('version, rule_type')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Ruleset template not found',
            req
          );
        }
        console.error('[Chimera Admin] Error fetching template for update:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch template',
          req
        );
      }

      // Validate main_system_dependency if provided
      if (updateData.main_system_dependency) {
        const { data: mainSystem } = await supabaseAdmin
          .from('chimera_ruleset_templates')
          .select('id, rule_type')
          .eq('id', updateData.main_system_dependency)
          .single();

        if (!mainSystem) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'main_system_dependency references a non-existent template',
            req
          );
        }

        if (mainSystem.rule_type !== 'MAIN_SYSTEM') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.VALIDATION_FAILED,
            'main_system_dependency must reference a MAIN_SYSTEM template',
            req
          );
        }
      }

      // Handle exclusion group: either use existing ID or create new group
      // Priority: check new_exclusion_group_name first, then exclusion_group_id
      let exclusionGroupId: string | null | undefined = undefined;
      if (updateData.new_exclusion_group_name) {
        // Normalize the group name (uppercase, replace spaces with underscores)
        const normalizedName = updateData.new_exclusion_group_name
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '');

        // Check if group already exists
        const { data: existingGroup, error: checkError } = await supabaseAdmin
          .from('chimera_exclusion_groups')
          .select('id')
          .eq('group_name', normalizedName)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('[Chimera Admin] Error checking exclusion group:', checkError);
          return sendErrorWithStatus(
            res,
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to check exclusion group',
            req
          );
        }

        if (existingGroup) {
          // Group already exists, use its ID
          exclusionGroupId = existingGroup.id;
        } else {
          // Create new group
          const { data: newGroup, error: createError } = await supabaseAdmin
            .from('chimera_exclusion_groups')
            .insert({
              group_name: normalizedName,
            })
            .select('id')
            .single();

          if (createError || !newGroup) {
            console.error('[Chimera Admin] Error creating exclusion group:', createError);
            return sendErrorWithStatus(
              res,
              ApiErrorCode.INTERNAL_ERROR,
              'Failed to create exclusion group',
              req
            );
          }
          exclusionGroupId = newGroup.id;
        }
      } else if (updateData.exclusion_group_id !== undefined) {
        // Handle existing exclusion group ID (or null to clear)
        if (updateData.exclusion_group_id === null) {
          exclusionGroupId = null;
        } else {
          // Validate that the exclusion group exists
          const { data: existingGroup, error: groupError } = await supabaseAdmin
            .from('chimera_exclusion_groups')
            .select('id')
            .eq('id', updateData.exclusion_group_id)
            .single();

          if (groupError || !existingGroup) {
            return sendErrorWithStatus(
              res,
              ApiErrorCode.VALIDATION_FAILED,
              'exclusion_group_id references a non-existent group',
              req
            );
          }
          exclusionGroupId = updateData.exclusion_group_id;
        }
      }

      console.log('[Chimera Admin] PUT /:id - Exclusion group handling:', {
        hasNewName: !!updateData.new_exclusion_group_name,
        newName: updateData.new_exclusion_group_name,
        hasId: updateData.exclusion_group_id !== undefined,
        id: updateData.exclusion_group_id,
        resolvedExclusionGroupId: exclusionGroupId,
      });

      // Increment version
      const newVersion = (currentTemplate.version || 1) + 1;

      // Build update payload, excluding exclusion_group_id and new_exclusion_group_name from updateData
      const { exclusion_group_id, new_exclusion_group_name, ...updatePayload } = updateData;
      const finalUpdatePayload: Record<string, unknown> = {
        ...updatePayload,
        version: newVersion,
        updated_at: new Date().toISOString(),
      };

      // Only include exclusion_group_id if it was set (including null to clear it)
      if (exclusionGroupId !== undefined) {
        finalUpdatePayload.exclusion_group_id = exclusionGroupId;
      }

      const { data, error } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .update(finalUpdatePayload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[Chimera Admin] Error updating ruleset template:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to update ruleset template',
          req
        );
      }

      return sendSuccess(res, data, req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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
 * DELETE /api/v2/chimera/admin/rulesets/:id
 * Delete a ruleset template
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(RulesetIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if template exists
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Ruleset template not found',
            req
          );
        }
        console.error('[Chimera Admin] Error checking template existence:', fetchError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check template existence',
          req
        );
      }

      // Delete the template
      const { error } = await supabaseAdmin
        .from('chimera_ruleset_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Chimera Admin] Error deleting ruleset template:', error);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete ruleset template',
          req
        );
      }

      return sendSuccess(res, { id, deleted: true }, req);
    } catch (error) {
      console.error('[Chimera Admin] Unexpected error:', error);
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

