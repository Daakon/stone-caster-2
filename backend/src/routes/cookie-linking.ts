import express from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { validateRequest } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiErrorCode } from '@shared';
import { CookieUserLinkingService } from '../services/cookie-user-linking.service.js';

const router = express.Router();

// Schema for linking cookie to user
const LinkCookieRequestSchema = z.object({
  cookieId: z.string().uuid(),
});

/**
 * @swagger
 * /api/cookie-linking/link:
 *   post:
 *     summary: Link a guest cookie to an authenticated user
 *     description: Links a guest cookie ID to the authenticated user, enabling seamless migration of guest data
 *     tags: [Cookie Linking]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cookieId
 *             properties:
 *               cookieId:
 *                 type: string
 *                 format: uuid
 *                 description: The guest cookie ID to link to the authenticated user
 *           example:
 *             cookieId: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Cookie linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         linked: true
 *                         charactersMigrated: number
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/link',
  requireAuth,
  validateRequest(LinkCookieRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      const { cookieId } = req.body;

      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          'User authentication required',
          req
        );
      }

      // Check if cookie is already linked to another user
      const existingLinkedUserId = await CookieUserLinkingService.getUserIdFromCookie(cookieId);
      if (existingLinkedUserId && existingLinkedUserId !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.CONFLICT,
          'Cookie is already linked to another user',
          req
        );
      }

      // Migrate characters from cookie to user
      const charactersMigrated = await CookieUserLinkingService.migrateCharactersToUser(cookieId, userId);

      // Link the cookie to the user
      const linked = await CookieUserLinkingService.linkCookieToUser(cookieId, userId);

      if (!linked) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to link cookie to user',
          req
        );
      }

      sendSuccess(res, {
        linked: true,
        charactersMigrated,
      }, req);

    } catch (error) {
      console.error('Error linking cookie to user:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to link cookie to user',
        req
      );
    }
  }
);

/**
 * @swagger
 * /api/cookie-linking/check/{cookieId}:
 *   get:
 *     summary: Check if a cookie is linked to a user
 *     description: Checks if a guest cookie ID is linked to an authenticated user
 *     tags: [Cookie Linking]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cookieId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The guest cookie ID to check
 *     responses:
 *       200:
 *         description: Cookie link status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         isLinked: boolean
 *                         userId: string
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/check/:cookieId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { cookieId } = req.params;

      // Validate cookieId is a UUID
      if (!z.string().uuid().safeParse(cookieId).success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid cookie ID format',
          req
        );
      }

      const linkedUserId = await CookieUserLinkingService.getUserIdFromCookie(cookieId);

      sendSuccess(res, {
        isLinked: linkedUserId !== null,
        userId: linkedUserId,
      }, req);

    } catch (error) {
      console.error('Error checking cookie link:', error);
      sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check cookie link',
        req
      );
    }
  }
);

export default router;
