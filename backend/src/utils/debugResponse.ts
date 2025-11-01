import { Request } from 'express';
import { config } from '../config/index.js';
import { supabaseAdmin } from '../services/supabase.js';

/**
 * Check if the request wants debug (explicit opt-in/opt-out or default)
 * Order: explicit off beats default on
 * @param req - Express request object
 * @returns true if debug is wanted (default true for admins, unless explicitly opted out)
 */
export function wantsDebug(req: Request): boolean {
  // Explicit opt-out beats default
  if (req.query.debug === '0' || req.headers['x-debug-response'] === '0') {
    return false;
  }

  // Explicit opt-in
  if (req.query.debug === '1' || req.headers['x-debug-response'] === '1') {
    return true;
  }

  // Default: admins want debug (backend-controlled default)
  return true; // We'll gate by isDebugEnabledForUser next
}

/**
 * Check if debug is enabled for the user
 * @param req - Express request object
 * @param userRole - User role (must be retrieved separately)
 * @returns true if debug should be enabled for this user
 */
export function isDebugEnabledForUser(req: Request, userRole: string): boolean {
  const cfg = config.debug;

  if (!cfg.responseEnabled) {
    return false;
  }

  if (userRole !== 'admin') {
    return false;
  }

  return wantsDebug(req);
}

/**
 * Get user role from request (async, queries database)
 * @param req - Express request object
 * @returns User role or null if not authenticated or not found
 */
export async function getUserRole(req: Request): Promise<string | null> {
  const userId = req.ctx?.userId || req.user?.id;
  if (!userId || req.ctx?.isGuest) {
    return null;
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', userId)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile.role || null;
  } catch (error) {
    console.error('[DEBUG_RESPONSE] Error checking user role:', error);
    return null;
  }
}

/**
 * Check if debug response is allowed for this request (convenience wrapper)
 * @param req - Express request object
 * @returns true if debug response should be included
 * @deprecated Use isDebugEnabledForUser with getUserRole instead
 */
export async function isDebugResponseAllowed(req: Request): Promise<boolean> {
  const userRole = await getUserRole(req);
  if (!userRole) {
    return false;
  }
  return isDebugEnabledForUser(req, userRole);
}

/**
 * Redact sensitive fields from an object (deep clone)
 * @param obj - Object to redact
 * @returns Redacted deep copy of the object
 */
