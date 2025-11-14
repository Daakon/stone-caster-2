/**
 * User Authoring Routes
 * Phase 8: User-facing creation and submit-for-publish endpoints
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { z } from 'zod';
import { supabaseAdmin } from '../services/supabase.js';
import { assertUserWithinQuota, USER_QUOTAS, getUserQuotaStatus } from '../services/quotaService.js';
import { checkMediaPreflight } from '../services/mediaPreflight.js';
import { checkDependencies, validateRequiredFields } from '../services/publishingPreflightHelpers.js';

const router = Router();

/**
 * GET /api/worlds
 * List user's worlds with quota info
 */
router.get('/worlds', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Fetch user's worlds
    // Refinement: Sort by publish_status (Draft first, then In Review, Published, Rejected), then updated_at DESC
    const { data: worlds, error } = await supabaseAdmin
      .from('worlds')
      .select('*')
      .eq('owner_user_id', userId)
      .order('updated_at', { ascending: false }); // Primary sort by updated_at DESC

    if (error) {
      throw error;
    }

    // Sort in memory to ensure correct publish_status order (Supabase doesn't support CASE in order)
    const sortedWorlds = (worlds || []).sort((a, b) => {
      const statusOrder: Record<string, number> = {
        draft: 1,
        in_review: 2,
        published: 3,
        rejected: 4,
      };
      const aStatus = (a.publish_status || 'draft') as string;
      const bStatus = (b.publish_status || 'draft') as string;
      const aOrder = statusOrder[aStatus] || 99;
      const bOrder = statusOrder[bStatus] || 99;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      // If same status, keep updated_at DESC order (already sorted)
      return 0;
    });

    // Get quota status
    const quotaStatus = await getUserQuotaStatus(userId, USER_QUOTAS);
    const worldQuota = quotaStatus.find(q => q.type === 'world') || {
      type: 'world' as const,
      limit: USER_QUOTAS.worlds,
      current: 0,
      remaining: USER_QUOTAS.worlds,
    };

    sendSuccess(
      res,
      {
        items: sortedWorlds,
        total: sortedWorlds.length,
        quotas: {
          limit: worldQuota.limit,
          used: worldQuota.current,
          remaining: worldQuota.remaining,
        },
      },
      req
    );
  } catch (error: any) {
    console.error('[user-authoring] Error listing worlds:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to list worlds',
      req,
      error.message
    );
  }
});

/**
 * GET /api/stories
 * List user's stories with quota info
 */
router.get('/stories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Fetch user's stories with cover media
    // Refinement: Sort by publish_status (Draft first, then In Review, Published, Rejected), then updated_at DESC
    // Include cover_media join - for user's own stories, show cover even if not public
    const { data: stories, error } = await supabaseAdmin
      .from('entry_points')
      .select(`
        *,
        cover_media:cover_media_id (
          id,
          provider_key,
          status,
          image_review_status,
          visibility
        )
      `)
      .eq('owner_user_id', userId)
      .order('updated_at', { ascending: false }); // Primary sort by updated_at DESC

    if (error) {
      throw error;
    }

    // Transform stories to include cover_media in consistent format
    // For user's own stories, show cover if it exists and is ready (even if not public)
    const transformedStories = (stories || []).map((story: any) => {
      const coverMedia = story.cover_media && 
        typeof story.cover_media === 'object' &&
        story.cover_media.status === 'ready' &&
        story.cover_media.image_review_status === 'approved'
        ? {
            id: story.cover_media.id,
            provider_key: story.cover_media.provider_key,
          }
        : null;
      
      // Remove the nested cover_media and add the transformed version
      const { cover_media, ...restStory } = story;
      return {
        ...restStory,
        cover_media: coverMedia,
      };
    });

    // Sort in memory to ensure correct publish_status order
    const sortedStories = transformedStories.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        draft: 1,
        in_review: 2,
        published: 3,
        rejected: 4,
      };
      const aStatus = (a.publish_status || 'draft') as string;
      const bStatus = (b.publish_status || 'draft') as string;
      const aOrder = statusOrder[aStatus] || 99;
      const bOrder = statusOrder[bStatus] || 99;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return 0;
    });

    // Get quota status
    const quotaStatus = await getUserQuotaStatus(userId, USER_QUOTAS);
    const storyQuota = quotaStatus.find(q => q.type === 'story') || {
      type: 'story' as const,
      limit: USER_QUOTAS.stories,
      current: 0,
      remaining: USER_QUOTAS.stories,
    };

    sendSuccess(
      res,
      {
        items: sortedStories,
        total: sortedStories.length,
        quotas: {
          limit: storyQuota.limit,
          used: storyQuota.current,
          remaining: storyQuota.remaining,
        },
      },
      req
    );
  } catch (error: any) {
    console.error('[user-authoring] Error listing stories:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to list stories',
      req,
      error.message
    );
  }
});

