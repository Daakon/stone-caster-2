import { Router, type Request, type Response } from 'express';
import { sendSuccess, sendErrorWithStatus, getTraceId } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/validation.js';
import { ApiErrorCode, CreateGameRequestSchema, IdParamSchema, GameTurnRequestSchema, SessionTurnsResponseSchema, GetTurnsQuerySchema } from '@shared';
import { GamesService } from '../services/games.service.js';
import { turnsService } from '../services/turns.service.js';
// Legacy promptsService import removed - v3 assembler used instead
import { supabaseAdmin } from '../services/supabase.js';
import { z } from 'zod';

const router = Router();

type OwnershipContext = {
  ownerId?: string;
  isGuestOwner: boolean;
  guestCookieId?: string;
};

const extractGuestCookieId = (req: Request, fallback?: string): string | undefined => {
  const headerValue = req.headers['x-guest-cookie-id'];
  const headerCandidate = Array.isArray(headerValue)
    ? headerValue.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : typeof headerValue === 'string'
      ? headerValue.trim()
      : undefined;

  const cookieJar = req.cookies as Record<string, string | undefined> | undefined;
  const cookieCandidate = cookieJar?.guestId ?? cookieJar?.guest_id;
  const normalizedCookie = typeof cookieCandidate === 'string' ? cookieCandidate.trim() : undefined;
  const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : undefined;

  if (headerCandidate) {
    return headerCandidate;
  }

  if (normalizedCookie) {
    return normalizedCookie;
  }

  if (normalizedFallback) {
    return normalizedFallback;
  }

  return undefined;
};

const resolveOwnershipContext = (req: Request, userId?: string, isGuest?: boolean): OwnershipContext => {
  const guestCookieId = extractGuestCookieId(req, isGuest ? userId : undefined);

  if (userId && !isGuest) {
    return { ownerId: userId, isGuestOwner: false, guestCookieId };
  }

  if (isGuest && userId) {
    return { ownerId: userId, isGuestOwner: true, guestCookieId: guestCookieId ?? userId };
  }

  if (guestCookieId) {
    return { ownerId: guestCookieId, isGuestOwner: true, guestCookieId };
  }

  return { ownerId: undefined, isGuestOwner: false, guestCookieId: undefined };
};

