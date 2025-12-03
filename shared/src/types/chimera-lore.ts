/**
 * Chimera Lore Entry Types
 * Single source of truth for lore entry (Pure RAG) structure
 */

/**
 * ChimeraLoreEntry
 * The standard structure for lore entries in the chimera_lore_entries table
 * These entries are world-specific and will be vectorized by the compiler for RAG search
 * Stories reference lore entries from their world during compilation
 */
export interface ChimeraLoreEntry {
  /**
   * Unique identifier for the lore entry (UUID)
   */
  id: string;

  /**
   * Foreign key to chimera_worlds.id (UUID)
   * Lore entries are world-specific. Stories can reference lore entries from their world.
   */
  world_id: string;

  /**
   * Display name for the lore entry (for UI purposes)
   */
  display_name: string;

  /**
   * The actual lore content text that will be vectorized for RAG search
   * This is the "fact sheet" text that serves as the RAG source
   */
  entry_text: string;

  /**
   * Timestamp when the entry was created
   */
  created_at: string;

  /**
   * Timestamp when the entry was last updated
   */
  updated_at: string;
}

/**
 * Type guard to check if an object conforms to ChimeraLoreEntry
 */
export function isChimeraLoreEntry(value: unknown): value is ChimeraLoreEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    'id' in obj &&
    'world_id' in obj &&
    'display_name' in obj &&
    'entry_text' in obj &&
    'created_at' in obj &&
    'updated_at' in obj &&
    typeof obj.id === 'string' &&
    typeof obj.world_id === 'string' &&
    typeof obj.display_name === 'string' &&
    typeof obj.entry_text === 'string' &&
    typeof obj.created_at === 'string' &&
    typeof obj.updated_at === 'string'
  );
}

