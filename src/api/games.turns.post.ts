// POST /api/games/:id/turns
// Handles player input and generates narrator response

import { createClient } from '@supabase/supabase-js';
import { assemblePrompt } from '../prompt/assembler';
import { SupabaseDbAdapter } from '../prompt/assembler/db';
import { buildNpcArgs } from '../services/npc';
import { mockModel } from '../model/modelAdapter';
import type { AssembleArgs } from '../prompt/assembler/types';

interface TurnRequest {
  input: string;
  locale?: string;
}

interface TurnResponse {
  turn: {
    idx: number;
    role: string;
    content: {
      text: string;
    };
    prompt_meta: {
      segmentIdsByScope: Record<string, number[]>;
      tokensEstimated: number;
      truncated?: any;
    };
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client with user context
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration missing' });
    }

    // Create Supabase client with user context
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from request (in production, this would come from auth middleware)
    const user = req.user || null; // Mock for now
    const ownerUserId = user?.id || null;

    // Parse request body
    const { input, locale = 'en-US' }: TurnRequest = req.body;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return res.status(400).json({ error: 'input is required and must be a non-empty string' });
    }

    // Get game ID from URL parameters
    const gameId = req.query.id;
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }

    // Verify game exists and user has access (RLS will handle this)
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        id,
        entry_point_id,
        world_id,
        ruleset_id,
        turn_count,
        state,
        owner_user_id
      `)
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user owns the game (RLS should handle this, but double-check)
    if (ownerUserId && game.owner_user_id !== ownerUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get current turn count
    const currentTurnCount = game.turn_count || 0;
    const nextTurnIdx = currentTurnCount + 1;

    // Create player turn record
    const playerTurnRecord = {
      id: nextTurnIdx,
      game_id: gameId,
      idx: nextTurnIdx,
      role: 'player',
      content: {
        text: input.trim()
      },
      prompt_meta: {},
      costs: {}
    };

    // Insert player turn
    const { error: playerTurnError } = await supabase
      .from('turns')
      .insert(playerTurnRecord);

    if (playerTurnError) {
      console.error('Player turn creation error:', playerTurnError);
      return res.status(500).json({ error: 'Failed to create player turn' });
    }

    // Get NPCs for this game
    const dbAdapter = new SupabaseDbAdapter(supabase);
    const npcs = await buildNpcArgs(gameId, game.entry_point_id, dbAdapter);

    // Assemble prompt with isFirstTurn=false and player input
    const assembleArgs: AssembleArgs = {
      entryPointId: game.entry_point_id,
      worldId: game.world_id,
      rulesetId: game.ruleset_id,
      gameId,
      isFirstTurn: false, // Not first turn
      gameStateText: JSON.stringify(game.state), // Include current game state
      inputText: input.trim(),
      npcs,
      locale
    };

    const { prompt, meta } = await assemblePrompt(assembleArgs, dbAdapter);

    // Generate narrator response using model adapter
    const modelResponse = await mockModel.generate({
      prompt,
      maxTokens: 1000,
      temperature: 0.7
    });

    // Create narrator turn record
    const narratorTurnIdx = nextTurnIdx + 1;
    const narratorTurnRecord = {
      id: narratorTurnIdx,
      game_id: gameId,
      idx: narratorTurnIdx,
      role: 'narrator',
      prompt_meta: {
        segments_used: meta.segmentIdsByScope,
        tokens_estimated: meta.tokensEstimated,
        truncated: meta.truncated,
        order: meta.order
      },
      content: {
        text: modelResponse.text
      },
      costs: {
        prompt_tokens: modelResponse.usage?.promptTokens || 0,
        completion_tokens: modelResponse.usage?.completionTokens || 0,
        total_tokens: modelResponse.usage?.totalTokens || 0
      }
    };

    // Insert narrator turn
    const { error: narratorTurnError } = await supabase
      .from('turns')
      .insert(narratorTurnRecord);

    if (narratorTurnError) {
      console.error('Narrator turn creation error:', narratorTurnError);
      return res.status(500).json({ error: 'Failed to create narrator turn' });
    }

    // Update game turn count
    const { error: updateError } = await supabase
      .from('games')
      .update({ turn_count: narratorTurnIdx })
      .eq('id', gameId);

    if (updateError) {
      console.error('Game update error:', updateError);
      // Non-fatal error, continue
    }

    // Return response
    const response: TurnResponse = {
      turn: {
        idx: narratorTurnIdx,
        role: 'narrator',
        content: {
          text: modelResponse.text
        },
        prompt_meta: {
          segmentIdsByScope: meta.segmentIdsByScope,
          tokensEstimated: meta.tokensEstimated,
          truncated: meta.truncated
        }
      }
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Game turn error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process turn'
    });
  }
}
