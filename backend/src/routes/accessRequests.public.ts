/**
 * Public Access Request Routes
 * Phase B5: Public endpoints for submitting access requests
 */

import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared/types/api.js';
import { publicRequestSchema, type PublicRequestInput } from '../validation/accessRequests.schema.js';
import { supabaseAdmin } from '../services/supabase.js';
import { accessRequestRateLimiter } from '../lib/rateLimiter.js';
import { getTraceId } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Extract client metadata from request
 */
function extractMetadata(req: Request): Record<string, unknown> {
  return {
    ua: req.headers['user-agent'] || null,
    ip: req.ip || req.socket.remoteAddress || null,
    referer: req.headers.referer || null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * POST /api/request-access
 * Submit an Early Access request
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validation = publicRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        validation.error.errors
      );
    }

    const data: PublicRequestInput = validation.data;

    // Rate limiting: IP + email
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = `${clientIp}:${data.email}`;
    const limit = 5; // 5 requests per hour per IP+email

    if (!accessRequestRateLimiter.check(rateLimitKey, limit)) {
      const resetTime = accessRequestRateLimiter.getResetTime(rateLimitKey);
      
      // Log rate limit event
      console.log(
        JSON.stringify({
          event: 'ar_rate_limited',
          email: data.email,
          ip: clientIp,
          resetIn: resetTime,
          ts: Date.now(),
        })
      );

      return res.status(429).json({
        ok: false,
        code: 'RATE_LIMITED',
        message: `Too many requests. Please try again in ${Math.ceil(resetTime / 60)} minutes.`,
        meta: {
          resetIn: resetTime,
        },
      });
    }

    // Extract user ID if authenticated
    const userId = req.ctx?.userId && !req.ctx.isGuest ? req.ctx.userId : null;

    // Gather metadata
    const meta = extractMetadata(req);

    // Normalize email (lowercase, trim)
    const normalizedEmail = data.email.toLowerCase().trim();

    // Insert request (RLS allows public insert)
    const { data: request, error } = await supabaseAdmin
      .from('access_requests')
      .insert({
        email: normalizedEmail, // Store normalized email
        user_id: userId,
        note: data.note || null,
        meta: {
          ...meta,
          newsletter: data.newsletter || false,
        },
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[accessRequests.public] Insert error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to submit request',
        req
      );
    }

    // Log submission
    console.log(
      JSON.stringify({
        event: 'ar_submit',
        requestId: request.id,
        email: data.email,
        hasUserId: !!userId,
        source: 'public',
        ts: Date.now(),
      })
    );

    // Return success
    sendSuccess(
      res,
      {
        id: request.id,
        status: request.status,
        message: 'Your request has been submitted. We\'ll review it and get back to you.',
      },
      req
    );
  } catch (error) {
    console.error('[accessRequests.public] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to submit request',
      req
    );
  }
});

/**
 * GET /api/request-access/status
 * Get status of user's latest access request
 * Public endpoint - returns null if not authenticated or no request found
 * Checks both user_id (if authenticated) and email (from user profile)
 */
router.get('/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId && !req.ctx.isGuest ? req.ctx.userId : null;
    const userEmail = req.ctx?.user?.email || null;

    // Log for debugging
    console.log('[accessRequests.public] Status check', {
      userId,
      userEmail,
      hasEmail: !!userEmail,
    });

    // If not authenticated, return null (no request)
    if (!userId && !userEmail) {
      console.log('[accessRequests.public] No userId or email, returning null');
      return sendSuccess(res, { request: null }, req);
    }

    // Try to find request by user_id first (if authenticated)
    let requests: any[] = [];
    let error: any = null;

    if (userId) {
      const { data: userIdRequests, error: userIdError } = await supabaseAdmin
        .from('access_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!userIdError && userIdRequests && userIdRequests.length > 0) {
        requests = userIdRequests;
        console.log('[accessRequests.public] Found request by user_id', { userId, requestId: requests[0].id });
      } else {
        console.log('[accessRequests.public] No request found by user_id', { userId, error: userIdError?.message });
      }
    }

    // If no request found by user_id, try by email (handles requests submitted before login)
    if (requests.length === 0 && userEmail) {
      const normalizedEmail = userEmail.toLowerCase().trim();
      console.log('[accessRequests.public] Searching by email', { email: normalizedEmail });
      
      // Try exact match first (using the index on lower(email))
      const { data: emailRequests, error: emailError } = await supabaseAdmin
        .from('access_requests')
        .select('*')
        .eq('email', normalizedEmail) // Use eq for exact match (emails are stored lowercase)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!emailError && emailRequests && emailRequests.length > 0) {
        requests = emailRequests;
        console.log('[accessRequests.public] Found request by email', { 
          email: normalizedEmail, 
          requestId: requests[0].id, 
          status: requests[0].status,
          dbEmail: requests[0].email 
        });
      } else {
        // If exact match fails, try case-insensitive pattern match as fallback
        console.log('[accessRequests.public] Exact email match failed, trying ilike', { 
          email: normalizedEmail, 
          error: emailError?.message 
        });
        
        const { data: emailRequestsIlike, error: emailErrorIlike } = await supabaseAdmin
          .from('access_requests')
          .select('*')
          .ilike('email', normalizedEmail)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!emailErrorIlike && emailRequestsIlike && emailRequestsIlike.length > 0) {
          requests = emailRequestsIlike;
          console.log('[accessRequests.public] Found request by email (ilike)', { 
            email: normalizedEmail, 
            requestId: requests[0].id, 
            status: requests[0].status,
            dbEmail: requests[0].email 
          });
        } else {
          console.log('[accessRequests.public] No request found by email (both eq and ilike failed)', { 
            email: normalizedEmail, 
            eqError: emailError?.message,
            ilikeError: emailErrorIlike?.message 
          });
        }
      }
    }

    // Return the latest request or null
    const request = requests && requests.length > 0 ? requests[0] : null;
    
    if (request) {
      console.log('[accessRequests.public] Returning request', {
        requestId: request.id,
        status: request.status,
        email: request.email,
        userId: request.user_id,
      });
      sendSuccess(res, { request }, req);
    } else {
      // Log detailed info about why no request was found
      console.log('[accessRequests.public] No request found', {
        searchedUserId: userId,
        searchedEmail: userEmail,
        reason: userId 
          ? `No request found for user_id: ${userId} or email: ${userEmail || 'N/A'}`
          : `No request found for email: ${userEmail || 'N/A'}`,
      });
      sendSuccess(res, { 
        request: null,
        // Include helpful debug info in development
        ...(process.env.NODE_ENV === 'development' && {
          _debug: {
            searchedUserId: userId,
            searchedEmail: userEmail,
            message: userId 
              ? `Searched by user_id (${userId}) and email (${userEmail || 'N/A'})`
              : `Searched by email (${userEmail || 'N/A'})`,
          },
        }),
      }, req);
    }
  } catch (error) {
    console.error('[accessRequests.public] Error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to fetch request status',
      req
    );
  }
});

export default router;