/**
 * GET /api/npcs
 * List user's NPCs with quota info
 */
router.get('/npcs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Fetch user's NPCs
    // Refinement: Sort by publish_status (Draft first, then In Review, Published, Rejected), then updated_at DESC
    const { data: npcs, error } = await supabaseAdmin
      .from('npcs')
      .select('*')
      .eq('owner_user_id', userId)
      .order('updated_at', { ascending: false }); // Primary sort by updated_at DESC

    // Sort in memory to ensure correct publish_status order
    const sortedNpcs = (npcs || []).sort((a, b) => {
      const statusOrder: Record<string, number> = {
        draft: 1,
        in_review: 2,
        published: 3,
        rejected: 4,
      };
      const aStatus = (a.publish_status || 'draft') as string;
      const bStatus = (b.publish_status || 'draft') as string;
      const aOrder = statusOrder[aStatus] || 99;
      const bOrder = statusOrder[bStatus] || 99;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return 0;
    });

    if (error) {
      throw error;
    }

    // Get quota status
    const quotaStatus = await getUserQuotaStatus(userId, USER_QUOTAS);
    const npcQuota = quotaStatus.find(q => q.type === 'npc') || {
      type: 'npc' as const,
      limit: USER_QUOTAS.npcs,
      current: 0,
      remaining: USER_QUOTAS.npcs,
    };

    sendSuccess(
      res,
      {
        items: sortedNpcs,
        total: sortedNpcs.length,
        quotas: {
          limit: npcQuota.limit,
          used: npcQuota.current,
          remaining: npcQuota.remaining,
        },
      },
      req
    );
  } catch (error: any) {
    console.error('[user-authoring] Error listing NPCs:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to list NPCs',
      req,
      error.message
    );
  }
});

const CreateWorldSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  doc: z.record(z.unknown()).optional(),
});

const CreateStorySchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  world_id: z.string().uuid(),
  rulesetIds: z.array(z.string().uuid()).min(1),
  type: z.enum(['story']),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'public']).default('private'),
  content_rating: z.string().optional(),
});

const CreateNPCSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  world_id: z.string().uuid().optional(),
  doc: z.record(z.unknown()).optional(),
});

/**
 * POST /api/worlds
 * Create a new world (user-facing)
 */
router.post('/worlds', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    const body = CreateWorldSchema.safeParse(req.body);
    if (!body.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request body',
        req,
        body.error.errors
      );
    }

    // Phase 8: Check quota (refinement: use constant)
    try {
      await assertUserWithinQuota(userId, { worlds: USER_QUOTAS.worlds });
    } catch (quotaError: any) {
      return sendErrorWithStatus(
        res,
        quotaError.code || ApiErrorCode.QUOTA_EXCEEDED,
        quotaError.message || 'Quota exceeded',
        req,
        quotaError.details,
        422
      );
    }

    // Generate IDs
    const worldId = crypto.randomUUID();
    const uuidId = crypto.randomUUID();
    const slug = body.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Insert world
    const { data: result, error } = await supabaseAdmin
      .from('worlds')
      .insert({
        id: worldId,
        name: body.data.name,
        slug,
        description: body.data.description || null,
        status: 'draft',
        version: 1,
        doc: body.data.doc || {},
        visibility: 'private',
        review_state: 'draft',
        owner_user_id: userId,
        publish_status: 'draft',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create mapping
    await supabaseAdmin.from('world_id_mapping').insert({
      text_id: worldId,
      uuid_id: uuidId,
    });

    sendSuccess(res, result, req, 201);
  } catch (error: any) {
    console.error('[user-authoring] Error creating world:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create world',
      req,
      error.message
    );
  }
});

