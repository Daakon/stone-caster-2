// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Shared scene helpers for the Director, Engine bridge and Narrator:
 * entity naming, who is present with the player, and location changes.
 *
 * Presence is tracked in registry.entity_locations (entity id -> location key). Everyone
 * starts at the same key; when the Director rules that the player moved, the player (and
 * any companions the Director names) get a new key and everyone else stays behind.
 */

/** Best available display name for a runtime entity (properties first, then raw DB row shapes). */
export function entityDisplayName(entity: any, fallback: string): string {
  const raw = entity?.raw_data ?? {};
  const candidates = [
    entity?.properties?.display_name, entity?.properties?.name, entity?.display_name,
    raw?.identity?.name, raw?.display_name, entity?.slug,
  ];
  return candidates.find((c) => typeof c === 'string' && c.trim()) ?? fallback;
}

/** Entities map + player id from either the turn pipeline shape or the legacy shape. */
export function readSceneEntities(gameState: any): { entities: Record<string, any>; playerId?: string } {
  const mechanical = gameState?.tier1_mechanical || gameState?.mechanical_state || {};
  return {
    entities: mechanical.entities || mechanical.tier1_entities || {},
    playerId: gameState?.player_id || mechanical.index?.player_id || undefined,
  };
}

function readLocations(gameState: any): Record<string, string> {
  return gameState?.tier2_spatial?.entity_locations || gameState?.scene_registry?.entity_locations || {};
}

/** Ids of entities in the same place as the player (entities with no recorded location count as present). */
export function presentEntityIds(gameState: any): string[] {
  const { entities, playerId } = readSceneEntities(gameState);
  const locations = readLocations(gameState);
  const here = playerId ? locations[playerId] : undefined;
  return Object.keys(entities).filter((id) => !here || (locations[id] ?? here) === here);
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'somewhere';

/**
 * Applies the Director's location_change to a state bundle IN PLACE:
 * scene_context.location changes, the player + named companions move, everyone else stays.
 * Returns true when a move was applied.
 */
export function applyLocationChange(
  bundle: { mechanical?: any; narrative?: any; registry?: any },
  change: { name?: string; companions?: string[] } | undefined
): boolean {
  const name = change?.name?.trim();
  const playerId = bundle.mechanical?.index?.player_id;
  if (!name || !playerId || !bundle.narrative) return false;

  if (!bundle.registry) bundle.registry = {};
  const locations: Record<string, string> = (bundle.registry.entity_locations ||= {});
  const names: Record<string, string> = (bundle.registry.location_names ||= {});
  const entities = bundle.mechanical?.entities || {};

  // Everyone with no recorded location is where the story started; pin them before anyone leaves
  const start = locations[playerId] ?? 'start_node';
  for (const id of Object.keys(entities)) locations[id] ??= start;
  // Remember what the current place is called so that coming back to it reuses its key
  const currentName = bundle.narrative.scene_context?.location;
  if (currentName && !names[start]) names[start] = currentName;

  const wanted = slug(name);
  const key = Object.keys(names).find((k) => slug(names[k]) === wanted) ?? `loc:${wanted}`;
  names[key] ??= name;

  if (locations[playerId] === key) return false; // already there

  locations[playerId] = key;
  for (const id of change?.companions ?? []) {
    if (entities[id] && id !== playerId) locations[id] = key;
  }
  bundle.narrative.scene_context = { ...(bundle.narrative.scene_context || {}), location: name };
  return true;
}
