// Games Service
// Handles game lifecycle including startGame with entry_start bootstrap

import { assemblePrompt } from '../prompt/assembler';
import { SupabaseDbAdapter } from '../prompt/assembler/db';
import { markBootstrapped } from './state.js';
import { buildNpcArgs } from './npc';
import type { AssembleArgs } from '../prompt/assembler/types';

// Mock model adapter for now - replace with actual implementation
const mockModelAdapter = {
  generate: async (prompt: string, options?: any) => {
    // Mock response - replace with actual model call
    return {
      content: `[Narrator] The adventure begins... ${prompt.substring(0, 50)}...`,
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: 50,
        total_tokens: Math.ceil(prompt.length / 4) + 50
      }
    };
  }
};

export interface StartGameArgs {
  entryPointId: string;
  ownerUserId: string;
  locale?: string;
}

export interface StartGameResult {
  gameId: string;
  firstTurnId: number;
  prompt: string;
  meta: any;
}

/**
 * Starts a new game with entry_start bootstrap
 * @param args Game start arguments
 * @returns Game creation result
 */
export async function startGame(args: StartGameArgs): Promise<StartGameResult> {
  const { entryPointId, ownerUserId, locale = 'en' } = args;
  
  // Get entry point details to extract world and ruleset
  const dbAdapter = new SupabaseDbAdapter({} as any); // Mock supabase client
  
  // For now, we'll use mock data - in production, fetch from entry_points table
  const mockEntryPoint = {
    id: entryPointId,
    world_id: 'world.mystika',
    ruleset_id: 'ruleset.classic_v1',
    title: 'Whispercross Adventure'
  };

  // Create game record
  const gameId = crypto.randomUUID();
  const gameRecord = {
    id: gameId,
    entry_point_id: entryPointId,
    entry_point_type: 'adventure',
    world_id: mockEntryPoint.world_id,
    ruleset_id: mockEntryPoint.ruleset_id,
    owner_user_id: ownerUserId,
    state: {
      hot: {},
      warm: {},
      cold: {
        flags: {
          entry_bootstrapped: false
        }
      }
    },
    turn_count: 0,
    status: 'active'
  };

  // Get NPCs for this entry point
  const npcs = await buildNpcArgs(gameId, entryPointId, dbAdapter);

  // Assemble prompt with isFirstTurn=true
  const assembleArgs: AssembleArgs = {
    entryPointId,
    worldId: mockEntryPoint.world_id,
    rulesetId: mockEntryPoint.ruleset_id,
    gameId,
    isFirstTurn: true,
    npcs,
    locale
  };

  const { prompt, meta } = await assemblePrompt(assembleArgs, dbAdapter);

  // Generate first narrator turn
  const modelResponse = await mockModelAdapter.generate(prompt);
  
  // Create first turn record
  const firstTurnId = 1;
  const turnRecord = {
    id: firstTurnId,
    game_id: gameId,
    idx: firstTurnId,
    role: 'narrator' as const,
    prompt_meta: {
      segments_used: meta.segmentIdsByScope,
      tokens_estimated: meta.tokensEstimated,
      truncated: meta.truncated,
      order: meta.order
    },
    content: {
      text: modelResponse.content,
      usage: modelResponse.usage
    },
    costs: {
      prompt_tokens: modelResponse.usage.prompt_tokens,
      completion_tokens: modelResponse.usage.completion_tokens,
      total_tokens: modelResponse.usage.total_tokens
    }
  };

  // Mark game as bootstrapped and increment turn count
  await markBootstrapped(gameId);

  return {
    gameId,
    firstTurnId,
    prompt,
    meta
  };
}

/**
 * Gets game details by ID
 * @param gameId Game identifier
 * @returns Game record or null
 */
export async function getGame(gameId: string): Promise<any | null> {
  // Mock implementation - replace with actual database query
  return {
    id: gameId,
    entry_point_id: 'ep.whispercross',
    world_id: 'world.mystika',
    ruleset_id: 'ruleset.classic_v1',
    owner_user_id: 'user-123',
    state: {
      hot: {},
      warm: {},
      cold: {
        flags: {
          entry_bootstrapped: true
        }
      }
    },
    turn_count: 1,
    status: 'active'
  };
}
