import { v5 as uuidv5, validate as uuidValidate } from 'uuid';
import { ContentService, type AdventureData } from '../services/content.service.js';
import { supabaseAdmin } from '../services/supabase.js';

/**
 * Namespace UUID for deterministic adventure IDs.
 * This value must remain stable across deployments so that the same slug
 * always produces the same identifier.
 */
export const ADVENTURE_ID_NAMESPACE = '4fa1c4c6-9f3d-4a3f-8c44-0f7b7a6b2d6b';

export interface ResolvedAdventureIdentity {
  id: string;
  slug: string;
  title: string;
  description?: string;
  worldId: string; // World UUID (FK to world_id_mapping.uuid_id)
  worldSlug?: string; // World text slug (for display only, optional)
  tags: string[];
  scenarios: string[];
}

/**
 * Compute a deterministic UUID for a given adventure slug.
 */
export function computeAdventureId(slug: string): string {
  return uuidv5(slug, ADVENTURE_ID_NAMESPACE);
}

/**
 * Normalise the adventure scenarios to an array of strings.
 */
function normaliseScenarios(input: AdventureData['scenarios']): string[] {
  if (!input) {
    return [];
  }

  return input
    .map((scenario: any) => {
      if (typeof scenario === 'string') {
        return scenario;
      }
      if (scenario && typeof scenario === 'object') {
        return scenario.name ?? scenario.slug ?? '';
      }
      return '';
    })
    .filter((value: string) => Boolean(value));
}

/**
 * Map an AdventureData record into a resolved identity object.
 */
function mapAdventureData(adventure: AdventureData): ResolvedAdventureIdentity {
  const slug = adventure.slug ?? adventure.id;
  const title = adventure.title ?? adventure.name ?? slug;
  const worldIdentifier = adventure.worldId ?? (adventure as any).world_slug ?? (adventure as any).worldSlug ?? 'unknown';

  return {
    id: computeAdventureId(slug),
    slug,
    title,
    description: adventure.description ?? undefined,
    worldId: worldIdentifier, // For static content, this might be TEXT (needs mapping lookup)
    worldSlug: worldIdentifier, // Keep for display
    tags: Array.isArray(adventure.tags) ? adventure.tags : [],
    scenarios: normaliseScenarios(adventure.scenarios),
  };
}

/**
 * Resolve an adventure/entry_point by either slug or deterministic UUID.
 * First checks the database entry_points table, then falls back to static content.
 * Returns null when the identifier cannot be matched against known content.
 */
export async function resolveAdventureByIdentifier(identifier: string | undefined | null): Promise<ResolvedAdventureIdentity | null> {
  if (!identifier) {
    return null;
  }

  // First, try to find in entry_points table (database)
  try {
    const { data: entryPoint, error } = await supabaseAdmin
      .from('entry_points')
      .select('id, slug, title, description, synopsis, world_id, tags')
      .or(`id.eq.${identifier},slug.eq.${identifier}`)
      .eq('lifecycle', 'active')
      .limit(1)
      .single();

    if (!error && entryPoint) {
      // entry_points.world_id is UUID (FK to world_id_mapping.uuid_id)
      console.log('[ENTRY_POINT_DB_RAW]', {
        id: entryPoint.id,
        slug: entryPoint.slug,
        world_id: entryPoint.world_id,
      });
      
      // Map entry_point to ResolvedAdventureIdentity format
      return {
        id: entryPoint.id,
        slug: entryPoint.slug || entryPoint.id,
        title: entryPoint.title,
        description: entryPoint.description || entryPoint.synopsis || undefined,
        worldId: entryPoint.world_id, // UUID (FK to world_id_mapping)
        tags: Array.isArray(entryPoint.tags) ? entryPoint.tags : [],
        scenarios: [], // entry_points don't have scenarios array
      };
    }
  } catch (dbError) {
    console.error('Error querying entry_points:', dbError);
    // Continue to fallback
  }

  // Fallback to static content (legacy adventures)
  const adventures = await ContentService.getAdventures();

  if (!uuidValidate(identifier)) {
    const bySlug = adventures.find((candidate) => candidate.slug === identifier || candidate.id === identifier);
    return bySlug ? mapAdventureData(bySlug) : null;
  }

  const byUuid = adventures.find((candidate) => computeAdventureId(candidate.slug ?? candidate.id) === identifier);
  if (!byUuid) {
    return null;
  }

  return mapAdventureData(byUuid);
}
