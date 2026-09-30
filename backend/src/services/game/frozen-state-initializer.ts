import type { GameStateBundle, ActiveEntity } from '../../domain/game-state.types.js';

type JsonObject = Record<string, any>;

const object = (value: unknown): JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;

function appliesTo(value: unknown, kind: 'player' | 'npc', source: string): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.some((entry) => entry !== 'player' && entry !== 'npc')) {
    throw new Error(`${source} has invalid target_kind`);
  }
  return value.includes(kind);
}

function fillDefinitions(target: JsonObject, contribution: unknown, kind: 'player' | 'npc' | null, source: string): void {
  const section = object(contribution);
  if (!section) throw new Error(`${source} must be an object`);
  if (kind && !appliesTo(section.target_kind, kind, source)) return;
  const definitions = object(section.definitions);
  if (!definitions) throw new Error(`${source}.definitions must be an object`);
  for (const [field, raw] of Object.entries(definitions)) {
    const definition = object(raw);
    if (!definition || !Object.hasOwn(definition, 'value') || definition.value === undefined) {
      throw new Error(`${source}.definitions.${field} has no starting value`);
    }
    if (kind && !appliesTo(definition.target_kind, kind, `${source}.definitions.${field}`)) continue;
    if (target[field] === undefined) target[field] = structuredClone(definition.value);
  }
}

/** Apply only validated values from the hash-pinned compiled payload. */
export function applyFrozenStateDefaults(bundle: GameStateBundle, compiled: JsonObject): void {
  const playerId = bundle.mechanical.index.player_id;
  const player = bundle.mechanical.entities[playerId];
  if (!player) throw new Error('Initial state has no player entity');
  const rulesets = compiled.config_engine?.active_rulesets;
  if (!Array.isArray(rulesets) || rulesets.length === 0) throw new Error('Frozen compile has no active ruleset definitions');

  const sources: Array<{key: string; contributions: unknown}> = [
    {key: `world:${compiled.snapshot_world?.key ?? 'unknown'}`, contributions: compiled.snapshot_world?.character_schema_contributions ?? {}},
    ...rulesets.map((entry: unknown) => {
      const row = object(entry);
      if (!row || typeof row.key !== 'string' || !object(row.definition) || typeof row.content_hash !== 'string') {
        throw new Error('Frozen compile contains an invalid ruleset definition or hash');
      }
      return {key: `ruleset:${row.key}@${row.content_hash}`, contributions: row.definition.state_contributions ?? {}};
    }),
  ];

  for (const source of sources) {
    const contributions = object(source.contributions);
    if (!contributions) throw new Error(`${source.key} has invalid state contributions`);
    for (const [scope, section] of Object.entries(contributions)) {
      if (scope === 'tier1_entity') {
        fillDefinitions(player.properties, section, 'player', `${source.key}.${scope}`);
        for (const entity of Object.values(bundle.mechanical.entities) as ActiveEntity[]) {
          if (entity.id !== playerId && entity.type === 'NPC') {
            fillDefinitions(entity.properties, section, 'npc', `${source.key}.${scope}`);
          }
        }
      } else if (scope === 'tier1_world') {
        fillDefinitions(bundle.mechanical.globals, section, null, `${source.key}.${scope}`);
      } else if (scope === 'tier2_system') {
        const globals = bundle.mechanical.globals as JsonObject;
        globals.tier2_system ??= {};
        fillDefinitions(globals.tier2_system, section, null, `${source.key}.${scope}`);
      } else {
        throw new Error(`${source.key} has unsupported state scope ${scope}`);
      }
    }
  }
}
