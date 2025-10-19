/**
 * NPC Compactor for AWF Bundle System
 * Produces compact, deterministic summaries for token efficiency
 */

export interface CompactNpcDoc {
  id: string | null;
  ver: string | null;
  name: string;
  archetype: string | null;
  summary: string;
  style: {
    voice: string | null;
    register: string | null;
  };
  tags: string[];
}

/**
 * Produce compact, deterministic summaries (no model calls).
 * 
 * Applies locale overlay if available, otherwise uses default fields.
 * Truncates summary to 160 chars for token efficiency.
 */
export function compactNpcDoc(doc: any, locale?: string): CompactNpcDoc {
  const n = doc?.npc ?? {};
  const loc = locale && n.i18n?.[locale] ? n.i18n[locale] : {};
  
  const name = loc.display_name ?? n.display_name ?? "Unknown";
  const summary = (loc.summary ?? n.summary ?? "").slice(0, 160);
  
  const style = {
    voice: loc.style?.voice ?? n.style?.voice ?? null,
    register: loc.style?.register ?? n.style?.register ?? null
  };

  return {
    id: doc.__id ?? null,               // repository can attach id
    ver: doc.__version ?? null,         // repository can attach version
    name,
    archetype: n.archetype ?? null,
    summary,
    style,
    tags: n.tags ?? []
  };
}
