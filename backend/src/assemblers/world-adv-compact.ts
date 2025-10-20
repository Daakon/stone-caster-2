/**
 * World & Adventure Compaction for AWF Bundle System
 * Phase 4: Worlds & Adventures Refresh - Token-efficient compaction with i18n support
 */

/**
 * Compact world document for token efficiency
 * @param doc - Raw world document
 * @param locale - Optional locale for i18n overlays
 * @returns Compacted world data
 */
export function compactWorld(doc: any, locale?: string) {
  const i = locale && doc?.i18n?.[locale] ? doc.i18n[locale] : {};
  
  return {
    id: doc?.id,
    name: i.name ?? doc?.name,
    timeworld: doc?.timeworld ?? null
  };
}

/**
 * Compact adventure document for token efficiency
 * @param doc - Raw adventure document
 * @param locale - Optional locale for i18n overlays
 * @returns Compacted adventure data
 */
export function compactAdventure(doc: any, locale?: string) {
  const i = locale && doc?.i18n?.[locale] ? doc.i18n[locale] : {};
  const cast = Array.isArray(doc?.cast) ? doc.cast.slice(0, 12) : [];
  
  return {
    id: doc?.id,
    name: i.name ?? doc?.name,
    synopsis: (i.synopsis ?? doc?.synopsis ?? "").slice(0, 280),
    cast
  };
}

/**
 * Apply token discipline to compacted world
 * @param compacted - Compacted world data
 * @param maxTokens - Maximum tokens (default 300)
 * @returns Token-disciplined world data
 */
export function applyWorldTokenDiscipline(compacted: any, maxTokens = 300) {
  let result = { ...compacted };
  
  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimateTokens = (obj: any) => JSON.stringify(obj).length / 4;
  
  if (estimateTokens(result) > maxTokens) {
    // Drop timeworld.seasons first
    if (result.timeworld?.seasons) {
      delete result.timeworld.seasons;
    }
    
    // If still over limit, omit timeworld entirely
    if (estimateTokens(result) > maxTokens) {
      result.timeworld = null;
    }
  }
  
  return result;
}

/**
 * Apply token discipline to compacted adventure
 * @param compacted - Compacted adventure data
 * @param maxTokens - Maximum tokens (default 300)
 * @returns Token-disciplined adventure data
 */
export function applyAdventureTokenDiscipline(compacted: any, maxTokens = 300) {
  let result = { ...compacted };
  
  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimateTokens = (obj: any) => JSON.stringify(obj).length / 4;
  
  if (estimateTokens(result) > maxTokens) {
    // Drop cast beyond 8 first
    if (result.cast && result.cast.length > 8) {
      result.cast = result.cast.slice(0, 8);
    }
    
    // Drop cast beyond 4 if still over limit
    if (estimateTokens(result) > maxTokens && result.cast && result.cast.length > 4) {
      result.cast = result.cast.slice(0, 4);
    }
    
    // Elide synopsis if still over limit
    if (estimateTokens(result) > maxTokens) {
      result.synopsis = "";
    }
  }
  
  return result;
}
