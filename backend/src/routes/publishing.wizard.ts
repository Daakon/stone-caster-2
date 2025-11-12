/**
 * Publishing Wizard Routes
 * Phase 7: Status endpoint for wizard page
 * Phase 8: Sessions and rollout gating
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  isPublishingWizardEnabled,
  isPublishingWizardSessionsEnabled,
  isPublishingWizardRolloutEnabled,
} from '../config/featureFlags.js';
import { isWizardAllowed } from '../config/publishingWizard.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { PublishableTypeSchema } from '@shared/types/publishing.js';
import { authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { getLatestFindings } from '../dal/publishingQuality.js';
import { emitPublishingEvent } from '../telemetry/publishingTelemetry.js';

const router = Router();

/**
 * GET /api/publishing/wizard/status/:type/:id
 * Phase 7: Get combined status for wizard page
 */
router.get(
  '/status/:type/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    if (!isPublishingWizardEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Publishing wizard is not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid type. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id. Must be a valid UUID',
          req,
          idResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const userId = req.user?.id;
      const userEmail = (req.user as any)?.email; // Optional email for allowlist matching

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Phase 8: Rollout gating
      if (isPublishingWizardRolloutEnabled()) {
        const allowed = isWizardAllowed(userId, userEmail);
        if (!allowed) {
          // Emit telemetry for blocked access
          emitPublishingEvent('wizard.rollout.blocked', {
            type,
            id,
            userId,
          });

          return sendSuccess(
            res,
            {
              type,
              id,
              allowed: false,
              dependency_invalid: false,
              preflight_score: null,
              review_state: 'draft',
              visibility: 'private',
            },
            req
          );
        }
      }

      // Map type to table name
      const tableName = type === 'story' ? 'entry_points' : `${type}s`;

      // Fetch entity
      const selectFields = type === 'story'
        ? 'id, title, name, world_id, dependency_invalid, visibility, review_state, owner_user_id'
        : type === 'npc'
        ? 'id, name, world_id, dependency_invalid, visibility, review_state, owner_user_id'
        : 'id, name, visibility, review_state, owner_user_id';

      const { data: entity, error: fetchError } = await supabaseAdmin
        .from(tableName)
        .select(selectFields)
        .eq('id', id)
        .single();

      if (fetchError || !entity) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          `${type} not found`,
          req
        );
      }

      // Verify ownership
      if (entity.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not own this content',
          req
        );
      }

      // Get dependency status
      let dependencyInvalid = false;
      let parentWorld: { visibility: string; review_state: string } | undefined;

      if (type === 'story' || type === 'npc') {
        dependencyInvalid = (entity as any).dependency_invalid || false;
        const worldId = (entity as any).world_id;

        if (worldId) {
          const { data: world } = await supabaseAdmin
            .from('worlds')
            .select('visibility, review_state')
            .eq('id', worldId)
            .single();

          if (world) {
            parentWorld = {
              visibility: world.visibility,
              review_state: world.review_state,
            };
          }
        }
      }

      // Get latest preflight score (only if quality gates are enabled)
      let preflightScore: number | null = null;
      try {
        const { isPublishingQualityGatesEnabled } = await import('../config/featureFlags.js');
        if (isPublishingQualityGatesEnabled()) {
          const findings = await getLatestFindings({ type, id, kind: 'preflight' });
          if (findings) {
            preflightScore = findings.score;
          }
        }
      } catch (error) {
        // Non-fatal, just leave score as null
        console.error('[wizard] Failed to get preflight findings:', error);
      }

      // Phase 8: Load saved session if sessions are enabled
      let savedStep: string | null = null;
      let savedData: Record<string, any> = {};
      if (isPublishingWizardSessionsEnabled()) {
        try {
          const { data: session } = await supabaseAdmin
            .from('publishing_wizard_sessions')
            .select('step, data')
            .eq('user_id', userId)
            .eq('entity_type', type)
            .eq('entity_id', id)
            .single();

          if (session) {
            savedStep = session.step;
            savedData = session.data || {};
          }
        } catch (error) {
          // Non-fatal, continue without session data
          console.warn('[wizard] Failed to load session:', error);
        }
      }

      // Emit telemetry for wizard opened
      emitPublishingEvent('wizard.opened', {
        type,
        id,
        userId,
      });

      sendSuccess(
        res,
        {
          type,
          id,
          allowed: true,
          dependency_invalid: dependencyInvalid,
          preflight_score: preflightScore,
          review_state: entity.review_state || 'draft',
          visibility: entity.visibility || 'private',
          parent_world: parentWorld,
          // Phase 8: Include session data if available
          ...(savedStep ? { step: savedStep, data: savedData } : {}),
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Wizard status error:', error);

      if (error.code) {
        return sendErrorWithStatus(
          res,
          error.code,
          error.message || 'Failed to get wizard status',
          req
        );
      }

      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to get wizard status',
        req
      );
    }
  }
);

