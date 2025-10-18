import { supabaseAdmin } from './supabase.js';

export interface RecapRequest {
  session_id: string;
  lastTurns?: number;
}

export interface RecapResponse {
  recapTxt: string;
  objectives: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  source: {
    pinsUsed: string[];
    turnsUsed: number;
  };
}

export class RecapService {
  /**
   * Generate a deterministic recap using warm memory and recent turns
   */
  async generateRecap(request: RecapRequest): Promise<RecapResponse> {
    const { session_id, lastTurns = 3 } = request;

    // Get session and game state
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

    // Extract warm memory data
    const warm = gameState.warm || { episodic: [], pins: [] };
    const pins = warm.pins || [];
    const episodic = warm.episodic || [];

    // Get objectives from hot state
    const hot = gameState.hot || {};
    const objectives = hot.objectives || [];

    // Get recent turns from WAL (if available)
    const { data: recentTurns } = await supabaseAdmin
      .from('turn_wal')
      .select('awf_raw, turn_id')
      .eq('session_id', session_id)
      .eq('applied', true)
      .order('turn_id', { ascending: false })
      .limit(lastTurns);

    // Build recap text from sources
    const recapTxt = this.buildRecapText(pins, episodic, recentTurns || []);
    
    // Format objectives
    const formattedObjectives = this.formatObjectives(objectives);

    return {
      recapTxt,
      objectives: formattedObjectives,
      source: {
        pinsUsed: pins.slice(0, 3).map((pin: any) => pin.key || pin.id || 'unknown'),
        turnsUsed: Math.min(lastTurns, recentTurns?.length || 0)
      }
    };
  }

  /**
   * Build recap text from memory sources
   */
  private buildRecapText(pins: any[], episodic: any[], recentTurns: any[]): string {
    const sentences: string[] = [];

    // Start with pinned memories (newest first)
    const recentPins = pins
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 2);

    for (const pin of recentPins) {
      if (pin.note && pin.note.length > 0) {
        const sentence = this.cleanMemoryText(pin.note);
        if (sentence && sentence.length <= 24) {
          sentences.push(sentence);
        }
      }
    }

    // Add top episodic memories by salience and recency
    const topEpisodic = episodic
      .sort((a, b) => {
        const salienceA = a.salience || 0;
        const salienceB = b.salience || 0;
        if (salienceA !== salienceB) {
          return salienceB - salienceA;
        }
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, 2);

    for (const memory of topEpisodic) {
      if (memory.note && memory.note.length > 0) {
        const sentence = this.cleanMemoryText(memory.note);
        if (sentence && sentence.length <= 24) {
          sentences.push(sentence);
        }
      }
    }

    // Add recent turn summaries
    for (const turn of recentTurns.slice(0, 2)) {
      if (turn.awf_raw?.txt) {
        const sentence = this.cleanTurnText(turn.awf_raw.txt);
        if (sentence && sentence.length <= 24) {
          sentences.push(sentence);
        }
      }
    }

    // Ensure we have 2-6 sentences
    const finalSentences = sentences.slice(0, 6);
    if (finalSentences.length < 2) {
      finalSentences.push("The adventure continues with new challenges ahead.");
    }

    return finalSentences.join(' ');
  }

  /**
   * Clean memory text for recap
   */
  private cleanMemoryText(text: string): string {
    if (!text) return '';
    
    // Remove mechanical phrases
    let cleaned = text
      .replace(/\b(ticks?|turns?|rounds?|actions?)\b/gi, '')
      .replace(/\b(roll|dice|d20|d100)\b/gi, '')
      .replace(/\b(HP|AC|DC|modifier)\b/gi, '')
      .replace(/\b(character|player|PC|NPC)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Ensure it ends with a period
    if (cleaned.length > 0 && !cleaned.endsWith('.')) {
      cleaned += '.';
    }

    return cleaned;
  }

  /**
   * Clean turn text for recap
   */
  private cleanTurnText(text: string): string {
    if (!text) return '';
    
    // Extract first sentence or meaningful phrase
    const sentences = text.split(/[.!?]/);
    const firstSentence = sentences[0]?.trim();
    
    if (!firstSentence) return '';
    
    return this.cleanMemoryText(firstSentence);
  }

  /**
   * Format objectives for recap
   */
  private formatObjectives(objectives: any[]): Array<{ id: string; name: string; status: string }> {
    return objectives
      .sort((a, b) => {
        // Main objectives before side objectives
        if (a.type === 'main' && b.type !== 'main') return -1;
        if (a.type !== 'main' && b.type === 'main') return 1;
        
        // In progress before others
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
        
        return 0;
      })
      .map(obj => ({
        id: obj.id || 'unknown',
        name: obj.name || obj.description || 'Unnamed objective',
        status: obj.status || 'unknown'
      }));
  }
}


