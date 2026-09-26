// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Normalizes a chimera_entities row (a "star" chosen in the Casting Circle) into the
 * runtime entity shape { id, type, status, properties } the Director, Engine and
 * Narrator all read. Raw rows keep names/traits under raw_data, so without this the
 * cast members are anonymous to every downstream stage.
 */
export interface RuntimeEntity {
  id: string;
  type: string;
  status: string;
  slug?: string;
  properties: Record<string, unknown>;
  [key: string]: unknown;
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const asStringArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : undefined;

export function normalizeStarEntity(row: Record<string, any>): RuntimeEntity {
  const raw = (row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {}) as Record<string, any>;
  const identity = (raw.identity && typeof raw.identity === 'object' ? raw.identity : {}) as Record<string, any>;

  const name = asString(row.display_name) ?? asString(identity.name) ?? asString(raw.display_name) ?? asString(row.slug) ?? 'Unnamed';
  const description = asString(raw.description) ?? asString(raw.description_short) ?? asString(identity.description);

  const properties: Record<string, unknown> = {
    name,
    display_name: name,
    ...(asString(identity.species) ?? asString(raw.species) ? { species: asString(identity.species) ?? asString(raw.species) } : {}),
    ...(description ? { description } : {}),
    ...(asStringArray(raw.traits) ? { traits: asStringArray(raw.traits) } : {}),
    ...(asStringArray(raw.personality) ? { personality: asStringArray(raw.personality) } : {}),
    ...(asStringArray(raw.ai_hints) ? { ai_hints: asStringArray(raw.ai_hints) } : {}),
    tags: ['star'],
  };

  return {
    id: row.id,
    type: asString(row.entity_type) ?? 'NPC',
    status: 'active',
    ...(row.slug ? { slug: row.slug } : {}),
    properties,
  };
}
