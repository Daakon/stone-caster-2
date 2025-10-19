import { supabaseAdmin } from './supabase.js';

export interface ExportRequest {
  session_id: string;
}

export interface ImportRequest {
  exportData: any;
  preserveTurnId?: boolean;
}

export interface ExportData {
  version: string;
  session: {
    session_id: string;
    player_id: string;
    world_ref: string;
    adventure_ref: string;
    turn_id: number;
    is_first_turn: boolean;
    created_at: string;
    updated_at: string;
  };
  game_state: {
    hot: any;
    warm: any;
    cold: any;
    updated_at: string;
  };
  content_refs: {
    world: {
      ref: string;
      hash: string;
    };
    adventure: {
      ref: string;
      hash: string;
    };
    contract: {
      ref: string;
      hash: string;
    };
  };
  metadata: {
    exported_at: string;
    exported_by: string;
    redacted: boolean;
  };
}

export class ExportImportService {
  /**
   * Export a redacted session bundle
   */
  async exportSession(request: ExportRequest): Promise<ExportData> {
    const { session_id } = request;

    // Get session data
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      throw new Error(`Session not found: ${session_id}`);
    }

    // Get game state
    const { data: gameState, error: gameStateError } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (gameStateError || !gameState) {
      throw new Error(`Game state not found for session: ${session_id}`);
    }

    // Redact sensitive data
    const redactedSession = this.redactSession(session);
    const redactedGameState = this.redactGameState(gameState);

    // Get content references (hashes)
    const contentRefs = await this.getContentReferences(session);

    const exportData: ExportData = {
      version: '1.0',
      session: redactedSession,
      game_state: redactedGameState,
      content_refs: contentRefs,
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: 'system', // TODO: Get actual user
        redacted: true
      }
    };

    return exportData;
  }

  /**
   * Import a session bundle to create a sandbox session
   */
  async importSession(request: ImportRequest): Promise<string> {
    const { exportData, preserveTurnId = false } = request;

    // Validate export data
    if (!exportData.session || !exportData.game_state) {
      throw new Error('Invalid export data: missing session or game_state');
    }

    // Create new session
    const newSessionId = crypto.randomUUID();
    
    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        session_id: newSessionId,
        player_id: exportData.session.player_id,
        world_ref: exportData.session.world_ref,
        adventure_ref: exportData.session.adventure_ref,
        turn_id: preserveTurnId ? exportData.session.turn_id : 1,
        is_first_turn: preserveTurnId ? exportData.session.is_first_turn : true
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    // Create game state
    const { error: gameStateError } = await supabaseAdmin
      .from('game_states')
      .insert({
        session_id: newSessionId,
        hot: exportData.game_state.hot,
        warm: exportData.game_state.warm,
        cold: exportData.game_state.cold
      });

    if (gameStateError) {
      throw new Error(`Failed to create game state: ${gameStateError.message}`);
    }

    return newSessionId;
  }

  /**
   * Redact sensitive data from session
   */
  private redactSession(session: any): any {
    return {
      session_id: session.session_id,
      player_id: this.maskPlayerId(session.player_id),
      world_ref: session.world_ref,
      adventure_ref: session.adventure_ref,
      turn_id: session.turn_id,
      is_first_turn: session.is_first_turn,
      created_at: session.created_at,
      updated_at: session.updated_at
    };
  }

  /**
   * Redact sensitive data from game state
   */
  private redactGameState(gameState: any): any {
    return {
      hot: gameState.hot || {},
      warm: gameState.warm || { episodic: [], pins: [] },
      cold: gameState.cold || {},
      updated_at: gameState.updated_at
    };
  }

  /**
   * Get content references and hashes
   */
  private async getContentReferences(session: any): Promise<any> {
    // TODO: Get actual content hashes from world, adventure, and contract tables
    return {
      world: {
        ref: session.world_ref,
        hash: 'placeholder-world-hash'
      },
      adventure: {
        ref: session.adventure_ref,
        hash: 'placeholder-adventure-hash'
      },
      contract: {
        ref: 'core.contract.v4',
        hash: 'placeholder-contract-hash'
      }
    };
  }

  /**
   * Mask player ID for privacy
   */
  private maskPlayerId(playerId: string): string {
    if (!playerId) return 'unknown';
    if (playerId.length <= 4) return '***';
    return playerId.slice(0, 2) + '***' + playerId.slice(-2);
  }
}


