import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { AuthCallbackService } from '../services/authCallback.service.js';
import { ApiErrorCode } from 'shared';

const router = Router();

// Create Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Validation schemas
const MagicLinkStartSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const MagicLinkVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  token: z.string().min(1, 'Token is required'),
  guestCookieId: z.string().uuid('Invalid guest cookie ID'),
});

const OAuthStartSchema = z.object({
  provider: z.enum(['google', 'github', 'discord']),
  guestCookieId: z.string().uuid('Invalid guest cookie ID').optional(),
});

const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  guestCookieId: z.string().uuid('Invalid guest cookie ID'),
});

// POST /api/auth/magic/start - Start Magic Link authentication
router.post('/magic/start', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email } = MagicLinkStartSchema.parse(req.body);

    // Send magic link via Supabase
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${config.frontend.url}/auth/callback`,
      },
    });

    if (error) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to send magic link',
        req
      );
    }

    sendSuccess(res, {
      message: 'Magic link sent successfully',
    }, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }

    console.error('Magic link start error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to start magic link authentication',
      req
    );
  }
});

// POST /api/auth/magic/verify - Verify Magic Link token
router.post('/magic/verify', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email, token, guestCookieId } = MagicLinkVerifySchema.parse(req.body);

    // Verify the magic link token
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'magiclink',
    });

    if (error || !data.user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Invalid or expired token',
        req
      );
    }

    // Link guest device to user account
    const linkResult = await AuthCallbackService.handleAuthCallback({
      userId: data.user.id,
      deviceCookieId: guestCookieId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!linkResult.success) {
      console.error('Guest linking failed:', linkResult.error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to link guest account',
        req
      );
    }

    // Return user data (no secrets)
    sendSuccess(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        isGuest: false,
      },
      message: 'Authentication successful',
    }, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }

    console.error('Magic link verify error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to verify magic link',
      req
    );
  }
});

// GET /api/auth/oauth/:provider/start - Start OAuth flow
router.get('/oauth/:provider/start', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { guestCookieId } = OAuthStartSchema.parse({
      provider,
      guestCookieId: req.query.guestCookieId,
    });

    // Generate state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({
      guestCookieId: guestCookieId || null,
      timestamp: Date.now(),
    })).toString('base64');

    // Get OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github' | 'discord',
      options: {
        redirectTo: `${config.api.url}/api/auth/oauth/${provider}/callback`,
        queryParams: {
          state,
        },
      },
    });

    if (error || !data.url) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to start OAuth flow',
        req
      );
    }

    sendSuccess(res, {
      url: data.url,
      state,
    }, req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }

    console.error('OAuth start error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to start OAuth authentication',
      req
    );
  }
});

// GET /api/auth/oauth/:provider/callback - Handle OAuth callback
router.get('/oauth/:provider/callback', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { code, state } = OAuthCallbackSchema.parse({
      code: req.query.code,
      state: req.query.state,
      guestCookieId: req.query.guestCookieId,
    });

    // Verify state parameter
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.CSRF_TOKEN_INVALID,
        'Invalid state parameter',
        req
      );
    }

    const { guestCookieId } = stateData;

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Failed to authenticate with OAuth provider',
        req
      );
    }

    // Link guest device to user account
    const linkResult = await AuthCallbackService.handleAuthCallback({
      userId: data.user.id,
      deviceCookieId: guestCookieId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    if (!linkResult.success) {
      console.error('Guest linking failed:', linkResult.error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to link guest account',
        req
      );
    }

    // Redirect to frontend with success
    res.redirect(`${config.frontend.url}/auth/success?user=${encodeURIComponent(JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      isGuest: false,
    }))}`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        error.errors
      );
    }

    console.error('OAuth callback error:', error);
    res.redirect(`${config.frontend.url}/auth/error?message=${encodeURIComponent('Authentication failed')}`);
  }
});

// POST /api/auth/logout - Sign out user
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to sign out',
        req
      );
    }

    sendSuccess(res, {
      message: 'Logged out successfully',
    }, req);
  } catch (error) {
    console.error('Logout error:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Failed to sign out',
      req
    );
  }
});

export default router;