/**
 * POST /api/publishing/wizard/session/:type/:id
 * Phase 8: Save wizard session state
 */
const SessionSaveSchema = z.object({
  step: z.enum(['dependencies', 'preflight', 'submit']),
  data: z.record(z.any()).default({}),
});

router.post(
  '/session/:type/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    if (!isPublishingWizardEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Publishing wizard is not enabled',
        req,
        undefined,
        501
      );
    }

    if (!isPublishingWizardSessionsEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Wizard sessions are not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid type. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id. Must be a valid UUID',
          req,
          idResult.error.errors
        );
      }

      const bodyResult = SessionSaveSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request body',
          req,
          bodyResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const userId = req.user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Verify ownership
      const tableName = type === 'story' ? 'entry_points' : `${type}s`;
      const { data: entity } = await supabaseAdmin
        .from(tableName)
        .select('owner_user_id')
        .eq('id', id)
        .single();

      if (!entity || entity.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'You do not own this content',
          req
        );
      }

      // Upsert session
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('publishing_wizard_sessions')
        .upsert(
          {
            user_id: userId,
            entity_type: type,
            entity_id: id,
            step: bodyResult.data.step,
            data: bodyResult.data.data,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,entity_type,entity_id',
          }
        )
        .select()
        .single();

      if (sessionError) {
        console.error('[wizard] Failed to save session:', sessionError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to save session',
          req
        );
      }

      // Emit telemetry
      emitPublishingEvent('wizard.session.saved', {
        type,
        id,
        userId,
        step: bodyResult.data.step,
      });

      sendSuccess(
        res,
        {
          step: session.step,
          data: session.data,
          updated_at: session.updated_at,
        },
        req
      );
    } catch (error: any) {
      console.error('[publishing] Wizard session save error:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to save session',
        req
      );
    }
  }
);

/**
 * DELETE /api/publishing/wizard/session/:type/:id
 * Phase 8: Clear wizard session
 */
router.delete(
  '/session/:type/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    if (!isPublishingWizardEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Publishing wizard is not enabled',
        req,
        undefined,
        501
      );
    }

    if (!isPublishingWizardSessionsEnabled()) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.PUBLISH_REQUEST_DISABLED,
        'Wizard sessions are not enabled',
        req,
        undefined,
        501
      );
    }

    try {
      const typeResult = PublishableTypeSchema.safeParse(req.params.type);
      if (!typeResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          `Invalid type. Must be one of: world, story, npc`,
          req,
          typeResult.error.errors
        );
      }

      const idResult = z.string().uuid().safeParse(req.params.id);
      if (!idResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid id. Must be a valid UUID',
          req,
          idResult.error.errors
        );
      }

      const type = typeResult.data;
      const id = idResult.data;
      const userId = req.user?.id;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'Authentication required',
          req
        );
      }

      // Delete session
      const { error: deleteError } = await supabaseAdmin
        .from('publishing_wizard_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('entity_type', type)
        .eq('entity_id', id);

      if (deleteError) {
        console.error('[wizard] Failed to delete session:', deleteError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to delete session',
          req
        );
      }

      // Emit telemetry
      emitPublishingEvent('wizard.session.cleared', {
        type,
        id,
        userId,
      });

      sendSuccess(res, { deleted: true }, req);
    } catch (error: any) {
      console.error('[publishing] Wizard session delete error:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to delete session',
        req
      );
    }
  }
);

export default router;

