/**
 * Media API Routes
 * Phase 2a: Direct upload endpoint
 * Phase 2b: Finalize upload endpoint
 * Phase 2c: Cover media and gallery link management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { isAdminMediaEnabled } from '../config/featureFlags.js';
import { createDirectUpload, finalizeUpload } from '../services/mediaService.js';
import { MediaKindSchema, SetCoverMediaRequestSchema, CreateMediaLinkRequestSchema, ReorderMediaLinksRequestSchema } from '@shared/types/media.js';
import { CloudflareImagesError } from '../lib/cloudflareImages.js';
import { supabaseAdmin } from '../services/supabase.js';
import { assertCanMutateEntity } from '../services/entityGuard.js';
import { assertMediaOwnershipOrAdmin } from '../services/mediaGuard.js';
import { isAdmin } from '../middleware/auth-admin.js';

const router = Router();

// Debug: Log all requests to media router
router.use((req, res, next) => {
  if (req.path.includes('links')) {
    console.error('[media router] Request to:', req.method, req.path, 'baseUrl:', req.baseUrl, 'originalUrl:', req.originalUrl, 'query:', req.query);
    console.error('[media router] Route stack:', (router as any).stack?.map((r: any) => r.route?.path || r.regexp?.toString()).filter(Boolean));
  }
  next();
});

/**
 * GET /api/media/links - List gallery links
 * Moved to top to ensure it matches before parameterized routes
 */
const ListMediaLinksQuerySchema = z.object({
  kind: MediaKindSchema,
  id: z.string().uuid(),
  include: z.enum(['media']).optional(),
});

router.get('/links', 
  (req, res, next) => {
    console.error('[media/links] MIDDLEWARE 1 - Before auth');
    next();
  },
  authenticateToken,
  (req, res, next) => {
    console.error('[media/links] MIDDLEWARE 2 - After auth, before handler');
    next();
  },
  async (req: Request, res: Response) => {
  console.error('[media/links] ====== HANDLER CALLED ======');
    console.error('========================================');
    console.error('[media/links] HANDLER CALLED - GET /api/media/links');
    console.error('[media/links] Method:', req.method);
    console.error('[media/links] Path:', req.path);
    console.error('[media/links] URL:', req.url);
    console.error('[media/links] Query string:', req.url.split('?')[1]);
    // Debug: Log raw query params
    console.error('[media/links] Raw query params:', JSON.stringify(req.query, null, 2));
    console.error('[media/links] req.query.kind type:', typeof req.query.kind, 'value:', req.query.kind);
    console.error('[media/links] req.query.id type:', typeof req.query.id, 'value:', req.query.id);
    console.error('[media/links] req.query.include type:', typeof req.query.include, 'value:', req.query.include);
    console.error('========================================');
    
    // Extract query params (Express returns strings or string arrays)
    const kind = Array.isArray(req.query.kind) ? String(req.query.kind[0]) : String(req.query.kind || '');
    const id = Array.isArray(req.query.id) ? String(req.query.id[0]) : String(req.query.id || '');
    const include = Array.isArray(req.query.include) ? String(req.query.include[0]) : (req.query.include ? String(req.query.include) : undefined);
    
    console.log('[media/links] Extracted values:', { kind, id, include });
    console.log('[media/links] ID length:', id.length, 'ID char codes:', id.split('').map(c => c.charCodeAt(0)).slice(0, 20));
    
    // Validate
    const validationResult = ListMediaLinksQuerySchema.safeParse({
      kind,
      id,
      ...(include && { include }),
    });
    
    if (!validationResult.success) {
      console.log('[media/links] Validation failed:', JSON.stringify(validationResult.error.errors, null, 2));
      console.log('[media/links] ID that failed validation:', JSON.stringify(id));
      const details = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Request validation failed',
        req,
        { validationErrors: details }
      );
    }
    
    const { kind: validatedKind, id: validatedId, include: validatedInclude } = validationResult.data;
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const kind = validatedKind;
      const id = validatedId;
      const include = validatedInclude;

      // Determine target column
      const targetColumn = kind === 'world' ? 'world_id' : kind === 'story' ? 'story_id' : 'npc_id';

      // Build query
      let query = supabaseAdmin
        .from('media_links')
        .select(`
          id,
          role,
          sort_order,
          media_id,
          ${include === 'media' ? `
          media_assets:media_id (
            id,
            owner_user_id,
            kind,
            provider,
            provider_key,
            visibility,
            status,
            image_review_status,
            width,
            height,
            sha256,
            created_at,
            ready_at,
            content_type
          )
          ` : ''}
        `)
        .eq(targetColumn, id)
        .order('sort_order', { ascending: true });

      const { data: links, error: linksError } = await query;

      if (linksError) {
        throw new Error(`Failed to fetch gallery links: ${linksError.message}`);
      }

      // Transform to DTO format
      const linkDTOs = (links || []).map((link: any) => {
        const media = include === 'media' && link.media_assets ? link.media_assets : null;
        
        // Ensure we're creating plain objects without circular references
        const linkDTO: any = {
          id: String(link.id),
          role: String(link.role),
          sort_order: Number(link.sort_order),
          media_id: link.media_id ? String(link.media_id) : null,
          target: {
            kind: String(kind),
            id: String(id),
          },
        };
        
        if (media) {
          linkDTO.media = {
            id: String(media.id),
            owner_user_id: media.owner_user_id ? String(media.owner_user_id) : null,
            kind: String(media.kind),
            provider: String(media.provider),
            provider_key: String(media.provider_key),
            visibility: String(media.visibility),
            status: String(media.status),
            image_review_status: media.image_review_status ? String(media.image_review_status) : null,
            width: media.width ? Number(media.width) : null,
            height: media.height ? Number(media.height) : null,
            sha256: media.sha256 ? String(media.sha256) : null,
            created_at: media.created_at ? String(media.created_at) : null,
            ready_at: media.ready_at ? String(media.ready_at) : null,
            content_type: media.content_type ? String(media.content_type) : null,
          };
        }
        
        return linkDTO;
      });

      return sendSuccess(res, { items: linkDTOs }, req);
    } catch (error) {
      console.error('Error fetching gallery links:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to fetch gallery links',
        req
      );
    }
  }
);