/**
 * POST /api/stories
 * Create a new story (user-facing)
 */
router.post('/stories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    const body = CreateStorySchema.safeParse(req.body);
    if (!body.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request body',
        req,
        body.error.errors
      );
    }

    // Phase 8: Check quota (refinement: use constant)
    try {
      await assertUserWithinQuota(userId, { stories: USER_QUOTAS.stories });
    } catch (quotaError: any) {
      return sendErrorWithStatus(
        res,
        quotaError.code || ApiErrorCode.QUOTA_EXCEEDED,
        quotaError.message || 'Quota exceeded',
        req,
        quotaError.details,
        422
      );
    }

    // Resolve world_id
    let resolvedWorldId = body.data.world_id;
    if (body.data.world_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: mapping } = await supabaseAdmin
        .from('world_id_mapping')
        .select('text_id')
        .eq('uuid_id', body.data.world_id)
        .single();

      if (mapping) {
        resolvedWorldId = mapping.text_id;
      }
    }

    const slug = body.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Insert entry point
    const { data: entryPoint, error: insertError } = await supabaseAdmin
      .from('entry_points')
      .insert({
        id: body.data.name,
        name: body.data.name,
        slug,
        type: body.data.type,
        world_id: resolvedWorldId,
        title: body.data.title,
        description: body.data.description,
        tags: body.data.tags || [],
        visibility: body.data.visibility || 'private',
        content_rating: body.data.content_rating || null,
        lifecycle: 'draft',
        owner_user_id: userId,
        publish_status: 'draft',
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Create ruleset associations
    if (body.data.rulesetIds.length > 0) {
      const associations = body.data.rulesetIds.map((id, idx) => ({
        entry_point_id: entryPoint.id,
        ruleset_id: id,
        sort_order: idx,
      }));

      const { error: rulesetError } = await supabaseAdmin
        .from('entry_point_rulesets')
        .insert(associations);

      if (rulesetError) {
        await supabaseAdmin.from('entry_points').delete().eq('id', entryPoint.id);
        throw rulesetError;
      }
    }

    sendSuccess(res, entryPoint, req, 201);
  } catch (error: any) {
    console.error('[user-authoring] Error creating story:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create story',
      req,
      error.message
    );
  }
});

/**
 * POST /api/npcs
 * Create a new NPC (user-facing)
 */
router.post('/npcs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    const body = CreateNPCSchema.safeParse(req.body);
    if (!body.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request body',
        req,
        body.error.errors
      );
    }

    // Phase 8: Check quota (refinement: use constant)
    try {
      await assertUserWithinQuota(userId, { npcs: USER_QUOTAS.npcs });
    } catch (quotaError: any) {
      return sendErrorWithStatus(
        res,
        quotaError.code || ApiErrorCode.QUOTA_EXCEEDED,
        quotaError.message || 'Quota exceeded',
        req,
        quotaError.details,
        422
      );
    }

    const slug = body.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data: result, error } = await supabaseAdmin
      .from('npcs')
      .insert({
        name: body.data.name,
        slug,
        description: body.data.description || null,
        status: 'draft',
        visibility: 'private',
        review_state: 'draft',
        owner_user_id: userId,
        publish_status: 'draft',
        world_id: body.data.world_id || null,
        doc: body.data.doc || { npc: {} },
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    sendSuccess(res, result, req, 201);
  } catch (error: any) {
    console.error('[user-authoring] Error creating NPC:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to create NPC',
      req,
      error.message
    );
  }
});