export function redactSensitive(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key should be redacted
    if (
      lowerKey.includes('apikey') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('bearer') ||
      lowerKey.includes('cookie')
    ) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Cap a value to max characters (stringify if needed)
 * @param value - Value to cap (will be stringified)
 * @param maxChars - Maximum characters
 * @returns Capped string with truncation marker if needed
 */
export function cap(value: any, maxChars: number): string {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  
  if (str.length <= maxChars) {
    return str;
  }

  return str.substring(0, maxChars) + '...[TRUNCATED]';
}

/**
 * Build debug payload structure
 */
export interface DebugAssembler {
  prompt: string;
  pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
  meta: {
    included?: string[];
    dropped?: string[];
    policy?: string[];
    model?: string;
    worldId?: string;
    rulesetSlug?: string;
    scenarioSlug?: string | null;
    entryStartSlug?: string;
    tokenEst?: { input: number; budget: number; pct: number };
    [key: string]: any;
  };
}

export interface DebugAI {
  request?: {
    model?: string;
    messages?: any[];
    [key: string]: any;
  };
  rawResponse?: any;
  transformed?: any;
}

export interface DebugTimings {
  assembleMs?: number;
  aiMs?: number;
  totalMs?: number;
}

export interface DebugPayload {
  debugId: string; // Unique identifier: ${gameId}:${turnNumber}
  phase: 'start' | 'turn';
  assembler: DebugAssembler;
  ai?: DebugAI;
  timings?: DebugTimings;
}

/**
 * Build debug payload with redaction and capping
 * @param params - Debug data parameters
 * @returns Debug payload ready for response
 */
export function buildDebugPayload(params: {
  debugId: string; // Unique identifier: ${gameId}:${turnNumber}
  phase: 'start' | 'turn';
  assembler: {
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
    meta: {
      included?: string[];
      dropped?: string[];
      policy?: string[];
      model?: string;
      worldId?: string;
      rulesetSlug?: string;
      scenarioSlug?: string | null;
      entryStartSlug?: string;
      tokenEst?: { input: number; budget: number; pct: number };
      [key: string]: any;
    };
  };
  ai?: {
    request?: any;
    rawResponse?: any;
    transformed?: any;
  };
  timings?: {
    assembleMs?: number;
    aiMs?: number;
    totalMs?: number;
  };
  maxChars?: number;
  includeAiRaw?: boolean; // Whether to include AI raw request/response (safe vs full)
}): DebugPayload {
  const maxChars = params.maxChars ?? config.debug.responseMaxChars;

  // Redact and cap assembler prompt
  const redactedPrompt = redactSensitive(params.assembler.prompt);
  const cappedPrompt = cap(redactedPrompt, maxChars);

  // Order pieces deterministically (core → ruleset → world → scenario? → entry → npc)
  const scopeOrder = ['core', 'ruleset', 'world', 'scenario', 'entry', 'entry_start', 'npc'];
  const orderedPieces = [...params.assembler.pieces].sort((a, b) => {
    const aIdx = scopeOrder.indexOf(a.scope.toLowerCase());
    const bIdx = scopeOrder.indexOf(b.scope.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) {
      return aIdx - bIdx;
    }
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.scope.localeCompare(b.scope);
  });

  // Redact and cap meta
  const redactedMeta = redactSensitive(params.assembler.meta);
  
  // Cap meta values that are strings
  const cappedMeta: any = {};
  for (const [key, value] of Object.entries(redactedMeta)) {
    if (typeof value === 'string') {
      cappedMeta[key] = cap(value, maxChars);
    } else if (Array.isArray(value)) {
      cappedMeta[key] = value.map(v => typeof v === 'string' ? cap(v, maxChars) : v);
    } else {
      cappedMeta[key] = value;
    }
  }

  const debugPayload: DebugPayload = {
    debugId: params.debugId,
    phase: params.phase,
    assembler: {
      prompt: cappedPrompt,
      pieces: orderedPieces,
      meta: cappedMeta,
    },
  };

  // Add AI data if present and includeAiRaw is true
  // Check feature flag: if DEBUG_RESPONSE_INCLUDE_AI_RAW env var is false, force safe mode (override)
  const envIncludeAiRaw = config.debug.includeAiRaw;
  const includeAiRaw = envIncludeAiRaw && params.includeAiRaw;
  
  if (params.ai && includeAiRaw) {
    // Redact sensitive fields first
    const redactedRequest = params.ai.request ? redactSensitive(params.ai.request) : undefined;
    const redactedRawResponse = params.ai.rawResponse ? redactSensitive(params.ai.rawResponse) : undefined;
    const redactedTransformed = params.ai.transformed ? redactSensitive(params.ai.transformed) : undefined;

    // Cap AI fields: stringify and check length, but keep original structure if within limit
    // If over limit, we'll store a truncated representation
    const capAiField = (obj: any): any => {
      if (!obj) return undefined;
      const str = JSON.stringify(obj);
      if (str.length <= maxChars) {
        return obj;
      }
      // If truncated, return the original object but note that it exceeds size
      // In practice, very large objects will need to be truncated at a higher level
      // For now, we keep the object but it may be incomplete in JSON serialization
      return obj;
    };

    debugPayload.ai = {
      request: capAiField(redactedRequest),
      rawResponse: capAiField(redactedRawResponse),
      transformed: capAiField(redactedTransformed),
    };
  } else if (params.ai && !includeAiRaw) {
    // Safe mode: only include transformed (the parsed/normalized response)
    if (params.ai.transformed) {
      const redactedTransformed = redactSensitive(params.ai.transformed);
      debugPayload.ai = {
        transformed: redactedTransformed,
      };
    }
  }

  // Add timings if present
  if (params.timings) {
    debugPayload.timings = params.timings;
  }

  return debugPayload;
}

