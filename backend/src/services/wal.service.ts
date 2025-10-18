import { supabaseAdmin } from './supabase.js';

export interface WALEntry {
  id: string;
  session_id: string;
  turn_id: number;
  awf_raw: any;
  applied: boolean;
  created_at: string;
}

export interface WriteWALRequest {
  session_id: string;
  turn_id: number;
  awf_raw: any;
}

export interface ReconcileRequest {
  session_id: string;
}

export class WALService {
  /**
   * Write a WAL entry before applying acts
   */
  async writeWAL(request: WriteWALRequest): Promise<WALEntry> {
    const { session_id, turn_id, awf_raw } = request;

    const { data: walEntry, error } = await supabaseAdmin
      .from('turn_wal')
      .upsert({
        session_id,
        turn_id,
        awf_raw,
        applied: false
      }, { onConflict: 'session_id,turn_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to write WAL entry: ${error.message}`);
    }

    return walEntry;
  }

  /**
   * Mark a WAL entry as applied after successful commit
   */
  async markApplied(session_id: string, turn_id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('turn_wal')
      .update({ applied: true })
      .eq('session_id', session_id)
      .eq('turn_id', turn_id);

    if (error) {
      throw new Error(`Failed to mark WAL entry as applied: ${error.message}`);
    }
  }

  /**
   * Get unapplied WAL entries for a session
   */
  async getUnappliedEntries(session_id: string): Promise<WALEntry[]> {
    const { data: entries, error } = await supabaseAdmin
      .from('turn_wal')
      .select('*')
      .eq('session_id', session_id)
      .eq('applied', false)
      .order('turn_id', { ascending: true });

    if (error) {
      throw new Error(`Failed to get unapplied WAL entries: ${error.message}`);
    }

    return entries || [];
  }

  /**
   * Reconcile WAL entries for crash recovery
   */
  async reconcile(request: ReconcileRequest): Promise<{ applied: number; discarded: number }> {
    const { session_id } = request;

    // Get unapplied entries
    const unappliedEntries = await this.getUnappliedEntries(session_id);
    
    let applied = 0;
    let discarded = 0;

    for (const entry of unappliedEntries) {
      try {
        // Check if the turn was already applied by verifying current session state
        const { data: session } = await supabaseAdmin
          .from('sessions')
          .select('turn_id')
          .eq('session_id', session_id)
          .single();

        if (session && session.turn_id > entry.turn_id) {
          // Turn was already applied, mark as applied
          await this.markApplied(session_id, entry.turn_id);
          applied++;
        } else {
          // Re-apply the turn
          await this.reapplyTurn(entry);
          await this.markApplied(session_id, entry.turn_id);
          applied++;
        }
      } catch (error) {
        console.error(`Failed to reconcile turn ${entry.turn_id}:`, error);
        // Mark as discarded if re-application fails
        await this.discardEntry(entry.id);
        discarded++;
      }
    }

    return { applied, discarded };
  }

  /**
   * Re-apply a turn from WAL
   */
  private async reapplyTurn(entry: WALEntry): Promise<void> {
    // TODO: Implement turn re-application logic
    // This would involve:
    // 1. Parsing the AWF output from awf_raw
    // 2. Applying the acts to the game state
    // 3. Updating the session turn_id
    console.log(`Re-applying turn ${entry.turn_id} for session ${entry.session_id}`);
  }

  /**
   * Discard a WAL entry
   */
  private async discardEntry(entryId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('turn_wal')
      .delete()
      .eq('id', entryId);

    if (error) {
      throw new Error(`Failed to discard WAL entry: ${error.message}`);
    }
  }

  /**
   * Clean up old WAL entries
   */
  async cleanupOldEntries(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabaseAdmin
      .from('turn_wal')
      .delete()
      .eq('applied', true)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to cleanup old WAL entries: ${error.message}`);
    }

    return data?.length || 0;
  }
}