/**
 * POST /api/worlds/:id/submit-for-publish
 * Submit a world for publish review
 */
router.post('/worlds/:id/submit-for-publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Verify ownership and status
    const { data: world, error: fetchError } = await supabaseAdmin
      .from('worlds')
      .select('id, owner_user_id, publish_status, name, description')
      .eq('id', id)
      .single();

    if (fetchError || !world) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'World not found', req);
    }

    if (world.owner_user_id !== userId) {
      return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not own this world', req);
    }

    // Refinement: Standardize error codes with consistent response shape
    if (world.publish_status === 'in_review') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_IN_REVIEW,
        'World is already in review',
        req,
        {
          code: 'ALREADY_IN_REVIEW',
          message: 'World is already in review',
          details: { currentStatus: world.publish_status },
        },
        409
      );
    }

    if (world.publish_status === 'published') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_PUBLISHED,
        'World is already published',
        req,
        {
          code: 'ALREADY_PUBLISHED',
          message: 'World is already published',
          details: { currentStatus: world.publish_status },
        },
        409
      );
    }

    if (world.publish_status !== 'draft' && world.publish_status !== 'rejected') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Only draft or rejected worlds can be submitted for publish',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'Only draft or rejected worlds can be submitted for publish',
          details: { currentStatus: world.publish_status },
        },
        422
      );
    }

    // Light preflight: required fields
    if (!world.name || !world.description) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'World must have name and description before submitting',
        req,
        { missingFields: [!world.name && 'name', !world.description && 'description'].filter(Boolean) },
        422
      );
    }

    // Media preflight (optional for worlds, but check if cover is set)
    const mediaPreflight = await checkMediaPreflight({ type: 'world', id });
    if (!mediaPreflight.ok && mediaPreflight.errors) {
      // For MVP, we allow worlds without cover, but warn
      // In future, we might require cover
    }

    // Update status to in_review
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('worlds')
      .update({ publish_status: 'in_review' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    sendSuccess(res, { world: updated, submitted: true }, req);
  } catch (error: any) {
    console.error('[user-authoring] Error submitting world for publish:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to submit world for publish',
      req,
      error.message
    );
  }
});

/**
 * POST /api/stories/:id/submit-for-publish
 * Submit a story for publish review
 */
router.post('/stories/:id/submit-for-publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Verify ownership and status
    const { data: story, error: fetchError } = await supabaseAdmin
      .from('entry_points')
      .select('id, owner_user_id, publish_status, title, description, world_id')
      .eq('id', id)
      .single();

    if (fetchError || !story) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Story not found', req);
    }

    if (story.owner_user_id !== userId) {
      return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not own this story', req);
    }

    // Refinement: Standardize error codes
    if (story.publish_status === 'in_review') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_IN_REVIEW,
        'Story is already in review',
        req,
        { code: 'ALREADY_IN_REVIEW', currentStatus: story.publish_status },
        409
      );
    }

    if (story.publish_status === 'published') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_PUBLISHED,
        'Story is already published',
        req,
        { code: 'ALREADY_PUBLISHED', currentStatus: story.publish_status },
        409
      );
    }

    if (story.publish_status !== 'draft' && story.publish_status !== 'rejected') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Only draft or rejected stories can be submitted for publish',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'Only draft or rejected stories can be submitted for publish',
          details: { currentStatus: story.publish_status },
        },
        422
      );
    }

    // Refinement: Reuse shared preflight helpers
    const fieldValidation = await validateRequiredFields({ type: 'story', id });
    if (fieldValidation.fieldsMissing.length > 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Story must have required fields before submitting',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'Story must have required fields before submitting',
          details: { fieldsMissing: fieldValidation.fieldsMissing },
        },
        422
      );
    }

    // Check dependencies (world must be published)
    const dependencyCheck = await checkDependencies({ type: 'story', id });
    if (dependencyCheck.missingWorld || !dependencyCheck.worldPublished) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Story must be assigned to a published world',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'Story must be assigned to a published world',
          details: { dependencyErrors: dependencyCheck.invalidRefs },
        },
        422
      );
    }

    // Media preflight: require cover for stories
    const mediaPreflight = await checkMediaPreflight({ type: 'story', id });
    if (!mediaPreflight.ok && mediaPreflight.errors) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        mediaPreflight.errors[0].message,
        req,
        {
          code: 'VALIDATION_FAILED',
          message: mediaPreflight.errors[0].message,
          details: { mediaErrors: mediaPreflight.errors },
        },
        422
      );
    }

    // Update status to in_review
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('entry_points')
      .update({ publish_status: 'in_review' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    sendSuccess(res, { story: updated, submitted: true }, req);
  } catch (error: any) {
    console.error('[user-authoring] Error submitting story for publish:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to submit story for publish',
      req,
      error.message
    );
  }
});

