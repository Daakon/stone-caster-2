/**
 * Prompt Trace Service
 * 
 * Writes compact, redacted prompt traces to prompting.prompt_traces
 * Admin-only; safe defaults; opt-in via PROMPT_TRACING_ENABLED
 */

import { supabaseAdmin } from './supabase.js';
import { config } from '../config/index.js';
import { redactSensitive, cap } from '../utils/debugResponse.js';
import { createHash } from 'crypto';

export interface PromptTraceInput {
  gameId: string;
  turnId: string;
  turnNumber: number;
  phase: 'start' | 'turn';
  assembler: {
    prompt: string;
    pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
    meta: {
      tokenEst?: { pct: number };
      policy?: string[];
      rulesetSlug?: string;
      npcTrimmedCount?: number;
      [key: string]: any;
    };
  };
  timings?: {
    assembleMs?: number;
    aiMs?: number;
    totalMs?: number;
  };
}

/**
 * Write a prompt trace (if tracing is enabled)
 * Fails silently - never throws
 */
export async function writePromptTrace(input: PromptTraceInput): Promise<void> {
  // Check if tracing is enabled
  if (!config.promptTracing.enabled) {
    return;
  }

  try {
    // Redact sensitive fields from prompt
    const redactedPrompt = redactSensitive(input.assembler.prompt);
    const promptSnippet = cap(redactedPrompt, config.promptTracing.maxSnippet);
    
    // Compute prompt hash for deduplication
    const promptHash = createHash('sha256').update(promptSnippet).digest('hex');

    // Prepare trace row
    const traceRow = {
      game_id: input.gameId,
      turn_id: input.turnId,
      turn_number: input.turnNumber,
      phase: input.phase,
      source: input.assembler.meta.source || 'entry-point',
      version: input.assembler.meta.version || 'v3',
      token_pct: input.assembler.meta.tokenEst?.pct || 0,
      policy: input.assembler.meta.policy || [],
      pieces: input.assembler.pieces.map(p => ({
        scope: p.scope,
        slug: p.slug,
        version: p.version || '1.0.0',
        tokens: p.tokens || 0,
      })),
      timings: {
        assembleMs: input.timings?.assembleMs || null,
        aiMs: input.timings?.aiMs || null,
        totalMs: input.timings?.totalMs || null,
      },
      prompt_snippet: promptSnippet,
              ruleset_slug: input.assembler.meta.rulesetSlug || null,
              npc_trimmed_count: input.assembler.meta.npcTrimmedCount || 0,
              prompt_hash: promptHash,
              by_scope: (() => {
                // Calculate byScope from pieces if not provided
                if (input.assembler.meta.byScope) {
                  return input.assembler.meta.byScope;
                }
                const byScope: Record<string, number> = {};
                for (const piece of input.assembler.pieces) {
                  const scope = piece.scope;
                  byScope[scope] = (byScope[scope] || 0) + (piece.tokens || 0);
                }
                return byScope;
              })(),
            };

    // Insert trace (service role, bypasses RLS)
    const { error } = await supabaseAdmin
      .from('prompt_traces')
      .insert(traceRow);

    if (error) {
      console.error('[PROMPT_TRACE] Failed to write trace:', error);
      return;
    }

    // Log success
    console.log(JSON.stringify({
      event: 'v3.trace.write',
      gameId: input.gameId,
      turnNumber: input.turnNumber,
      snippetLen: promptSnippet.length,
    }));
  } catch (error) {
    // Fail silently - tracing must not break the turn
    console.error('[PROMPT_TRACE] Unexpected error writing trace:', error);
  }
}

/**
 * Fetch traces for a game (admin-only, via backend route)
 */
export async function getPromptTraces(
  gameId: string,
  limit: number = 50
): Promise<Array<{
  turnNumber: number;
  phase: 'start' | 'turn';
  tokenPct: number;
  policy: string[];
  pieces: Array<{ scope: string; slug: string; version?: string; tokens?: number }>;
  timings: { assembleMs?: number; aiMs?: number; totalMs?: number };
  promptSnippet: string;
  rulesetSlug?: string;
  npcTrimmedCount: number;
  byScope?: Record<string, number>;
  createdAt: string;
}>> {
  const { data, error } = await supabaseAdmin
    .from('prompt_traces')
    .select('turn_number, phase, token_pct, policy, pieces, timings, prompt_snippet, ruleset_slug, npc_trimmed_count, by_scope, created_at')
    .eq('game_id', gameId)
    .order('turn_number', { ascending: false })
    .limit(limit);
  
  if (error || !data) {
    if (error) {
      console.error('[PROMPT_TRACE] Failed to fetch traces:', error);
    }
    return [];
  }

  return data.map((row: any) => ({
    turnNumber: row.turn_number,
    phase: row.phase as 'start' | 'turn',
    tokenPct: Number(row.token_pct),
    byScope: row.by_scope as Record<string, number> | undefined,
    policy: (row.policy as string[]) || [],
    pieces: (row.pieces as Array<{ scope: string; slug: string; version?: string; tokens?: number }>) || [],
    timings: (row.timings as { assembleMs?: number; aiMs?: number; totalMs?: number }) || {},
    promptSnippet: row.prompt_snippet,
    rulesetSlug: row.ruleset_slug || undefined,
    npcTrimmedCount: row.npc_trimmed_count || 0,
    createdAt: row.created_at,
  }));
}

