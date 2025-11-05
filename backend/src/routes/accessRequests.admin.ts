/**
 * Admin Access Request Routes
 * Phase B5: Admin endpoints for managing access requests
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import {
  adminListSchema,
  denyRequestSchema,
  approveRequestSchema,
  type AdminListInput,
  type DenyRequestInput,
  type ApproveRequestInput,
} from '../validation/accessRequests.schema.js';
import { supabaseAdmin } from '../services/supabase.js';
import { adminGuard } from '../middleware/auth-admin-guard.js';
import { emailService } from '../services/email.js';
import { getTraceId } from '../utils/response.js';

const router = Router();

/**
 * GET /api/admin/access-requests
 * List access requests with filtering and pagination
 */
router.get('/', adminGuard, async (req: Request, res: Response) => {
  try {
    const validation = adminListSchema.safeParse(req.query);
    if (!validation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req,
        validation.error.errors
      );
    }

    const params: AdminListInput = validation.data;

    // Build query
    let query = supabaseAdmin.from('access_requests').select('*', { count: 'exact' });

    // Filter by status
    if (params.status) {
      query = query.eq('status', params.status);
    }

    // Search by email
    if (params.q) {
      query = query.ilike('email', `%${params.q}%`);
    }

    // Ordering
    query = query.order(params.orderBy, { ascending: params.order === 'asc' });

    // Pagination
    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('[accessRequests.admin] List error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch requests',
        req
      );
    }

    sendSuccess(
      res,
      {
        meta: {
          page: params.page,
          pageSize: params.pageSize,
          total: count || 0,
          hasMore: (count || 0) > params.page * params.pageSize,
          status: params.status,
          q: params.q,
        },
        data: requests || [],
      },
      req
    );
  } catch (error) {
    console.error('[accessRequests.admin] Error:', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch requests', req);
  }
});

/**
 * POST /api/admin/access-requests/:id/approve
 * Approve an access request
 */
router.post('/:id/approve', adminGuard, async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const adminUserId = req.ctx?.userId;

    if (!adminUserId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Admin authentication required', req);
    }

    // Optional note in body
    const bodyValidation = approveRequestSchema.safeParse(req.body);
    const approveNote = bodyValidation.success ? bodyValidation.data.note : undefined;

    // Get request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Request not found', req);
    }

    // Idempotent: if already approved, return success
    if (request.status === 'approved') {
      return sendSuccess(
        res,
        {
          requestId: request.id,
          userId: request.user_id,
          roleUpdated: false,
          roleVersion: null,
        },
        req
      );
    }

    // Cannot approve if already denied (or allow it and record state change)
    if (request.status === 'denied') {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Cannot approve a denied request',
        req
      );
    }

    // Update profile if user_id exists
    let roleUpdated = false;
    let roleVersion: number | null = null;

    if (request.user_id) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role, role_version')
        .eq('id', request.user_id)
        .single();

      if (!profileError && profile) {
        // Update role and increment version
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            role: 'early_access',
            role_version: (profile.role_version || 1) + 1,
          })
          .eq('id', request.user_id);

        if (!updateError) {
          roleUpdated = true;
          roleVersion = (profile.role_version || 1) + 1;
        }
      }
    }

    // Update request status
    const { error: updateError } = await supabaseAdmin
      .from('access_requests')
      .update({
        status: 'approved',
        approved_by: adminUserId,
        approved_at: new Date().toISOString(),
        reason: approveNote || null,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[accessRequests.admin] Approve update error:', updateError);
      return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to approve request', req);
    }

    // Log approval
    console.log(
      JSON.stringify({
        event: 'ar_approve',
        requestId: request.id,
        email: request.email,
        userId: request.user_id,
        roleUpdated,
        roleVersion,
        approvedBy: adminUserId,
        source: 'admin',
        ts: Date.now(),
      })
    );

    // Send email (optional, non-blocking)
    emailService.send(request.email, 'access_approved', {
      email: request.email,
    }).catch((err) => {
      console.error('[accessRequests.admin] Email send error:', err);
    });

    sendSuccess(
      res,
      {
        requestId: request.id,
        userId: request.user_id,
        roleUpdated,
        roleVersion,
      },
      req
    );
  } catch (error) {
    console.error('[accessRequests.admin] Approve error:', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to approve request', req);
  }
});

/**
 * POST /api/admin/access-requests/:id/deny
 * Deny an access request
 */
router.post('/:id/deny', adminGuard, async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const adminUserId = req.ctx?.userId;

    if (!adminUserId) {
      return sendErrorWithStatus(res, ApiErrorCode.UNAUTHORIZED, 'Admin authentication required', req);
    }

    // Validate body
    const bodyValidation = denyRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Reason is required',
        req,
        bodyValidation.error.errors
      );
    }

    const { reason } = bodyValidation.data;

    // Get request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('access_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return sendErrorWithStatus(res, ApiErrorCode.NOT_FOUND, 'Request not found', req);
    }

    // Idempotent: if already denied, return success
    if (request.status === 'denied') {
      return sendSuccess(
        res,
        {
          requestId: request.id,
        },
        req
      );
    }

    // Update request status
    const { error: updateError } = await supabaseAdmin
      .from('access_requests')
      .update({
        status: 'denied',
        reason,
        denied_by: adminUserId,
        denied_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[accessRequests.admin] Deny update error:', updateError);
      return sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to deny request', req);
    }

    // Log denial
    console.log(
      JSON.stringify({
        event: 'ar_deny',
        requestId: request.id,
        email: request.email,
        userId: request.user_id,
        deniedBy: adminUserId,
        reason,
        source: 'admin',
        ts: Date.now(),
      })
    );

    // Send email (optional, non-blocking)
    emailService.send(request.email, 'access_denied', {
      email: request.email,
      reason,
    }).catch((err) => {
      console.error('[accessRequests.admin] Email send error:', err);
    });

    sendSuccess(
      res,
      {
        requestId: request.id,
      },
      req
    );
  } catch (error) {
    console.error('[accessRequests.admin] Deny error:', error);
    sendErrorWithStatus(res, ApiErrorCode.INTERNAL_ERROR, 'Failed to deny request', req);
  }
});

export default router;