/**
 * POST /api/npcs/:id/submit-for-publish
 * Submit an NPC for publish review
 */
router.post('/npcs/:id/submit-for-publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Authentication required', req);
    }

    // Verify ownership and status
    const { data: npc, error: fetchError } = await supabaseAdmin
      .from('npcs')
      .select('id, owner_user_id, publish_status, name')
      .eq('id', id)
      .single();

    if (fetchError || !npc) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'NPC not found', req);
    }

    if (npc.owner_user_id !== userId) {
      return sendErrorWithStatus(res, ApiErrorCode.FORBIDDEN, 'You do not own this NPC', req);
    }

    // Refinement: Standardize error codes
    if (npc.publish_status === 'in_review') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_IN_REVIEW,
        'NPC is already in review',
        req,
        { code: 'ALREADY_IN_REVIEW', currentStatus: npc.publish_status },
        409
      );
    }

    if (npc.publish_status === 'published') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.ALREADY_PUBLISHED,
        'NPC is already published',
        req,
        { code: 'ALREADY_PUBLISHED', currentStatus: npc.publish_status },
        409
      );
    }

    if (npc.publish_status !== 'draft' && npc.publish_status !== 'rejected') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Only draft or rejected NPCs can be submitted for publish',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'Only draft or rejected NPCs can be submitted for publish',
          details: { currentStatus: npc.publish_status },
        },
        422
      );
    }

    // Refinement: Reuse shared preflight helpers
    const fieldValidation = await validateRequiredFields({ type: 'npc', id });
    if (fieldValidation.fieldsMissing.length > 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'NPC must have required fields before submitting',
        req,
        {
          code: 'VALIDATION_FAILED',
          message: 'NPC must have required fields before submitting',
          details: { fieldsMissing: fieldValidation.fieldsMissing },
        },
        422
      );
    }

    // Check dependencies (world must be published if set)
    if (npc.world_id) {
      const dependencyCheck = await checkDependencies({ type: 'npc', id });
      if (dependencyCheck.missingWorld || !dependencyCheck.worldPublished) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'NPC must be assigned to a published world',
          req,
          {
            code: 'VALIDATION_FAILED',
            message: 'NPC must be assigned to a published world',
            details: { dependencyErrors: dependencyCheck.invalidRefs },
          },
          422
        );
      }
    }

    // Media preflight (optional for NPCs)
    const mediaPreflight = await checkMediaPreflight({ type: 'npc', id });
    if (!mediaPreflight.ok && mediaPreflight.errors) {
      // For MVP, we allow NPCs without cover, but warn
    }

    // Update status to in_review
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('npcs')
      .update({ publish_status: 'in_review' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    sendSuccess(res, { npc: updated, submitted: true }, req);
  } catch (error: any) {
    console.error('[user-authoring] Error submitting NPC for publish:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to submit NPC for publish',
      req,
      error.message
    );
  }
});

export default router;