/**
 * POST /api/media/uploads
 * Request a direct upload URL for Cloudflare Images
 * Creates a pending media_assets row
 */
const CreateUploadRequestSchema = z.object({
  kind: MediaKindSchema,
});

router.post(
  '/uploads',
  authenticateToken,
  validateRequest(CreateUploadRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    // Check feature flag
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { kind } = req.body;

      const result = await createDirectUpload({
        userId,
        kind,
        req, // Pass request for admin check
      });

      return sendSuccess(res, result, req);
    } catch (error) {
      console.error('Error creating direct upload:', error);

      // Handle Cloudflare API errors
      if (error instanceof CloudflareImagesError) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          `Cloudflare Images error: ${error.message}`,
          req
        );
      }

      // Handle other errors
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to create upload URL',
        req
      );
    }
  }
);

/**
 * GET /api/media/:id
 * Get a single media asset by ID
 * Phase 3b: Integration endpoint for fetching cover media
 */
const MediaIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.get(
  '/:id',
  authenticateToken,
  validateRequest(MediaIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id } = req.params;

      const { data: media, error: mediaError } = await supabaseAdmin
        .from('media_assets')
        .select('*')
        .eq('id', id)
        .single();

      if (mediaError || !media) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Media asset not found',
          req
        );
      }

      // Check permissions: owner or public visibility can view
      const isOwner = media.owner_user_id === userId;
      const isPublic = media.visibility === 'public';
      
      if (!isOwner && !isPublic) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Access denied',
          req
        );
      }

      // Transform to DTO (handle date types)
      const mediaDTO = {
        id: media.id,
        owner_user_id: media.owner_user_id,
        kind: media.kind,
        provider: media.provider,
        provider_key: media.provider_key,
        visibility: media.visibility,
        status: media.status,
        image_review_status: media.image_review_status,
        width: media.width,
        height: media.height,
        sha256: media.sha256,
        created_at: typeof media.created_at === 'string' ? media.created_at : media.created_at.toISOString(),
        ready_at: media.ready_at ? (typeof media.ready_at === 'string' ? media.ready_at : media.ready_at.toISOString()) : null,
        content_type: media.content_type || null,
      };

      return sendSuccess(res, mediaDTO, req);
    } catch (error) {
      console.error('Error fetching media asset:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to fetch media asset',
        req
      );
    }
  }
);

