/**
 * System Roles Routes
 * Phase 3.7: Backend-for-Frontend (BFF) for Role Management
 * Admin-only endpoints for managing user roles
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.unified.js';
import { validateRequest } from '../middleware/validation.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { rolesService } from '../services/system/roles.service.js';

const router = Router();

// All routes require admin access
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/system/roles
 * List all user roles with filters
 */
const ListRolesQuerySchema = z.object({
  role: z.enum(['creator', 'moderator', 'admin']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  // Support alternative parameter names that might be sent from frontend
  page: z.coerce.number().int().min(1).optional(),
  search: z.string().optional(),
}).passthrough(); // Allow extra fields to prevent validation errors

router.get(
  '/',
  validateRequest({ query: ListRolesQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const filters = {
        role: req.query.role as 'creator' | 'moderator' | 'admin' | undefined,
        q: req.query.q as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        cursor: req.query.cursor as string | undefined
      };

      const result = await rolesService.listRoles(filters);
      return sendSuccess(res, result, req);
    } catch (error) {
      console.error('[System Roles] Error listing roles:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to list roles',
        req
      );
    }
  }
);

/**
 * GET /api/system/roles/stats
 * Get role statistics
 */
router.get(
  '/stats',
  async (req: Request, res: Response) => {
    try {
      const stats = await rolesService.getStats();
      return sendSuccess(res, stats, req);
    } catch (error) {
      console.error('[System Roles] Error fetching stats:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to fetch role stats',
        req
      );
    }
  }
);

/**
 * POST /api/system/roles/:id/assign
 * Assign role to user
 */
const AssignRoleBodySchema = z.object({
  role: z.enum(['creator', 'moderator', 'admin'])
});

const AssignRoleParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/:id/assign',
  validateRequest({
    params: AssignRoleParamsSchema,
    body: AssignRoleBodySchema
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      const updatedRole = await rolesService.updateRole(userId, role);
      return sendSuccess(res, updatedRole, req);
    } catch (error) {
      console.error('[System Roles] Error assigning role:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to assign role',
        req
      );
    }
  }
);

/**
 * POST /api/system/roles/:id/remove
 * Remove role from user (set to 'pending')
 */
const RemoveRoleBodySchema = z.object({
  role: z.enum(['creator', 'moderator', 'admin'])
});

const RemoveRoleParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/:id/remove',
  validateRequest({
    params: RemoveRoleParamsSchema,
    body: RemoveRoleBodySchema
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      // Prevent self-downgrade from admin
      if (req.ctx?.userId === userId && role === 'admin') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          'Cannot remove your own admin role',
          req
        );
      }

      const updatedRole = await rolesService.removeRole(userId, role);
      return sendSuccess(res, updatedRole, req);
    } catch (error) {
      console.error('[System Roles] Error removing role:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to remove role',
        req
      );
    }
  }
);

/**
 * POST /api/system/roles/:id/toggle-verified
 * Toggle verified creator status for a user
 * Allows admins to grant/revoke auto-approval publishing privileges
 */
const ToggleVerifiedBodySchema = z.object({
  is_verified: z.boolean()
});

const ToggleVerifiedParamsSchema = z.object({
  id: z.string().uuid()
});

router.post(
  '/:id/toggle-verified',
  validateRequest({
    params: ToggleVerifiedParamsSchema,
    body: ToggleVerifiedBodySchema
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { is_verified } = req.body;

      const updatedRole = await rolesService.toggleVerifiedStatus(userId, is_verified);
      return sendSuccess(res, updatedRole, req);
    } catch (error) {
      console.error('[System Roles] Error toggling verified status:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to toggle verified status',
        req
      );
    }
  }
);

/**
 * GET /api/system/roles/search
 * Search users by email or ID
 */
const SearchUsersQuerySchema = z.object({
  q: z.string().min(2)
});

router.get(
  '/search',
  validateRequest({ query: SearchUsersQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const results = await rolesService.searchUsers(query);
      return sendSuccess(res, results, req);
    } catch (error) {
      console.error('[System Roles] Error searching users:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Failed to search users',
        req
      );
    }
  }
);

export default router;