// POST /api/games - spawn a new game
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    let userId = req.ctx?.userId;
    let isGuest = req.ctx?.isGuest;

    // If no user context, create a guest user
    if (!userId) {
      // Generate a new guest ID
      const { v4: uuidv4 } = await import('uuid');
      userId = uuidv4();
      isGuest = true;
      
      // Set the guest cookie in the response
      res.cookie('guestId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
    }

    // Validate request body
    const validationResult = CreateGameRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      // Return standardized error envelope with field errors
      const fieldErrors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid request data',
          details: {
            fieldErrors,
          },
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    const validatedData = validationResult.data;

    const gamesService = new GamesService();

    // Phase 3: Check if new format fields are present
    if (validatedData.entry_point_id && validatedData.world_id && validatedData.entry_start_slug) {
      // Extract idempotency key from header or body
      const idempotencyKey = req.headers['idempotency-key'] as string || validatedData.idempotency_key;

      // Check if debug response is allowed
      const { isDebugEnabledForUser, getUserRole, buildDebugPayload } = await import('../utils/debugResponse.js');
      const userRole = await getUserRole(req);
      const debugAllowed = userRole ? isDebugEnabledForUser(req, userRole) : false;
      const assembleStartTime = Date.now();

      // Use new Phase 3 spawn method
      const spawnResult = await gamesService.spawnV3({
        entry_point_id: validatedData.entry_point_id,
        world_id: validatedData.world_id,
        entry_start_slug: validatedData.entry_start_slug,
        scenario_slug: validatedData.scenario_slug,
        ruleset_slug: validatedData.ruleset_slug,
        model: validatedData.model,
        characterId: validatedData.characterId,
        ownerId: userId,
        isGuest: isGuest || false,
        idempotency_key: idempotencyKey,
        req, // Pass request for test transaction access
        includeAssemblerMetadata: debugAllowed, // Include assembler metadata if debug allowed
      });

      const assembleEndTime = Date.now();

      if (!spawnResult.success) {
        // Map error codes to standardized codes
        const errorCode = spawnResult.code || 'INTERNAL_ERROR';
        const httpStatus = spawnResult.error || ApiErrorCode.INTERNAL_ERROR;
        
        // Return standardized error envelope
        return res.status(
          httpStatus === ApiErrorCode.VALIDATION_FAILED ? 400 :
          httpStatus === ApiErrorCode.NOT_FOUND ? 404 :
          httpStatus === ApiErrorCode.CONFLICT ? 409 :
          httpStatus === ApiErrorCode.UNAUTHORIZED ? 401 :
          500
        ).json({
          ok: false,
          error: {
            code: errorCode,
            message: spawnResult.message || 'Failed to spawn game',
          },
          meta: {
            traceId: getTraceId(req),
          },
        });
      }

      // Check if debug is requested
      const wantsDebug = debugAllowed && (req.query.debug === '1' || req.headers['x-debug'] === '1');
      
      // Set cache headers
      if (wantsDebug) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'private, max-age=30');
      }
      
      // Build response
      const response: any = {
        ok: true,
        data: {
          game_id: spawnResult.game_id,
          first_turn: spawnResult.first_turn,
        },
        meta: {
          traceId: getTraceId(req),
        },
      };

      // Add debug payload if allowed and assembler metadata is available
      if (debugAllowed && spawnResult.assemblerMetadata && wantsDebug) {
        // Check if full mode is requested (via debugDepth query param)
        const debugDepth = req.query.debugDepth === 'full';

        const debugPayload = buildDebugPayload({
          gameId: spawnResult.game_id,
          turnNumber: spawnResult.first_turn?.turn_number || 1,
          phase: 'start',
          assembler: spawnResult.assemblerMetadata,
          timings: {
            assembleMs: assembleEndTime - assembleStartTime,
          },
          includeAiRaw: debugDepth, // Only include AI raw if debugDepth=full
        });

        response.debug = debugPayload;

        // Log debug response
        console.log(JSON.stringify({
          event: 'debug.response',
          phase: 'start',
          gameId: spawnResult.game_id,
          tokenPct: spawnResult.assemblerMetadata.meta.tokenEst?.pct || 0,
          policy: spawnResult.assemblerMetadata.meta.policy || [],
        }));

        // Set Cache-Control: no-store when debug is present
        res.setHeader('Cache-Control', 'no-store');
      }

      // Return Phase 3 response format (exact spec)
      return res.status(201).json(response);
    }

    // Legacy: fallback to old spawn method
    if (!validatedData.adventureSlug) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Either adventureSlug (legacy) or entry_point_id + world_id + entry_start_slug (Phase 3) must be provided',
        req
      );
    }

    const spawnResult = await gamesService.spawn({
      adventureSlug: validatedData.adventureSlug,
      characterId: validatedData.characterId,
      ownerId: userId,
      isGuest: isGuest || false,
    });

    if (!spawnResult.success) {
      return sendErrorWithStatus(
        res,
        spawnResult.error || ApiErrorCode.INTERNAL_ERROR,
        spawnResult.message || 'Failed to spawn game',
        req
      );
    }

    sendSuccess(res, spawnResult.game, req, 201);
  } catch (error) {
    console.error('Error spawning game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games/:id - fetch a single game
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    // Allow both authenticated users and guests
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
        req
      );
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;

    // Get the game
    const gamesService = new GamesService();
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;
    const game = await gamesService.getGameById(
      gameId,
      ownerId,
      ownership.isGuestOwner,
      ownership.guestCookieId
    );

    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    sendSuccess(res, game, req);
  } catch (error) {
    console.error('Error fetching game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games - list user's games (authenticated only)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Get games list
    const gamesService = new GamesService();
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;
    const games = await gamesService.getGames(
      ownerId,
      ownership.isGuestOwner,
      limit,
      offset,
      ownership.guestCookieId
    );

    sendSuccess(res, games, req);
  } catch (error) {
    console.error('Error fetching games list:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/turn - take a turn in a game
router.post('/:id/turn', optionalAuth, requireIdempotencyKey, async (req: Request, res: Response) => {
  try {
    let userId = req.ctx?.userId;
    let isGuest = req.ctx?.isGuest;

    // If no user context, create a guest user
    if (!userId) {
      // Generate a new guest ID
      const { v4: uuidv4 } = await import('uuid');
      userId = uuidv4();
      isGuest = true;
      
      // Set the guest cookie in the response
      res.cookie('guestId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    // Validate request body
    const bodyValidation = GameTurnRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        bodyValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;
    const { optionId, userInput, userInputType } = bodyValidation.data;
    const idempotencyKey = req.headers['idempotency-key'] as string;
    const ownership = resolveOwnershipContext(req, userId, isGuest);
    const ownerId = ownership.ownerId ?? userId;

    if (!ownerId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
        req
      );
    }

    // Execute the turn
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId,
      owner: ownerId,
      idempotencyKey,
      isGuest: ownership.isGuestOwner,
      userInput,
      userInputType,
    });

    if (!turnResult.success) {
      return sendErrorWithStatus(
        res,
        turnResult.error || ApiErrorCode.INTERNAL_ERROR,
        turnResult.message || 'Failed to execute turn',
        req
      );
    }

    // Phase 8: Standardize response format
    // Response: { ok: true, data: { turn: { turn_number, role, content, meta, created_at } } }
    // Fetch the actual turn record from database to get standardized format
    const gamesService = new GamesService();
    const game = await gamesService.getGameById(gameId, ownerId, ownership.isGuestOwner, ownership.guestCookieId);
    
    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found after turn creation',
        req
      );
    }

    // Fetch the most recent turn (the one we just created)
    const turnsResult = await gamesService.getGameTurns(gameId, { limit: 1 });
    const latestTurn = turnsResult.turns && turnsResult.turns.length > 0 
      ? turnsResult.turns[turnsResult.turns.length - 1] 
      : null;

    if (!latestTurn) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Turn was created but could not be retrieved',
        req
      );
    }

    // Extract content from turn record (could be in narrative_summary, ai_response.narrative, or content field)
    const turnContent = latestTurn.narrative_summary 
      || (latestTurn.ai_response && typeof latestTurn.ai_response === 'object' 
          ? ((latestTurn.ai_response as any).narrative || '')
          : '')
      || ((latestTurn as any).content || '')
      || '';

    const standardizedTurn = {
      turn_number: latestTurn.turn_number || 0,
      role: latestTurn.role || 'narrator',
      content: turnContent,
      meta: latestTurn.meta || {},
      created_at: latestTurn.created_at || new Date().toISOString(),
    };

    return res.json({
      ok: true,
      data: {
        turn: standardizedTurn,
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('Error executing turn:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// Phase 8: POST /api/games/:id/send-turn - Simple message-based send turn endpoint
import { SendTurnRequestSchema } from '@shared/types/api.js';
import { rateLimitSendTurn } from '../middleware/rateLimit.js';

router.post('/:id/send-turn', optionalAuth, rateLimitSendTurn, async (req: Request, res: Response) => {
  try {
    let userId = req.ctx?.userId;
    let isGuest = req.ctx?.isGuest;

    // If no user context, create a guest user
    if (!userId) {
      const { v4: uuidv4 } = await import('uuid');
      userId = uuidv4();
      isGuest = true;
      res.cookie('guestId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid game ID',
          details: paramValidation.error.errors,
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Validate request body
    const bodyValidation = SendTurnRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        ok: false,
        error: {
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Invalid request data',
          details: bodyValidation.error.errors,
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    const { id: gameId } = paramValidation.data;
    const { message, model, temperature } = bodyValidation.data;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.headers['idempotency-key'] as string;
    
    // Phase 8: Log turn.in event
    console.log(JSON.stringify({
      event: 'turn.in',
      len: message.length,
      gameId,
    }));

    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;

    if (!ownerId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'User context required',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Generate optionId for text-based turn (not choice-based)
    const { v4: uuidv4 } = await import('uuid');
    const optionId = uuidv4(); // Text turn doesn't use a real option

    // Check if debug response is allowed
    const { isDebugEnabledForUser, getUserRole, buildDebugPayload } = await import('../utils/debugResponse.js');
    const userRole = await getUserRole(req);
    const debugAllowed = userRole ? isDebugEnabledForUser(req, userRole) : false;

    // Execute the turn with message as userInput
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId,
      owner: ownerId,
      idempotencyKey: idempotencyKey || uuidv4(), // Generate if not provided
      isGuest: ownership.isGuestOwner,
      userInput: message,
      userInputType: 'text',
      includeDebugMetadata: debugAllowed, // Include debug metadata if debug allowed
    });

    if (!turnResult.success) {
      // Map error codes to HTTP status codes
      let statusCode = 500;
      if (turnResult.error === ApiErrorCode.NOT_FOUND) {
        statusCode = 404;
      } else if (turnResult.error === 'RATE_LIMITED' || String(turnResult.error) === 'RATE_LIMITED') {
        statusCode = 429;
      } else if (turnResult.error === ApiErrorCode.VALIDATION_FAILED) {
        statusCode = 400;
      } else if (turnResult.error === ApiErrorCode.UNAUTHORIZED) {
        statusCode = 401;
      }
      
      return res.status(statusCode).json({
        ok: false,
        error: {
          code: (turnResult.error as any) || ApiErrorCode.INTERNAL_ERROR,
          message: turnResult.message || 'Failed to execute turn',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Phase 8: Standardize response format
    // Fetch the actual turn record from database to get standardized format
    // Note: ownership and ownerId already defined above at line 520-521
    const gamesService = new GamesService();
    const game = await gamesService.getGameById(gameId, ownerId, ownership.isGuestOwner, ownership.guestCookieId);
    
    if (!game) {
      return res.status(404).json({
        ok: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Game not found after turn creation',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Fetch the most recent turn (the one we just created)
    const turnsResult = await gamesService.getGameTurns(gameId, { limit: 1 });
    const latestTurn = turnsResult.turns && turnsResult.turns.length > 0 
      ? turnsResult.turns[turnsResult.turns.length - 1] 
      : null;

    if (!latestTurn) {
      return res.status(500).json({
        ok: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Turn was created but could not be retrieved',
        },
        meta: {
          traceId: getTraceId(req),
        },
      });
    }

    // Extract content from turn record (could be in narrative_summary, ai_response.narrative, or content field)
    const turnContent = latestTurn.narrative_summary 
      || (latestTurn.ai_response && typeof latestTurn.ai_response === 'object' 
          ? ((latestTurn.ai_response as any).narrative || '')
          : '')
      || ((latestTurn as any).content || '')
      || '';

    const standardizedTurn = {
      turn_number: latestTurn.turn_number || 0,
      role: latestTurn.role || 'narrator',
      content: turnContent,
      meta: latestTurn.meta || {},
      created_at: latestTurn.created_at || new Date().toISOString(),
    };

    // Phase 8: Log turn.out event
    const meta = standardizedTurn.meta as any;
    console.log(JSON.stringify({
      event: 'turn.out',
      tokenPct: meta?.tokenEst?.pct || 0,
      policy: meta?.policy || [],
      gameId,
      turnNumber: standardizedTurn.turn_number,
    }));

    // Build response
    const response: any = {
      ok: true,
      data: {
        turn: standardizedTurn,
      },
      meta: {
        traceId: getTraceId(req),
      },
    };

    // Add debug payload if allowed and debug metadata is available
    if (debugAllowed && turnResult.debugMetadata) {
      // Determine debugId from latest turn
      const latestTurn = await gamesService.getGameTurns(gameId, { limit: 1 });
      const narratorTurn = latestTurn.turns?.find(t => t.role === 'narrator') || latestTurn.turns?.[latestTurn.turns.length - 1];
      const debugId = narratorTurn?.id 
        ? `${gameId}:${narratorTurn.turn_number || standardizedTurn.turn_number}`
        : `${gameId}:${standardizedTurn.turn_number}`;

      // Check if full mode is requested (via debugDepth query param)
      const debugDepth = req.query.debugDepth === 'full';

      const debugPayload = buildDebugPayload({
        debugId,
        phase: 'turn',
        assembler: turnResult.debugMetadata.assembler,
        ai: turnResult.debugMetadata.ai,
        timings: turnResult.debugMetadata.timings,
        includeAiRaw: debugDepth, // Only include AI raw if debugDepth=full
      });

      response.debug = debugPayload;

      // Log debug response
      console.log(JSON.stringify({
        event: 'debug.response',
        phase: 'turn',
        gameId,
        tokenPct: turnResult.debugMetadata.assembler.meta.tokenEst?.pct || 0,
        policy: turnResult.debugMetadata.assembler.meta.policy || [],
      }));

      // Set Cache-Control: no-store when debug is present
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.json(response);
  } catch (error) {
    console.error('Error in send-turn:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
      meta: {
        traceId: getTraceId(req),
      },
    });
  }
});

// GET /api/games/:id/turns - get turns for a game with pagination
router.get('/:id/turns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
        req
      );
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    // Validate query parameters
    const queryValidation = GetTurnsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid query parameters',
        req,
        queryValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;
    const { afterTurn, limit } = queryValidation.data;

    // Get the game to validate ownership
    const gamesService = new GamesService();
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;
    const game = await gamesService.getGameById(
      gameId,
      ownerId,
      ownership.isGuestOwner,
      ownership.guestCookieId
    );

    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    // Load turns from database with pagination
    const result = await gamesService.getGameTurns(gameId, {
      afterTurn,
      limit,
    });

    // Phase 5.1: Normalized turns API contract - single source of truth
    // Response shape: { ok: true, data: turns[], next?: { afterTurn }, meta }
    const responseData = result.turns;
    return res.json({
      ok: true,
      data: responseData,
      ...(result.next ? { next: result.next } : {}),
      meta: {
        traceId: getTraceId(req),
      },
    });
  } catch (error) {
    console.error('Error loading game turns:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games/:id/session-turns - get session turns with narrative data for offline play
router.get('/:id/session-turns', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
        req
      );
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;

    // Get the game to validate ownership
    const gamesService = new GamesService();
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;
    const game = await gamesService.getGameById(
      gameId,
      ownerId,
      ownership.isGuestOwner,
      ownership.guestCookieId
    );

    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    // Load session turns and initialize narrative
    const [turns, initializeNarrative] = await Promise.all([
      gamesService.getSessionTurns(gameId),
      gamesService.getInitializeNarrative(gameId)
    ]);

    const response = {
      turns,
      initialize_narrative: initializeNarrative
    };

    // Validate response structure
    const validationResult = SessionTurnsResponseSchema.safeParse(response);
    if (!validationResult.success) {
      console.error('Session turns response validation failed:', validationResult.error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Invalid response structure',
        req
      );
    }

    sendSuccess(res, validationResult.data, req);
  } catch (error) {
    console.error('Error loading session turns:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/auto-initialize - automatically create initial prompt for games with 0 turns
router.post('/:id/auto-initialize', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    const isGuest = req.ctx?.isGuest;

    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'User context required',
        req
      );
    }

    // Validate game ID parameter
    const paramValidation = IdParamSchema.safeParse(req.params);
    if (!paramValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid game ID',
        req,
        paramValidation.error.errors
      );
    }

    const { id: gameId } = paramValidation.data;

    // Get the game to validate ownership and get world info
    const gamesService = new GamesService();
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;
    const game = await gamesService.getGameById(
      gameId,
      ownerId,
      ownership.isGuestOwner,
      ownership.guestCookieId
    );

    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    // Only auto-initialize games with 0 turns
    if (game.turnCount > 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Game has already been initialized',
        req
      );
    }

    // Double-check by querying turns table directly to prevent race conditions
    const { data: existingTurns, error: turnsError } = await supabaseAdmin
      .from('turns')
      .select('id, turn_number, role, created_at')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: true });

    if (turnsError) {
      console.error('Error checking existing turns:', turnsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check game state',
        req
      );
    }

    console.log(`[AUTO-INIT] Checking turns for game ${gameId}:`, {
      gameTurnCount: game.turnCount,
      existingTurnsCount: existingTurns?.length || 0,
      existingTurns: existingTurns
    });

    if (existingTurns && existingTurns.length > 0) {
      console.log(`[AUTO-INIT] Game ${gameId} has data inconsistency: game.turnCount=${game.turnCount} but ${existingTurns.length} turns exist`);
      console.log(`[AUTO-INIT] Existing turns:`, existingTurns);
      
      // If game record shows 0 turns but turns exist, this is a data inconsistency
      // We should trust the game record and allow auto-initialization to proceed
      if (game.turnCount === 0) {
        console.log(`[AUTO-INIT] Data inconsistency detected - game record shows 0 turns but ${existingTurns.length} turns exist in database`);
        console.log(`[AUTO-INIT] Cleaning up orphaned turns and proceeding with auto-initialization`);
        
        // Clean up orphaned turns
        const { error: deleteError } = await supabaseAdmin
          .from('turns')
          .delete()
          .eq('game_id', gameId);
          
        if (deleteError) {
          console.error(`[AUTO-INIT] Error cleaning up orphaned turns:`, deleteError);
          // Continue anyway - the applyTurn method will handle duplicates
        } else {
          console.log(`[AUTO-INIT] Successfully cleaned up ${existingTurns.length} orphaned turns`);
        }
        
        // Continue with auto-initialization to fix the inconsistency
      } else {
        console.log(`[AUTO-INIT] Game ${gameId} already has ${existingTurns.length} turns, skipping auto-initialization`);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Game has already been initialized',
          req
        );
      }
    }

    // Create and process initial prompt automatically by submitting a special "game_start" turn
    const idempotencyKey = `auto-init-${gameId}-${Date.now()}`;
    console.log(`[AUTO-INIT] Creating initial prompt for game ${gameId} with optionId: game_start`);
    
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId: 'game_start', // Special option ID for initial prompts
      owner: ownerId,
      idempotencyKey,
      isGuest: ownership.isGuestOwner,
    });
    
    console.log(`[AUTO-INIT] Turn result:`, turnResult);

    if (!turnResult.success) {
      return sendErrorWithStatus(
        res,
        turnResult.error || ApiErrorCode.INTERNAL_ERROR,
        turnResult.message || 'Failed to create initial prompt',
        req,
        turnResult.details // Include full details in error response
      );
    }

    sendSuccess(res, turnResult.turnDTO, req);
  } catch (error) {
    console.error('Error auto-initializing game:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// POST /api/games/:id/initial-prompt - REMOVED (v3 cutover, no legacy support)
// This route has been permanently removed. Use POST /api/games with entry_point_id instead.

// POST /api/games/:id/approve-prompt - REMOVED (v3 cutover, no legacy support)
// This route has been permanently removed. Approval flow is no longer needed with v3 assembler.

export default router;