/**
 * PATCH /api/media/:id
 * Update a media asset (e.g., provider_key after upload)
 */
const UpdateMediaParamsSchema = z.object({
  id: z.string().uuid(),
});

const UpdateMediaBodySchema = z.object({
  provider_key: z.string().uuid().optional(),
}).strict();

router.patch(
  '/:id',
  authenticateToken,
  validateRequest(UpdateMediaParamsSchema, 'params'),
  validateRequest(UpdateMediaBodySchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: mediaId } = req.params;
      const { provider_key } = req.body;

      // Load media asset
      const { data: media, error: fetchError } = await supabaseAdmin
        .from('media_assets')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (fetchError || !media) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Media asset not found',
          req
        );
      }

      // Check ownership
      if (media.owner_user_id !== userId) {
        // Check if user is admin
        const admin = await isAdmin(req);
        if (!admin) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            'You do not own this media asset',
            req
          );
        }
      }

      // Update provider_key if provided
      const updateData: { provider_key?: string } = {};
      if (provider_key) {
        updateData.provider_key = provider_key;
      }

      if (Object.keys(updateData).length === 0) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.BAD_REQUEST,
          'No fields to update',
          req
        );
      }

      const { data: updatedMedia, error: updateError } = await supabaseAdmin
        .from('media_assets')
        .update(updateData)
        .eq('id', mediaId)
        .select()
        .single();

      if (updateError || !updatedMedia) {
        throw new Error(`Failed to update media asset: ${updateError?.message || 'Unknown error'}`);
      }

      const mediaDTO = {
        id: updatedMedia.id,
        owner_user_id: updatedMedia.owner_user_id,
        kind: updatedMedia.kind,
        provider: updatedMedia.provider,
        provider_key: updatedMedia.provider_key,
        visibility: updatedMedia.visibility,
        status: updatedMedia.status,
        image_review_status: updatedMedia.image_review_status,
        width: updatedMedia.width,
        height: updatedMedia.height,
        sha256: updatedMedia.sha256,
        created_at: typeof updatedMedia.created_at === 'string' ? updatedMedia.created_at : updatedMedia.created_at.toISOString(),
        ready_at: updatedMedia.ready_at ? (typeof updatedMedia.ready_at === 'string' ? updatedMedia.ready_at : updatedMedia.ready_at.toISOString()) : null,
        content_type: updatedMedia.content_type || null,
      };

      return sendSuccess(res, { media: mediaDTO }, req);
    } catch (error) {
      console.error('Error updating media asset:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to update media asset',
        req
      );
    }
  }
);

/**
 * POST /api/media/:id/finalize
 * Finalize an uploaded image by fetching metadata from Cloudflare
 * Updates width, height, status='ready', ready_at
 */
const FinalizeUploadParamsSchema = z.object({
  id: z.string().uuid(),
});

const FinalizeUploadBodySchema = z.object({
  provider_key: z.string().uuid().optional(),
}).strict();

