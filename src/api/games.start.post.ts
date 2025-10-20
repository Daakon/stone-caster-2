// POST /api/games/start
// Creates a new game with entry_start bootstrap

import { createClient } from '@supabase/supabase-js';
import { assemblePrompt } from '../prompt/assembler';
import { SupabaseDbAdapter } from '../prompt/assembler/db';
import { buildNpcArgs } from '../services/npc';
import { markBootstrapped } from '../services/state';
import { mockModel } from '../model/modelAdapter';
import type { AssembleArgs } from '../prompt/assembler/types';

interface StartGameRequest {
  entry_point_id: string;
  locale?: string;
}

interface StartGameResponse {
  game_id: string;
  first_turn: {
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
    const { entry_point_id, locale = 'en-US' }: StartGameRequest = req.body;

    if (!entry_point_id) {
      return res.status(400).json({ error: 'entry_point_id is required' });
    }

    // Get entry point details
    const { data: entryPoint, error: entryError } = await supabase
      .from('entry_points')
      .select('id, world_id, ruleset_id, title')
      .eq('id', entry_point_id)
      .eq('lifecycle', 'active')
      .eq('visibility', 'public')
      .single();

    if (entryError || !entryPoint) {
      return res.status(404).json({ error: 'Entry point not found' });
    }

    // Create game record
    const gameId = crypto.randomUUID();
    const gameRecord = {
      id: gameId,
      entry_point_id: entryPoint.id,
      entry_point_type: 'adventure', // Default type
      world_id: entryPoint.world_id,
      ruleset_id: entryPoint.ruleset_id,
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

    // Insert game record
    const { error: gameError } = await supabase
      .from('games')
      .insert(gameRecord);

    if (gameError) {
      console.error('Game creation error:', gameError);
      return res.status(500).json({ error: 'Failed to create game' });
    }

    // Get NPCs for this entry point
    const dbAdapter = new SupabaseDbAdapter(supabase);
    const npcs = await buildNpcArgs(gameId, entry_point_id, dbAdapter);

    // Assemble prompt with isFirstTurn=true
    const assembleArgs: AssembleArgs = {
      entryPointId: entry_point_id,
      worldId: entryPoint.world_id,
      rulesetId: entryPoint.ruleset_id,
      gameId,
      isFirstTurn: true,
      npcs,
      locale
    };

    const { prompt, meta } = await assemblePrompt(assembleArgs, dbAdapter);

    // Generate first narrator turn using model adapter
    const modelResponse = await mockModel.generate({
      prompt,
      maxTokens: 1000,
      temperature: 0.7
    });

    // Create first turn record
    const firstTurnId = 1;
    const turnRecord = {
      id: firstTurnId,
      game_id: gameId,
      idx: firstTurnId,
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

    // Insert first turn
    const { error: turnError } = await supabase
      .from('turns')
      .insert(turnRecord);

    if (turnError) {
      console.error('Turn creation error:', turnError);
      return res.status(500).json({ error: 'Failed to create first turn' });
    }

    // Mark game as bootstrapped and increment turn count
    await markBootstrapped(gameId);

    // Update game turn count
    const { error: updateError } = await supabase
      .from('games')
      .update({ turn_count: 1 })
      .eq('id', gameId);

    if (updateError) {
      console.error('Game update error:', updateError);
      // Non-fatal error, continue
    }

    // Return response
    const response: StartGameResponse = {
      game_id: gameId,
      first_turn: {
        idx: firstTurnId,
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
    console.error('Game start error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to start game'
    });
  }
}
