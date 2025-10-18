import { supabaseAdmin } from './supabase.js';
import { createHash } from 'crypto';

export interface SnapshotPayload {
  version: string;
  session: {
    session_id: string;
    world_ref: string;
    adventure_ref: string;
    turn_id: number;
    is_first_turn: boolean;
  };
  game_state: {
    hot: any;
    warm: any;
    cold: any;
  };
  npcs: any;
  player: any;
  rng: {
    seed: number;
    policy: string;
  };
  contract_ref: string;
  world: {
    ref: string;
    hash: string;
  };
  adventure: {
    ref: string;
    hash: string;
  };
}

export interface Snapshot {
  id: string;
  session_id: string;
  created_at: string;
  label?: string;
  content_hash: string;
  payload: SnapshotPayload;
}

export interface CreateSnapshotRequest {
  session_id: string;
  label?: string;
}

export interface RestoreSnapshotRequest {
  session_id: string;
  snapshot_id: string;
}

export class SnapshotsService {
  /**
   * Create an atomic snapshot of a session's runtime state
   */
  async createSnapshot(request: CreateSnapshotRequest): Promise<Snapshot> {
    const { session_id, label } = request;

    // Start transaction to read all session data atomically
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      throw new Error(`Session not found: ${session_id}`);
    }

    const { data: gameState, error: gameStateError } = await supabaseAdmin
      .from('game_states')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (gameStateError || !gameState) {
      throw new Error(`Game state not found for session: ${session_id}`);
    }

    // Build snapshot payload
    const payload: SnapshotPayload = {
      version: '1.0',
      session: {
        session_id: session.session_id,
        world_ref: session.world_ref,
        adventure_ref: session.adventure_ref,
        turn_id: session.turn_id,
        is_first_turn: session.is_first_turn
      },
      game_state: {
        hot: gameState.hot || {},
        warm: gameState.warm || { episodic: [], pins: [] },
        cold: gameState.cold || {}
      },
      npcs: {}, // TODO: Load active NPCs from game state
      player: {}, // TODO: Load player sheet from game state
      rng: {
        seed: Math.floor(Math.random() * 1000000), // TODO: Get actual RNG seed
        policy: 'd20/d100'
      },
      contract_ref: 'core.contract.v4', // TODO: Get actual contract ref
      world: {
        ref: session.world_ref,
        hash: '' // TODO: Get actual world hash
      },
      adventure: {
        ref: session.adventure_ref,
        hash: '' // TODO: Get actual adventure hash
      }
    };

    // Compute content hash
    const contentHash = this.computeContentHash(payload);

    // Check for existing snapshot with same content hash
    const { data: existingSnapshot } = await supabaseAdmin
      .from('snapshots')
      .select('*')
      .eq('session_id', session_id)
      .eq('content_hash', contentHash)
      .single();

    if (existingSnapshot) {
      return existingSnapshot;
    }

    // Create new snapshot
    const { data: snapshot, error: createError } = await supabaseAdmin
      .from('snapshots')
      .insert({
        session_id,
        label,
        content_hash: contentHash,
        payload
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create snapshot: ${createError.message}`);
    }

    return snapshot;
  }

  /**
   * List all snapshots for a session
   */
  async listSnapshots(session_id: string): Promise<Snapshot[]> {
    const { data: snapshots, error } = await supabaseAdmin
      .from('snapshots')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list snapshots: ${error.message}`);
    }

    return snapshots || [];
  }

  /**
   * Restore a session from a snapshot (transactional)
   */
  async restoreSnapshot(request: RestoreSnapshotRequest): Promise<void> {
    const { session_id, snapshot_id } = request;

    // Get the snapshot
    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from('snapshots')
      .select('*')
      .eq('id', snapshot_id)
      .eq('session_id', session_id)
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Snapshot not found: ${snapshot_id}`);
    }

    const payload = snapshot.payload as SnapshotPayload;

    // Restore session data
    const { error: sessionError } = await supabaseAdmin
      .from('sessions')
      .update({
        world_ref: payload.session.world_ref,
        adventure_ref: payload.session.adventure_ref,
        turn_id: payload.session.turn_id,
        is_first_turn: payload.session.is_first_turn
      })
      .eq('session_id', session_id);

    if (sessionError) {
      throw new Error(`Failed to restore session: ${sessionError.message}`);
    }

    // Restore game state
    const { error: gameStateError } = await supabaseAdmin
      .from('game_states')
      .upsert({
        session_id,
        hot: payload.game_state.hot,
        warm: payload.game_state.warm,
        cold: payload.game_state.cold
      });

    if (gameStateError) {
      throw new Error(`Failed to restore game state: ${gameStateError.message}`);
    }
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(session_id: string, snapshot_id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('snapshots')
      .delete()
      .eq('id', snapshot_id)
      .eq('session_id', session_id);

    if (error) {
      throw new Error(`Failed to delete snapshot: ${error.message}`);
    }
  }

  /**
   * Compute content hash for deduplication
   */
  private computeContentHash(payload: SnapshotPayload): string {
    const content = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(content).digest('hex');
  }
}