router.post(
  '/:id/finalize',
  authenticateToken,
  validateRequest(FinalizeUploadParamsSchema, 'params'),
  validateRequest(FinalizeUploadBodySchema, 'body'),
  async (req: Request, res: Response) => {
    // Check feature flag
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: mediaId } = req.params;
      const { provider_key } = req.body;

      const media = await finalizeUpload({
        mediaId,
        currentUserId: userId,
        req, // Pass request for admin check
        provider_key, // Pass final image ID from upload response if provided
      });

      return sendSuccess(res, { media }, req);
    } catch (error) {
      console.error('Error finalizing upload:', error);

      // Handle not found or forbidden
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            error.message,
            req
          );
        }
        if (error.message.includes('Forbidden')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            error.message,
            req
          );
        }
      }

      // Handle Cloudflare API errors with 502
      if (error instanceof CloudflareImagesError) {
        return res.status(502).json({
          ok: false,
          error: {
            code: ApiErrorCode.INTERNAL_ERROR,
            message: `Cloudflare Images error: ${error.message}`,
          },
          meta: {
            traceId: req.headers['x-trace-id'] || 'unknown',
          },
        });
      }

      // Handle other errors
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to finalize upload',
        req
      );
    }
  }
);

/**
 * Phase 2c: Cover Media Routes
 */

/**
 * PATCH /api/worlds/:id/cover-media
 * Set or clear cover image for a world
 */
const WorldIdParamSchema = z.object({
  id: z.string(),
});

router.patch(
  '/worlds/:id/cover-media',
  authenticateToken,
  validateRequest(WorldIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: worldId } = req.params;
      const { mediaId } = req.body;

      // Load world
      const { data: world, error: worldError } = await supabaseAdmin
        .from('worlds')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', worldId)
        .single();

      if (worldError || !world) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'World not found',
          req
        );
      }

      // Check permissions (returns 403 if found but not allowed)
      try {
        await assertCanMutateEntity({
          entity: world,
          userId,
          req,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Forbidden')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            error.message,
            req
          );
        }
        throw error;
      }

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedWorld, error: updateError } = await supabaseAdmin
        .from('worlds')
        .update({ cover_media_id: mediaId })
        .eq('id', worldId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedWorld) {
        throw new Error(`Failed to update world: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { world: updatedWorld }, req);
    } catch (error) {
      console.error('Error setting world cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

/**
 * PATCH /api/stories/:id/cover-media
 * Set or clear cover image for a story (entry_point)
 */
router.patch(
  '/stories/:id/cover-media',
  authenticateToken,
  validateRequest(WorldIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: storyId } = req.params;
      const { mediaId } = req.body;

      // Load story (entry_point)
      const { data: story, error: storyError } = await supabaseAdmin
        .from('entry_points')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', storyId)
        .single();

      if (storyError || !story) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Story not found',
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity: story,
        userId,
        req,
      });

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedStory, error: updateError } = await supabaseAdmin
        .from('entry_points')
        .update({ cover_media_id: mediaId })
        .eq('id', storyId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedStory) {
        throw new Error(`Failed to update story: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { story: updatedStory }, req);
    } catch (error) {
      console.error('Error setting story cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

/**
 * PATCH /api/npcs/:id/cover-media
 * Set or clear cover image for an NPC
 */
const NpcIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.patch(
  '/npcs/:id/cover-media',
  authenticateToken,
  validateRequest(NpcIdParamSchema, 'params'),
  validateRequest(SetCoverMediaRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { id: npcId } = req.params;
      const { mediaId } = req.body;

      // Load NPC
      const { data: npc, error: npcError } = await supabaseAdmin
        .from('npcs')
        .select('id, owner_user_id, publish_status, cover_media_id')
        .eq('id', npcId)
        .single();

      if (npcError || !npc) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'NPC not found',
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity: npc,
        userId,
        req,
      });

      // If mediaId provided, load and verify ownership
      if (mediaId) {
        const { data: media, error: mediaError } = await supabaseAdmin
          .from('media_assets')
          .select('id, owner_user_id, status')
          .eq('id', mediaId)
          .single();

        if (mediaError || !media) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            'Media asset not found',
            req
          );
        }

        // Check media ownership
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      }

      // Update cover_media_id
      const { data: updatedNpc, error: updateError } = await supabaseAdmin
        .from('npcs')
        .update({ cover_media_id: mediaId })
        .eq('id', npcId)
        .select('id, owner_user_id, publish_status, cover_media_id')
        .single();

      if (updateError || !updatedNpc) {
        throw new Error(`Failed to update NPC: ${updateError?.message || 'Unknown error'}`);
      }

      return sendSuccess(res, { npc: updatedNpc }, req);
    } catch (error) {
      console.error('Error setting NPC cover media:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to set cover media',
        req
      );
    }
  }
);

