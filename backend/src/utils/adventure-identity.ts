import { v5 as uuidv5, validate as uuidValidate } from 'uuid';
import { ContentService, type AdventureData } from '../services/content.service.js';

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
  worldSlug: string;
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

  return {
    id: computeAdventureId(slug),
    slug,
    title,
    description: adventure.description ?? undefined,
    worldSlug: adventure.worldId ?? (adventure as any).world_slug ?? (adventure as any).worldSlug ?? 'unknown',
    tags: Array.isArray(adventure.tags) ? adventure.tags : [],
    scenarios: normaliseScenarios(adventure.scenarios),
  };
}

/**
 * Resolve an adventure by either slug or deterministic UUID.
 * Returns null when the identifier cannot be matched against known content.
 */
export async function resolveAdventureByIdentifier(identifier: string | undefined | null): Promise<ResolvedAdventureIdentity | null> {
  if (!identifier) {
    return null;
  }

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
