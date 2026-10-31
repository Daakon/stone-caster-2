import type { GameStateBundle } from "../../domain/game-state.types.js";
import {
  readPinnedStateSources,
  stateDefaults,
  sameJson,
  startingValue,
} from "../../../../shared/src/types/chimera-state-contributions.js";

/** Initialize from verified frozen declarations before the first save/provider call. */
export function applyFrozenStateDefaults(
  bundle: GameStateBundle,
  compiled: Record<string, unknown>,
): void {
  const sources = readPinnedStateSources(compiled);
  const mechanics = compiled.config_mechanics as
    { runtime?: { state_defaults?: unknown } } | undefined;
  if (!sameJson(mechanics?.runtime?.state_defaults, stateDefaults(sources))) {
    throw Error(
      "Frozen compiled state defaults do not match pinned declarations",
    );
  }
  const playerId = bundle.mechanical.index.player_id;
  if (!bundle.mechanical.entities[playerId])
    throw Error("Initial state has no player entity");
  for (const source of sources) {
    for (const [scope, section] of Object.entries(source.contributions)) {
      const targets: Array<{
        bag: Record<string, unknown>;
        kind: "player" | "npc" | "global_rules";
      }> = [];
      if (scope === "tier1_entity") {
        for (const entity of Object.values(bundle.mechanical.entities)) {
          if (entity.id === playerId || entity.type === "NPC")
            targets.push({
              bag: entity.properties,
              kind: entity.id === playerId ? "player" : "npc",
            });
        }
      } else if (scope === "tier1_world")
        targets.push({ bag: bundle.mechanical.globals, kind: "global_rules" });
      else {
        bundle.mechanical.globals.tier2_system ??= {};
        const system: unknown = bundle.mechanical.globals.tier2_system;
        if (!system || typeof system !== "object" || Array.isArray(system))
          throw Error("Invalid starting system state");
        targets.push({
          bag: system as Record<string, unknown>,
          kind: "global_rules",
        });
      }
      for (const { bag, kind } of targets) {
        if (section.target_kind && !section.target_kind.includes(kind))
          continue;
        for (const [key, field] of Object.entries(section.definitions)) {
          if (field.target_kind && !field.target_kind.includes(kind)) continue;
          const path = `${source.kind}:${source.key}@${source.hash}.${scope}.${key}`;
          const value = startingValue(bag[key], field.value, path);
          const hint = section.form_hints?.[key];
          if (
            typeof value === "number" &&
            ((hint?.min !== undefined && value < hint.min) ||
              (hint?.max !== undefined && value > hint.max))
          )
            throw Error(`${path}: starting value outside declared bounds`);
          bag[key] = value;
        }
      }
    }
  }
}