/**
 * Phase 2c: Gallery Link Routes
 * Note: GET /api/media/links is defined at the top of the file (line 43)
 * to ensure it matches before parameterized routes
 */

/**
 * POST /api/media/links
 * Create a gallery link
 */
router.post(
  '/links',
  authenticateToken,
  validateRequest(CreateMediaLinkRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { target, mediaId, role = 'gallery', sortOrder = 0 } = req.body;

      // Load entity based on target kind
      let entity: any;
      let entityError: any;

      if (target.kind === 'world') {
        const result = await supabaseAdmin
          .from('worlds')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (target.kind === 'story') {
        const result = await supabaseAdmin
          .from('entry_points')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (target.kind === 'npc') {
        const result = await supabaseAdmin
          .from('npcs')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.BAD_REQUEST,
          'Invalid target kind',
          req
        );
      }

      if (entityError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          `${target.kind} not found`,
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity,
        userId,
        req,
      });

      // Load media and verify ownership
      const { data: media, error: mediaError } = await supabaseAdmin
        .from('media_assets')
        .select('id, owner_user_id, status')
        .eq('id', mediaId)
        .single();

      if (mediaError || !media) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Media asset not found',
          req
        );
      }

      try {
        await assertMediaOwnershipOrAdmin({
          media,
          userId,
          req,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Forbidden')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            error.message,
            req
          );
        }
        throw error;
      }

      // Insert link with typed column
      const linkData: any = {
        media_id: mediaId,
        role,
        sort_order: sortOrder,
      };

      if (target.kind === 'world') {
        linkData.world_id = target.id;
      } else if (target.kind === 'story') {
        linkData.story_id = target.id;
      } else if (target.kind === 'npc') {
        linkData.npc_id = target.id;
      }

      const { data: link, error: insertError } = await supabaseAdmin
        .from('media_links')
        .insert(linkData)
        .select('id, world_id, story_id, npc_id, media_id, role, sort_order')
        .single();

      if (insertError) {
        // Check for unique constraint violation (duplicate link)
        if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.CONFLICT,
            'This media is already linked to this entity',
            req
          );
        }
        throw new Error(`Failed to create link: ${insertError.message}`);
      }

      if (!link) {
        throw new Error('Link created but not returned');
      }

      // Build response DTO
      const linkDTO = {
        id: link.id,
        role: link.role,
        sort_order: link.sort_order,
        media_id: link.media_id,
        target: {
          kind: target.kind,
          id: link.world_id || link.story_id || link.npc_id || '',
        },
      };

      return sendSuccess(res, { link: linkDTO }, req);
    } catch (error) {
      console.error('Error creating media link:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to create link',
        req
      );
    }
  }
);

/**
 * DELETE /api/media/links/:linkId
 * Delete a gallery link
 */
const LinkIdParamSchema = z.object({
  linkId: z.string().uuid(),
});

