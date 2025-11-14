import { Router, type Request, type Response } from 'express';

// Protected health endpoint for Early Access testing
// Phase B4: Non-destructive endpoint to test EA guard
import { sendSuccess, sendErrorWithStatus, getTraceId } from '../utils/response.js';
import { optionalAuth } from '../middleware/auth.js';
import { requireIdempotencyKey } from '../middleware/validation.js';
import { ApiErrorCode, CreateGameRequestSchema, IdParamSchema, GameTurnRequestSchema, SessionTurnsResponseSchema, GetTurnsQuerySchema, type TurnDTO, TurnPostBodySchema, type TurnPostBody } from '@shared';
import { GamesService } from '../services/games.service.js';
import { turnsService, TurnsService } from '../services/turns.service.js';
import { WalletService } from '../services/wallet.service.js';
// Legacy promptsService import removed - v3 assembler used instead
import { supabaseAdmin } from '../services/supabase.js';
import { z } from 'zod';

const router = Router();

// Phase B4: Protected health endpoint for Early Access testing
// This endpoint is protected by the earlyAccessGuard middleware
router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      up: true,
      service: 'games',
      timestamp: new Date().toISOString(),
    },
  });
});

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

    // Validate request body - try new TurnPostBody format first, fallback to legacy
    let userIntent: { t: 'choice' | 'text'; text: string } | null = null;
    let optionId: string | undefined;
    let userInput: string | undefined;
    let userInputType: 'choice' | 'text' | 'action' | undefined;

    const newBodyValidation = TurnPostBodySchema.safeParse(req.body);
    if (newBodyValidation.success) {
      // New format: { kind: 'choice' | 'text', text: string }
      userIntent = {
        t: newBodyValidation.data.kind === 'choice' ? 'choice' : 'text',
        text: newBodyValidation.data.text.trim(),
      };
      userInput = userIntent.text;
      userInputType = userIntent.t === 'choice' ? 'choice' : 'text';
    } else {
      // Legacy format: { optionId: uuid, userInput?, userInputType? }
      const legacyBodyValidation = GameTurnRequestSchema.safeParse(req.body);
      if (!legacyBodyValidation.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Invalid request data - must be {kind:"choice"|"text", text:string} or legacy {optionId:uuid}',
          req,
          legacyBodyValidation.error.errors
        );
      }
      optionId = legacyBodyValidation.data.optionId;
      userInput = legacyBodyValidation.data.userInput;
      userInputType = legacyBodyValidation.data.userInputType;
    }

    const { id: gameId } = paramValidation.data;
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

    // For new format, validate text is non-empty and <= 400 chars
    if (userIntent) {
      const trimmedText = userIntent.text.trim();
      if (trimmedText.length === 0) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Text cannot be empty',
          req,
          { code: 'INVALID_INPUT', traceId: getTraceId(req) }
        );
      }
      if (trimmedText.length > 400) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          'Text must be 400 characters or less',
          req,
          { code: 'INVALID_INPUT', traceId: getTraceId(req) }
        );
      }
    }

    // Execute the turn
    const turnResult = await turnsService.runBufferedTurn({
      gameId,
      optionId: optionId || 'user_input', // Legacy fallback, new format doesn't need optionId
      owner: ownerId,
      idempotencyKey,
      isGuest: ownership.isGuestOwner,
      userInput: userIntent?.text || userInput,
      userInputType: userIntent?.t || userInputType,
      userIntent, // Pass the new UserIntent format
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

    // Return TurnDTO directly (no legacy standardization)
    // Shape with conditional debug fields
    const { shapeTurnDTOForResponse } = await import('../utils/turn-dto-shape.js');
    
    // Get parsed AI response if available
    let parsedAi: unknown = null;
    if (turnResult.details?.aiResponse) {
      try {
        parsedAi = typeof turnResult.details.aiResponse === 'string'
          ? JSON.parse(turnResult.details.aiResponse)
          : turnResult.details.aiResponse;
      } catch {
        // Ignore parse errors
      }
    }
    
    // Validate TurnDTO against schema before sending
    const { TurnDTOSchema } = await import('@shared');
    const validationResult = TurnDTOSchema.safeParse(turnResult.turnDTO);
    
    if (!validationResult.success) {
      console.error('[TURNS_POST] TurnDTO validation failed:', validationResult.error.errors);
      const traceId = getTraceId(req);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Turn data validation failed',
        req,
        {
          code: 'DTO_VALIDATION_FAILED',
          errors: validationResult.error.errors,
          traceId,
        }
      );
    }

    // Add traceId to meta
    const validatedDTO = validationResult.data;
    if (!validatedDTO.meta) {
      validatedDTO.meta = {};
    }
    validatedDTO.meta.traceId = getTraceId(req);

    const shapedDTO = await shapeTurnDTOForResponse(
      validatedDTO,
      req,
      {
        prompt: turnResult.debugMetadata?.assembler?.prompt,
        rawAi: parsedAi,
      }
    );

    // Log turn created metric
    console.log(JSON.stringify({
      event: 'turns_created_total',
      game_id: gameId,
      turn_count: shapedDTO.turnCount,
      choices_count: shapedDTO.choices.length,
      has_narrative: shapedDTO.narrative.length > 0,
      narrative_length: shapedDTO.narrative.length,
      timestamp: new Date().toISOString(),
    }));

    sendSuccess(res, shapedDTO, req);
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

// GET /api/games/:id/turns/latest - get the latest turn for a game (returns TurnDTO)
// Auto-initializes Turn 1 if no turns exist (idempotent)
router.get('/:id/turns/latest', optionalAuth, async (req: Request, res: Response) => {
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
    
    // Log ownership context for debugging
    console.log('[TURNS_LATEST] Ownership context:', {
      gameId,
      userId,
      isGuest,
      ownerId,
      isGuestOwner: ownership.isGuestOwner,
      guestCookieId: ownership.guestCookieId,
      hasUserId: !!userId,
      traceId: getTraceId(req),
    });
    
    const game = await gamesService.getGameById(
      gameId,
      ownerId,
      ownership.isGuestOwner,
      ownership.guestCookieId
    );

    if (!game) {
      // Log detailed error for debugging - check what's actually in the database
      console.error('[TURNS_LATEST] Game not found - ownership mismatch:', {
        gameId,
        ownerId,
        isGuestOwner: ownership.isGuestOwner,
        guestCookieId: ownership.guestCookieId,
        userId,
        isGuest,
        traceId: getTraceId(req),
      });
      
      // Try to fetch game without ownership check to see if it exists
      try {
        const { data: gameExists, error: debugError } = await supabaseAdmin
          .from('games')
          .select('id, user_id, cookie_group_id')
          .eq('id', gameId)
          .single();
        
        if (gameExists) {
          console.error('[TURNS_LATEST] Game exists in DB but ownership mismatch:', {
            gameId,
            dbUserId: gameExists.user_id,
            dbCookieGroupId: gameExists.cookie_group_id,
            requestOwnerId: ownerId,
            requestGuestCookieId: ownership.guestCookieId,
            requestIsGuest: ownership.isGuestOwner,
          });
        } else if (debugError) {
          console.error('[TURNS_LATEST] Game does not exist in DB:', {
            gameId,
            error: debugError.message,
          });
        }
      } catch (debugError) {
        // Ignore debug query errors
        console.error('[TURNS_LATEST] Error checking game existence:', debugError);
      }
      
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    // Check if turns exist with a lightweight query to avoid triggering side effects
    const { data: existingTurnsCheck, error: turnsCheckError } = await supabaseAdmin
      .from('turns')
      .select('turn_number')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: false })
      .limit(1);

    if (turnsCheckError && turnsCheckError.code !== 'PGRST116') {
      console.error('[TURNS_LATEST] Error checking for existing turns:', turnsCheckError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check game turns',
        req
      );
    }

    // If no turns exist, auto-initialize Turn 1 (idempotent)
    if (!existingTurnsCheck || existingTurnsCheck.length === 0) {
      console.log(`[TURNS_LATEST] No turns found for game ${gameId}, auto-initializing Turn 1`);
      
      // Check if Turn 1 already exists (race condition guard)
      // Turns table uses 'content' (jsonb) not 'ai_response'
      const { data: existingTurn1, error: turnCheckError } = await supabaseAdmin
        .from('turns')
        .select('id, turn_number, role, content, meta, created_at')
        .eq('game_id', gameId)
        .eq('turn_number', 1)
        .single();

      if (turnCheckError && turnCheckError.code !== 'PGRST116') {
        // PGRST116 = not found, which is fine
        console.error('[TURNS_LATEST] Error checking for existing Turn 1:', turnCheckError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to check game state',
          req
        );
      }

      // If Turn 1 exists now (race condition), use it
      if (existingTurn1) {
        console.log(`[TURNS_LATEST] Turn 1 found after race check, using existing turn`);
        const wallet = await WalletService.getWallet(ownerId, ownership.isGuestOwner, ownership.guestCookieId);
        
        // Convert to TurnDTO
        // The 'content' field (jsonb) contains the AI response data
        let turnDTO: TurnDTO;
        if (existingTurn1.content) {
          try {
            // content is jsonb, contains the AI response structure
            const parsedAi = existingTurn1.content;
            
            const { aiToTurnDTO } = await import('../ai/ai-adapter.js');
            // Ensure createdAt is ISO string format (Zod requires strict datetime)
            let createdAt: string;
            if (existingTurn1.created_at instanceof Date) {
              createdAt = existingTurn1.created_at.toISOString();
            } else if (typeof existingTurn1.created_at === 'string') {
              const date = new Date(existingTurn1.created_at);
              if (isNaN(date.getTime())) {
                createdAt = new Date().toISOString();
              } else {
                createdAt = date.toISOString();
              }
            } else {
              createdAt = new Date().toISOString();
            }
            
            turnDTO = await aiToTurnDTO(parsedAi, {
              id: existingTurn1.turn_number,
              gameId,
              turnCount: existingTurn1.turn_number,
              createdAt,
              castingStonesBalance: wallet.castingStones,
            });
          } catch (error) {
            // Fallback: extract narrative from content
            const narrative = existingTurn1.content?.narrative || existingTurn1.content?.txt || 'Narrative not available';
            turnDTO = {
              id: existingTurn1.turn_number,
              gameId,
              turnCount: existingTurn1.turn_number,
              narrative,
              emotion: 'neutral',
              choices: existingTurn1.content?.choices || [],
              actions: existingTurn1.content?.acts || [],
              createdAt: (() => {
                // Always convert to ISO string format (Zod requires strict datetime)
                if (existingTurn1.created_at instanceof Date) {
                  return existingTurn1.created_at.toISOString();
                } else if (typeof existingTurn1.created_at === 'string') {
                  const date = new Date(existingTurn1.created_at);
                  if (isNaN(date.getTime())) {
                    return new Date().toISOString();
                  }
                  return date.toISOString();
                } else {
                  return new Date().toISOString();
                }
              })(),
              castingStonesBalance: wallet.castingStones,
            };
          }
        } else {
          // No content - minimal fallback
          let createdAt: string;
          if (existingTurn1.created_at instanceof Date) {
            createdAt = existingTurn1.created_at.toISOString();
          } else if (typeof existingTurn1.created_at === 'string') {
            const date = new Date(existingTurn1.created_at);
            if (isNaN(date.getTime())) {
              createdAt = new Date().toISOString();
            } else {
              createdAt = date.toISOString();
            }
          } else {
            createdAt = new Date().toISOString();
          }
          
          turnDTO = {
            id: existingTurn1.turn_number,
            gameId,
            turnCount: existingTurn1.turn_number,
            narrative: 'Narrative not available',
            emotion: 'neutral',
            choices: [],
            actions: [],
            createdAt,
            castingStonesBalance: wallet.castingStones,
          };
        }

        // Shape with conditional debug fields
        const { shapeTurnDTOForResponse } = await import('../utils/turn-dto-shape.js');
        const shapedDTO = await shapeTurnDTOForResponse(
          turnDTO,
          req,
          existingTurn1.content ? {
            rawAi: existingTurn1.content,
          } : undefined
        );

        return sendSuccess(res, shapedDTO, req);
      }

      // No Turn 1 exists, create it
      console.log(`[TURNS_LATEST] No Turn 1 found for game ${gameId}, creating initial turn`);
      
      const { TurnsService } = await import('../services/turns.service.js');
      const turnsService = new TurnsService();
      
      const idempotencyKey = `latest-turn-auto-init-${gameId}-${Date.now()}`;
      console.log(`[TURNS_LATEST] Creating initial prompt for game ${gameId} with optionId: game_start`);
      
      // Request debug metadata for detailed logging (server-side only, not exposed to client)
      const turnResult = await turnsService.runBufferedTurn({
        gameId,
        optionId: 'game_start',
        owner: ownerId,
        idempotencyKey,
        isGuest: ownership.isGuestOwner,
        includeDebugMetadata: true, // Enable debug logging for auto-init
      });

      console.log(`[TURNS_LATEST] Turn result:`, {
        success: turnResult.success,
        hasTurnDTO: !!turnResult.turnDTO,
        turnCount: turnResult.turnDTO?.turnCount,
        narrativeLength: turnResult.turnDTO?.narrative?.length || 0,
        choicesCount: turnResult.turnDTO?.choices?.length || 0,
        hasDebugMetadata: !!turnResult.debugMetadata,
      });

      // Log detailed prompt and AI response information (server-side only)
      if (turnResult.debugMetadata) {
        console.log('=== [TURNS_LATEST] AUTO-INITIALIZATION DETAILS ===');
        if (turnResult.debugMetadata.assembler) {
          console.log('[TURNS_LATEST] Full Prompt:', turnResult.debugMetadata.assembler.prompt);
          console.log('[TURNS_LATEST] Prompt Pieces:', turnResult.debugMetadata.assembler.pieces?.length || 0);
          console.log('[TURNS_LATEST] Prompt Metadata:', {
            model: turnResult.debugMetadata.assembler.meta?.model,
            tokenPct: turnResult.debugMetadata.assembler.meta?.tokenEst?.pct,
            policy: turnResult.debugMetadata.assembler.meta?.policy,
          });
        }
        if (turnResult.debugMetadata.ai) {
          console.log('[TURNS_LATEST] AI Request:', JSON.stringify(turnResult.debugMetadata.ai.request, null, 2));
          console.log('[TURNS_LATEST] AI Raw Response:', JSON.stringify(turnResult.debugMetadata.ai.rawResponse, null, 2));
          console.log('[TURNS_LATEST] AI Transformed:', JSON.stringify(turnResult.debugMetadata.ai.transformed, null, 2));
        }
        if (turnResult.debugMetadata.timings) {
          console.log('[TURNS_LATEST] Timings:', turnResult.debugMetadata.timings);
        }
        console.log('===================================================');
      }

      // Also log from details if available
      if (turnResult.details) {
        console.log('[TURNS_LATEST] Turn Details:', {
          hasPrompt: !!turnResult.details.prompt,
          hasAiResponse: !!turnResult.details.aiResponse,
          hasTransformedResponse: !!turnResult.details.transformedResponse,
          error: turnResult.details.error,
          timestamp: turnResult.details.timestamp,
        });
        if (turnResult.details.prompt) {
          console.log('[TURNS_LATEST] Prompt from details:', turnResult.details.prompt);
        }
        if (turnResult.details.aiResponse) {
          console.log('[TURNS_LATEST] AI Response from details:', turnResult.details.aiResponse);
        }
      }

      if (!turnResult.success) {
        console.error('[TURNS_LATEST] Failed to create initial turn:', {
          error: turnResult.error,
          message: turnResult.message,
          details: turnResult.details,
        });
        return sendErrorWithStatus(
          res,
          turnResult.error || ApiErrorCode.INTERNAL_ERROR,
          turnResult.message || 'Failed to initialize game',
          req,
          turnResult.details
        );
      }

      // Extract raw AI response from debug metadata or details for debug field
      let rawAiResponse: unknown = undefined;
      if (turnResult.debugMetadata?.ai?.rawResponse) {
        rawAiResponse = turnResult.debugMetadata.ai.rawResponse;
      } else if (turnResult.details?.aiResponse) {
        try {
          rawAiResponse = typeof turnResult.details.aiResponse === 'string'
            ? JSON.parse(turnResult.details.aiResponse)
            : turnResult.details.aiResponse;
        } catch {
          // Ignore parse errors
        }
      }

      // If turnDTO has empty narrative but details has it, re-parse from details
      let validatedDTO = turnResult.turnDTO;
      if ((!validatedDTO.narrative || validatedDTO.narrative.length === 0) && turnResult.details?.aiResponse) {
        console.warn('[TURNS_LATEST] TurnDTO has empty narrative but details.aiResponse has it, re-parsing...');
        try {
          let aiResponseFromDetails: unknown;
          if (typeof turnResult.details.aiResponse === 'string') {
            try {
              aiResponseFromDetails = JSON.parse(turnResult.details.aiResponse);
              console.log('[TURNS_LATEST] Parsed AI response from details string:', {
                type: typeof aiResponseFromDetails,
                hasNarrative: typeof (aiResponseFromDetails as any)?.narrative === 'string',
                narrativeLength: typeof (aiResponseFromDetails as any)?.narrative === 'string'
                  ? (aiResponseFromDetails as any).narrative.length
                  : 'not a string',
                keys: typeof aiResponseFromDetails === 'object' && aiResponseFromDetails !== null
                  ? Object.keys(aiResponseFromDetails as object)
                  : 'not an object',
              });
            } catch (parseError) {
              console.error('[TURNS_LATEST] Failed to parse aiResponse string:', parseError);
              throw parseError;
            }
          } else {
            aiResponseFromDetails = turnResult.details.aiResponse;
            console.log('[TURNS_LATEST] Using aiResponse directly (not a string):', {
              type: typeof aiResponseFromDetails,
              hasNarrative: typeof (aiResponseFromDetails as any)?.narrative === 'string',
            });
          }
          
          const { aiToTurnDTO } = await import('../ai/ai-adapter.js');
          const { WalletService } = await import('../services/wallet.service.js');
          const wallet = await WalletService.getWallet(ownerId, ownership.isGuestOwner, ownership.guestCookieId);
          
          // Get the actual turn record to get proper id and createdAt
          const { data: createdTurn } = await supabaseAdmin
            .from('turns')
            .select('turn_number, created_at')
            .eq('game_id', gameId)
            .eq('turn_number', validatedDTO.turnCount)
            .single();
          
          // Ensure createdAt is in ISO 8601 format (Zod requires strict datetime format)
          let createdAt: string;
          if (createdTurn?.created_at instanceof Date) {
            createdAt = createdTurn.created_at.toISOString();
          } else if (typeof createdTurn?.created_at === 'string') {
            // Parse string date and convert to ISO (handles +00:00, Z, and other formats)
            const date = new Date(createdTurn.created_at);
            if (isNaN(date.getTime())) {
              console.warn(`[TURNS_LATEST] Invalid date for turn ${validatedDTO.turnCount}: ${createdTurn.created_at}, using current time`);
              createdAt = new Date().toISOString();
            } else {
              createdAt = date.toISOString();
            }
          } else {
            createdAt = new Date().toISOString();
          }
          
          validatedDTO = await aiToTurnDTO(aiResponseFromDetails, {
            id: createdTurn?.turn_number || validatedDTO.turnCount,
            gameId,
            turnCount: validatedDTO.turnCount,
            createdAt,
            castingStonesBalance: wallet.castingStones,
          });
          console.log('[TURNS_LATEST] Successfully re-parsed TurnDTO from details, narrative length:', validatedDTO.narrative.length);
        } catch (reparseError) {
          console.error('[TURNS_LATEST] Failed to re-parse TurnDTO from details:', reparseError);
          // Continue with original turnDTO
        }
      }

      // Validate TurnDTO against schema before sending
      const { TurnDTOSchema } = await import('@shared');
      const validationResult = TurnDTOSchema.safeParse(validatedDTO);
      
      if (!validationResult.success) {
        console.error('[TURNS_LATEST] TurnDTO validation failed:', validationResult.error.errors);
        console.error('[TURNS_LATEST] TurnDTO that failed validation:', {
          narrative: validatedDTO.narrative?.substring(0, 100),
          narrativeLength: validatedDTO.narrative?.length,
          createdAt: validatedDTO.createdAt,
          turnCount: validatedDTO.turnCount,
        });
        const traceId = getTraceId(req);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Turn data validation failed',
          req,
          {
            code: 'DTO_VALIDATION_FAILED',
            errors: validationResult.error.errors,
            traceId,
          }
        );
      }

      // Get validated DTO (may have been re-parsed)
      const finalValidatedDTO = validationResult.data;
      if (!finalValidatedDTO.meta) {
        finalValidatedDTO.meta = {};
      }
      if (!finalValidatedDTO.meta.traceId) {
        finalValidatedDTO.meta.traceId = getTraceId(req);
      }

      // Shape TurnDTO with conditional debug fields
      const { shapeTurnDTOForResponse } = await import('../utils/turn-dto-shape.js');
      const shapedDTO = await shapeTurnDTOForResponse(
        finalValidatedDTO,
        req,
        {
          prompt: turnResult.debugMetadata?.assembler?.prompt || turnResult.details?.prompt,
          rawAi: rawAiResponse,
        }
      );

      // Log turn created metric with detailed information
      console.log(JSON.stringify({
        event: 'turns_created_total',
        game_id: gameId,
        turn_count: shapedDTO.turnCount,
        choices_count: shapedDTO.choices.length,
        has_narrative: shapedDTO.narrative.length > 0,
        narrative_length: shapedDTO.narrative.length,
        source: 'latest_turn_auto_init',
        trace_id: shapedDTO.meta?.traceId,
        timestamp: new Date().toISOString(),
      }));

      // Warn if narrative is empty or fallback was used
      if (shapedDTO.narrative.length === 0 || shapedDTO.meta?.warnings?.includes('AI_EMPTY_NARRATIVE')) {
        console.warn('[TURNS_LATEST] WARNING: Turn created with empty/fallback narrative!', {
          gameId,
          turnCount: shapedDTO.turnCount,
          choicesCount: shapedDTO.choices.length,
          narrativeLength: shapedDTO.narrative.length,
          warnings: shapedDTO.meta?.warnings,
          traceId: shapedDTO.meta?.traceId,
        });
      }

      return sendSuccess(res, shapedDTO, req);
    }

    // Turns exist - fetch the latest turn record with full details
    const { data: latestTurnsData, error: latestTurnError } = await supabaseAdmin
      .from('turns')
      .select('id, turn_number, role, content, meta, created_at')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: false })
      .limit(1)
      .single();

    if (latestTurnError) {
      console.error('[TURNS_LATEST] Error fetching latest turn:', latestTurnError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch latest turn',
        req
      );
    }

    const latestTurnRecord = latestTurnsData;

    // Convert turn record to TurnDTO using ai-adapter if we have ai_response
    const { WalletService } = await import('../services/wallet.service.js');
    const wallet = await WalletService.getWallet(ownerId, ownership.isGuestOwner, ownership.guestCookieId);
    
    let turnDTO: TurnDTO;
    
    // Convert to TurnDTO using ai-adapter
    // Turns table uses 'content' (jsonb) which contains the AI response
    if (latestTurnRecord.content) {
      try {
        // content is jsonb, contains the AI response structure
        const parsedAi = latestTurnRecord.content;
        
        const { aiToTurnDTO } = await import('../ai/ai-adapter.js');
        // Ensure createdAt is ISO string format (Zod requires strict datetime)
        let createdAt: string;
        if (latestTurnRecord.created_at instanceof Date) {
          createdAt = latestTurnRecord.created_at.toISOString();
        } else if (typeof latestTurnRecord.created_at === 'string') {
          // Parse string date and convert to ISO (handles +00:00, Z, and other formats)
          const date = new Date(latestTurnRecord.created_at);
          if (isNaN(date.getTime())) {
            console.warn(`[TURNS_LATEST] Invalid date for turn ${latestTurnRecord.turn_number}: ${latestTurnRecord.created_at}, using current time`);
            createdAt = new Date().toISOString();
          } else {
            createdAt = date.toISOString();
          }
        } else {
          createdAt = new Date().toISOString();
        }
        
        turnDTO = await aiToTurnDTO(parsedAi, {
          id: latestTurnRecord.turn_number,
          gameId,
          turnCount: latestTurnRecord.turn_number,
          createdAt,
          castingStonesBalance: wallet.castingStones,
        });
      } catch (error) {
        // Fallback: extract narrative from content
        const narrative = latestTurnRecord.content?.narrative || latestTurnRecord.content?.txt || 'Narrative not available';
        turnDTO = {
          id: latestTurnRecord.turn_number,
          gameId,
          turnCount: latestTurnRecord.turn_number,
          narrative,
          emotion: 'neutral',
          choices: latestTurnRecord.content?.choices || [],
          actions: latestTurnRecord.content?.acts || [],
          createdAt: (() => {
            // Always convert to ISO string format (Zod requires strict datetime)
            if (latestTurnRecord.created_at instanceof Date) {
              return latestTurnRecord.created_at.toISOString();
            } else if (typeof latestTurnRecord.created_at === 'string') {
              const date = new Date(latestTurnRecord.created_at);
              if (isNaN(date.getTime())) {
                return new Date().toISOString();
              }
              return date.toISOString();
            } else {
              return new Date().toISOString();
            }
          })(),
          castingStonesBalance: wallet.castingStones,
        };
      }
    } else {
      // No content - minimal fallback
      let createdAt: string;
      if (latestTurnRecord.created_at instanceof Date) {
        createdAt = latestTurnRecord.created_at.toISOString();
      } else if (typeof latestTurnRecord.created_at === 'string') {
        const date = new Date(latestTurnRecord.created_at);
        if (isNaN(date.getTime())) {
          createdAt = new Date().toISOString();
        } else {
          createdAt = date.toISOString();
        }
      } else {
        createdAt = new Date().toISOString();
      }
      
      turnDTO = {
        id: latestTurnRecord.turn_number,
        gameId,
        turnCount: latestTurnRecord.turn_number,
        narrative: 'Narrative not available',
        emotion: 'neutral',
        choices: [],
        actions: [],
        createdAt,
        castingStonesBalance: wallet.castingStones,
      };
    }

    // Shape with conditional debug fields
    const { shapeTurnDTOForResponse } = await import('../utils/turn-dto-shape.js');
    const shapedDTO = await shapeTurnDTOForResponse(
      turnDTO,
      req,
      latestTurnRecord.content ? {
        rawAi: latestTurnRecord.content,
      } : undefined
    );

    sendSuccess(res, shapedDTO, req);
  } catch (error) {
    console.error('Error loading latest turn:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

// GET /api/games/:id/turns/history - get conversation history with user prompts and AI responses
router.get('/:id/turns/history', optionalAuth, async (req: Request, res: Response) => {
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

    const gameId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 20; // Default 20 entries (last 10 turns typically)
    
    // Resolve ownership context
    const ownership = resolveOwnershipContext(req, userId, isGuest || false);
    const ownerId = ownership.ownerId ?? userId;

    // Verify game exists and user has access
    const gamesService = new GamesService();
    const game = await gamesService.getGameById(gameId, ownerId, ownership.isGuestOwner, ownership.guestCookieId);
    
    if (!game) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'Game not found',
        req
      );
    }

    // Fetch turns with user inputs from meta
    const { data: turnsData, error: turnsError } = await supabaseAdmin
      .from('turns')
      .select('turn_number, role, content, meta, created_at')
      .eq('game_id', gameId)
      .order('turn_number', { ascending: false })
      .limit(Math.ceil(limit / 2)); // Get turns (each turn has user input + AI response, so divide by 2)

    if (turnsError) {
      console.error('[TURNS_HISTORY] Error fetching turns:', turnsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch conversation history',
        req
      );
    }

    // Build conversation entries: for each turn, create user entry (if exists) and AI entry
    const { ConversationEntrySchema, ConversationHistorySchema } = await import('@shared');
    const entries: any[] = [];

    // Process turns in reverse order (oldest first for conversation flow)
    const sortedTurns = (turnsData || []).sort((a, b) => a.turn_number - b.turn_number);

    for (const turn of sortedTurns) {
      const userInput = turn.meta?.userInput;
      const content = turn.content || {};
      
      // Extract narrative from content
      const narrative = content.txt || content.narrative || turn.meta?.narrativeSummary || '';
      
      // Ensure createdAt is ISO string (Zod requires strict datetime format)
      let createdAt: string;
      if (turn.created_at instanceof Date) {
        createdAt = turn.created_at.toISOString();
      } else if (typeof turn.created_at === 'string') {
        // Parse the string to a Date object and convert to ISO
        const date = new Date(turn.created_at);
        if (isNaN(date.getTime())) {
          // Invalid date string, use current time as fallback
          console.warn(`[TURNS_HISTORY] Invalid date for turn ${turn.turn_number}: ${turn.created_at}, using current time`);
          createdAt = new Date().toISOString();
        } else {
          // Valid date, convert to ISO string
          createdAt = date.toISOString();
        }
      } else {
        // No date provided, use current time
        createdAt = new Date().toISOString();
      }

      // Add user prompt entry if it exists (skip for turn 1 initialization)
      if (userInput && turn.turn_number > 1) {
        const userEntry = ConversationEntrySchema.parse({
          id: turn.turn_number,
          gameId,
          turnCount: turn.turn_number,
          type: 'user',
          content: userInput,
          createdAt,
        });
        entries.push(userEntry);
      }

      // Add AI narrative entry if it exists
      if (narrative && narrative.trim().length > 0) {
        const aiEntry = ConversationEntrySchema.parse({
          id: turn.turn_number,
          gameId,
          turnCount: turn.turn_number,
          type: 'ai',
          content: narrative,
          createdAt,
        });
        entries.push(aiEntry);
      }
    }

    // Check if there are more turns available
    const { count } = await supabaseAdmin
      .from('turns')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);
    
    const totalTurns = count || 0;
    const hasMore = totalTurns > Math.ceil(limit / 2);

    const history = ConversationHistorySchema.parse({
      entries,
      hasMore,
      totalTurns,
    });

    return sendSuccess(res, history, req);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
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

    // Idempotent check: Check if Turn 1 already exists (game_id, turn_count=1)
    // Turns table uses 'content' (jsonb) not 'ai_response' or 'narrative_summary'
    const { data: existingTurn1, error: turnCheckError } = await supabaseAdmin
      .from('turns')
      .select('id, turn_number, role, content, meta, created_at')
      .eq('game_id', gameId)
      .eq('turn_number', 1)
      .single();

    if (turnCheckError && turnCheckError.code !== 'PGRST116') {
      // PGRST116 = not found, which is fine
      console.error('[AUTO-INIT] Error checking for existing Turn 1:', turnCheckError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to check game state',
        req
      );
    }

    // If Turn 1 exists, return it (idempotent)
    if (existingTurn1) {
      console.log(`[AUTO-INIT] Turn 1 already exists for game ${gameId}, returning existing turn`);
      
      // Convert existing turn record to TurnDTO
      const wallet = await WalletService.getWallet(ownerId, ownership.isGuestOwner, ownership.guestCookieId);
      
            // Convert existing turn to TurnDTO using ai-adapter
            // The 'content' field (jsonb) contains the AI response data
            let turnDTO: TurnDTO;
            if (existingTurn1.content) {
              try {
                // content is jsonb, contains the AI response structure
                const parsedAi = existingTurn1.content;
                
                const { aiToTurnDTO } = await import('../ai/ai-adapter.js');
                turnDTO = await aiToTurnDTO(parsedAi, {
                  id: existingTurn1.turn_number,
                  gameId,
                  turnCount: existingTurn1.turn_number,
                  createdAt: existingTurn1.created_at,
                  castingStonesBalance: wallet.castingStones,
                });
              } catch (error) {
                // Fallback: extract narrative from content
                const narrative = existingTurn1.content?.narrative || existingTurn1.content?.txt || 'Narrative not available';
                turnDTO = {
                  id: existingTurn1.turn_number,
                  gameId,
                  turnCount: existingTurn1.turn_number,
                  narrative,
                  emotion: 'neutral',
                  choices: existingTurn1.content?.choices || [],
                  actions: existingTurn1.content?.acts || [],
                  createdAt: existingTurn1.created_at,
                  castingStonesBalance: wallet.castingStones,
                };
              }
            } else {
              // No content - minimal fallback
              turnDTO = {
                id: existingTurn1.turn_number,
                gameId,
                turnCount: existingTurn1.turn_number,
                narrative: 'Narrative not available',
                emotion: 'neutral',
                choices: [],
                actions: [],
                createdAt: existingTurn1.created_at,
                castingStonesBalance: wallet.castingStones,
              };
            }
            
            // Validate TurnDTO before returning
            const { TurnDTOSchema } = await import('@shared');
            const validationResult = TurnDTOSchema.safeParse(turnDTO);
            if (!validationResult.success) {
              console.error('[AUTO-INIT] TurnDTO validation failed:', validationResult.error.errors);
              return sendErrorWithStatus(
                res,
                ApiErrorCode.INTERNAL_ERROR,
                'Turn data validation failed',
                req,
                {
                  code: 'DTO_VALIDATION_FAILED',
                  errors: validationResult.error.errors,
                  traceId: getTraceId(req),
                }
              );
            }
            
            // Add traceId to meta
            const validatedDTO = validationResult.data;
            if (!validatedDTO.meta) {
              validatedDTO.meta = {};
            }
            validatedDTO.meta.traceId = getTraceId(req);
      
            // Log idempotent hit metric
            console.log(JSON.stringify({
              event: 'turns_init_idempotent_hits_total',
              gameId,
              timestamp: new Date().toISOString(),
            }));

            return sendSuccess(res, validatedDTO, req);
    }

    // No Turn 1 exists, proceed with initialization
    console.log(`[AUTO-INIT] No Turn 1 found for game ${gameId}, creating initial turn`);

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

      // Validate TurnDTO against schema before sending
      const { TurnDTOSchema } = await import('@shared');
      const validationResult = TurnDTOSchema.safeParse(turnResult.turnDTO);
      
      if (!validationResult.success) {
        console.error('[AUTO-INIT] TurnDTO validation failed:', validationResult.error.errors);
        const traceId = getTraceId(req);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Turn data validation failed',
          req,
          {
            code: 'DTO_VALIDATION_FAILED',
            errors: validationResult.error.errors,
            traceId,
          }
        );
      }

      // Add traceId to meta
      const validatedDTO = validationResult.data;
      if (!validatedDTO.meta) {
        validatedDTO.meta = {};
      }
      validatedDTO.meta.traceId = getTraceId(req);

      // Shape TurnDTO with conditional debug fields
      const { shapeTurnDTOForResponse } = await import('../utils/turn-dto-shape.js');
      const shapedDTO = await shapeTurnDTOForResponse(
        validatedDTO,
        req,
        {
          prompt: turnResult.debugMetadata?.assembler?.prompt,
          rawAi: parsedAi,
        }
      );

      // Log turn created metric
      console.log(JSON.stringify({
        event: 'turns_created_total',
        game_id: gameId,
        turn_count: shapedDTO.turnCount,
        choices_count: shapedDTO.choices.length,
        has_narrative: shapedDTO.narrative.length > 0,
        narrative_length: shapedDTO.narrative.length,
        timestamp: new Date().toISOString(),
      }));

      sendSuccess(res, shapedDTO, req);
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