router.delete(
  '/links/:linkId',
  authenticateToken,
  validateRequest(LinkIdParamSchema, 'params'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { linkId } = req.params;

      // Load link
      const { data: link, error: linkError } = await supabaseAdmin
        .from('media_links')
        .select('id, world_id, story_id, npc_id')
        .eq('id', linkId)
        .single();

      if (linkError || !link) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Link not found',
          req
        );
      }

      // Resolve target entity
      let entity: any;
      let entityError: any;

      if (link.world_id) {
        const result = await supabaseAdmin
          .from('worlds')
          .select('id, owner_user_id, publish_status')
          .eq('id', link.world_id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (link.story_id) {
        const result = await supabaseAdmin
          .from('entry_points')
          .select('id, owner_user_id, publish_status')
          .eq('id', link.story_id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (link.npc_id) {
        const result = await supabaseAdmin
          .from('npcs')
          .select('id, owner_user_id, publish_status')
          .eq('id', link.npc_id)
          .single();
        entity = result.data;
        entityError = result.error;
      }

      if (entityError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Target entity not found',
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity,
        userId,
        req,
      });

      // Delete link
      const { error: deleteError } = await supabaseAdmin
        .from('media_links')
        .delete()
        .eq('id', linkId);

      if (deleteError) {
        throw new Error(`Failed to delete link: ${deleteError.message}`);
      }

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting media link:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to delete link',
        req
      );
    }
  }
);

/**
 * PATCH /api/media/links/reorder
 * Reorder gallery links for a target entity
 */
router.patch(
  '/links/reorder',
  authenticateToken,
  validateRequest(ReorderMediaLinksRequestSchema, 'body'),
  async (req: Request, res: Response) => {
    if (!isAdminMediaEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Media upload feature is not enabled',
        req
      );
    }

    try {
      const userId = req.ctx?.userId || req.user?.id;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      const { target, orders } = req.body;

      // Load entity
      let entity: any;
      let entityError: any;

      if (target.kind === 'world') {
        const result = await supabaseAdmin
          .from('worlds')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (target.kind === 'story') {
        const result = await supabaseAdmin
          .from('entry_points')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else if (target.kind === 'npc') {
        const result = await supabaseAdmin
          .from('npcs')
          .select('id, owner_user_id, publish_status')
          .eq('id', target.id)
          .single();
        entity = result.data;
        entityError = result.error;
      } else {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.BAD_REQUEST,
          'Invalid target kind',
          req
        );
      }

      if (entityError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          `${target.kind} not found`,
          req
        );
      }

      // Check permissions
      await assertCanMutateEntity({
        entity,
        userId,
        req,
      });

      // Load all links for this target to verify they belong to it
      const linkIds = orders.map((o: { linkId: string }) => o.linkId);
      const targetColumn = target.kind === 'world' ? 'world_id' : target.kind === 'story' ? 'story_id' : 'npc_id';

      const { data: existingLinks, error: linksError } = await supabaseAdmin
        .from('media_links')
        .select('id, world_id, story_id, npc_id')
        .in('id', linkIds);

      if (linksError || !existingLinks || existingLinks.length !== linkIds.length) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.BAD_REQUEST,
          'Some links not found',
          req
        );
      }

      // Verify all links belong to the specified target
      for (const link of existingLinks) {
        const linkTargetId = link.world_id || link.story_id || link.npc_id;
        if (linkTargetId !== target.id) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.BAD_REQUEST,
            'Links must belong to the specified target',
            req
          );
        }
      }

      // Update sort_order for all links atomically using RPC function
      const linkOrders = orders.map((order: { linkId: string; sortOrder: number }) => ({
        linkId: order.linkId,
        sortOrder: order.sortOrder,
      }));

      const { error: rpcError } = await supabaseAdmin.rpc('reorder_media_links', {
        p_link_orders: linkOrders,
        p_target_kind: target.kind,
        p_target_id: target.id,
        p_user_id: userId,
      });

      if (rpcError) {
        throw new Error(`Failed to reorder links: ${rpcError.message}`);
      }

      return sendSuccess(res, { ok: true }, req);
    } catch (error) {
      console.error('Error reordering media links:', error);

      if (error instanceof Error && error.message.includes('Forbidden')) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          error.message,
          req
        );
      }

      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to reorder links',
        req
      );
    }
  }
);

export default router;

