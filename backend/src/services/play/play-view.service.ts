import { resolveLlmRoleConfig } from "../../config/llm-config.js";
import type { Request } from "express";
import type { GameState } from "../../../../shared/src/types/chimera-runtime.js";
import type { CompiledStory } from "../../../../shared/src/types/chimera-compiled.js";
import {
  PlayViewSchema,
  type PlaySnapshot,
  type PlayView,
  type HudModule,
  type VitalField,
} from "../../../../shared/src/types/chimera-play-view.js";
import {
  readPinnedStateSources,
  type StateSource,
} from "../../../../shared/src/types/chimera-state-contributions.js";
import { PlayViewRepository } from "../../db/repos/play-view.repo.js";

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const label = (value: unknown): string | undefined => {
  const valueText = text(value);
  return valueText &&
    !/^unknown(?:\s|$)/i.test(valueText) &&
    !/^[a-f\d]{8}-[a-f\d-]{27}$/i.test(valueText)
    ? valueText
    : undefined;
};
const humanize = (value: string): string =>
  value
    .replace(/^current_/, "")
    .replace(/^root_/, "")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function modules(
  sources: StateSource[],
  player: Record<string, unknown>,
  globals: Record<string, unknown>,
  playerId: string,
): HudModule[] {
  const result: HudModule[] = [];
  for (const source of sources.filter((source) => source.kind === "ruleset")) {
    const vitals: VitalField[] = [];
    const pillars: VitalField[] = [];
    const conditions: Extract<HudModule, { kind: "conditions" }>["fields"] = [];
    const values: Extract<HudModule, { kind: "values" }>["fields"] = [];
    for (const [scope, section] of Object.entries(source.contributions)) {
      if (
        scope === "tier2_system" ||
        (section.target_kind &&
          !section.target_kind.includes(
            scope === "tier1_entity" ? "player" : "global_rules",
          ))
      )
        continue;
      for (const [key, field] of Object.entries(section.definitions)) {
        if (
          field.target_kind &&
          !field.target_kind.includes(
            scope === "tier1_entity" ? "player" : "global_rules",
          )
        )
          continue;
        // System internals and private global fields have no interim HUD contract.
        if (
          field.context_priority === "system_hidden" ||
          (scope === "tier1_world" &&
            !["time_band", "current_tick"].includes(key))
        )
          continue;
        const hint = section.form_hints?.[key];
        if (hint?.control === "hidden") continue;
        const value = (scope === "tier1_entity" ? player : globals)[key];
        if (value === undefined || value === null) continue;
        const path =
          scope === "tier1_entity"
            ? `mechanical_state.entities.${playerId}.properties.${key}`
            : `mechanical_state.globals.${key}`;
        const base = {
          id: key,
          label:
            key === "current_stamina"
              ? "Stamina"
              : source.key === "d100-5-pillars"
                ? humanize(key)
                : hint?.label || humanize(key),
          path,
        };
        if (typeof value === "number" && Number.isFinite(value)) {
          if (
            key === "current_stamina" ||
            key === "satiety" ||
            (source.key === "d100-5-pillars" && key.startsWith("root_"))
          ) {
            const numeric: VitalField = {
              ...base,
              value,
              tone: key === "current_stamina" ? "stamina" : "accent",
              ...(hint?.max !== undefined && hint.max > 0
                ? { max: hint.max }
                : {}),
            };
            (key.startsWith("root_") ? pillars : vitals).push(numeric);
          } else values.push({ ...base, value });
        } else if (typeof value === "string" && value.trim()) {
          if (
            ["physical_condition", "combat_condition", "hunger_state"].includes(
              key,
            )
          )
            conditions.push({ ...base, value });
          else values.push({ ...base, value });
        } else if (typeof value === "boolean")
          values.push({ ...base, value: String(value) });
        else if (
          Array.isArray(value) &&
          value.length &&
          value.every((item) => typeof item === "string")
        )
          values.push({ ...base, value: value.join(", ") });
      }
    }
    if (vitals.length)
      result.push({
        id: `${source.key}.vitals`,
        kind: "vitals",
        label: "Vitals",
        source: source.key,
        fields: vitals,
      });
    if (conditions.length)
      result.push({
        id: `${source.key}.conditions`,
        kind: "conditions",
        label: "Conditions",
        source: source.key,
        fields: conditions,
      });
    if (pillars.length)
      result.push({
        id: `${source.key}.pillars`,
        kind: "pillars",
        label: "Pillars",
        source: source.key,
        fields: pillars,
      });
    if (values.length)
      result.push({
        id: `${source.key}.values`,
        kind: "values",
        label: source.key === "wealth-capability-lite" ? "Means" : "Character",
        source: source.key,
        fields: values,
      });
  }
  return result;
}

function presence(
  entities: Record<string, unknown>,
  registry: Record<string, unknown>,
  playerId: string,
): PlayView["presence"] {
  const active = text(registry.active_scene_id);
  if (!active) return undefined;
  const locations = record(registry.entity_locations);
  const cast: NonNullable<PlayView["presence"]>["cast"] = [];
  let undisclosed = false;
  for (const [id, raw] of Object.entries(entities)) {
    const entity = record(raw);
    if (
      id === playerId ||
      entity.type !== "NPC" ||
      entity.status !== "active" ||
      locations[id] !== active
    )
      continue;
    const props = record(entity.properties);
    const identified = props.is_known === true;
    // A selected entity's true/display name is not evidence it has been learned.
    const name = label(
      identified ? props.name : (props.visual_name ?? props.visual_alias),
    );
    if (!name) {
      undisclosed = true;
      continue;
    }
    cast.push({ id, name, identified });
  }
  if (cast.length) return { availability: "available", cast };
  return undisclosed ? undefined : { availability: "empty", cast: [] };
}

function transcript(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const row = record(raw);
    if (row.role !== "player" && row.role !== "narrator") return [];
    let content = text(row.content ?? row.text);
    if (!content) return [];
    if (/^[{[]/.test(content)) {
      try {
        content = text(record(JSON.parse(content)).narration);
      } catch {
        return [];
      }
    }
    if (
      !content ||
      content.includes("[THOUGHT]") ||
      /NARRATOR LENS|DIRECTOR'S NOTE|^ROLE:/m.test(content)
    )
      return [];
    const entryId = text(row.id);
    const timestamp = text(row.timestamp);
    return [
      {
        role: row.role,
        content,
        ...(entryId ? { id: entryId } : {}),
        ...(timestamp ? { timestamp } : {}),
      },
    ];
  });
}

export function projectPlaySnapshot(
  state: GameState,
  compiled: CompiledStory,
): PlaySnapshot {
  if (
    compiled.id !== state.compiled_story_id ||
    state.state_initialization_version !== 1
  )
    throw Error("Invalid frozen session pin");
  const sources = readPinnedStateSources(compiled);
  const mechanical = record(state.mechanical_state);
  const playerId = text(record(mechanical.index).player_id);
  if (playerId !== state.player_character_id)
    throw Error("Invalid selected character pin");
  const entities = record(mechanical.entities);
  const player = record(record(entities[playerId]).properties);
  const globals = record(mechanical.globals);
  const narrative = record(state.narrative_focus);
  const scene = record(narrative.scene_context);
  const timeDeclared = sources.some(
    (source) => source.contributions.tier1_world?.definitions.time_band,
  );
  const view = PlayViewSchema.parse({
    version: 1,
    title: compiled.frozen_title,
    rulesets: sources
      .filter((source) => source.kind === "ruleset")
      .map((source) => source.key),
    ...(Number.isInteger(narrative.committed_turn) &&
    Number(narrative.committed_turn) >= 0
      ? { committed_turn: narrative.committed_turn }
      : {}),
    ...(text(player.name) ? { player: { name: text(player.name) } } : {}),
    scene: {
      name: label(scene.location_name ?? scene.location),
      time: label(timeDeclared ? globals.time_band : scene.time),
      atmosphere: label(scene.atmosphere),
    },
    presence: presence(entities, state.scene_registry, playerId),
    modules: modules(sources, player, globals, playerId),
  });
  const safeProperties: Record<string, string | number> = {};
  for (const module of view.modules)
    for (const field of module.fields) {
      if (
        field.path.startsWith(
          `mechanical_state.entities.${playerId}.properties.`,
        )
      )
        safeProperties[field.id] = field.value;
    }
  if (view.player) safeProperties.name = view.player.name;
  return {
    id: state.id,
    story_id: state.story_id,
    player_id: state.player_id,
    compiled_story_id: state.compiled_story_id,
    player_character_id: state.player_character_id,
    state_initialization_version: state.state_initialization_version,
    updated_at: state.updated_at,
    play_view: view,
    mechanical_state: {
      index: { player_id: playerId },
      entities: {
        [playerId]: {
          id: playerId,
          type: "PLAYER",
          properties: safeProperties,
        },
      },
    },
    narrative_focus: {
      scene_context: {
        location: view.scene?.name,
        time: view.scene?.time,
        atmosphere: view.scene?.atmosphere,
      },
      dialogue_history: transcript(narrative.dialogue_history),
    },
    scene_registry: {},
    action_queue: state.action_queue.filter(
      (value) => typeof value === "string",
    ),
  };
}

export class PlayViewService {
  constructor(
    private readonly repository: Pick<
      PlayViewRepository,
      "loadOwnedSession" | "loadPinnedCompile"
    >,
    private readonly mock = false,
  ) {}
  static forRequest(request: Request): PlayViewService {
    return new PlayViewService(
      PlayViewRepository.forRequest(request),
      resolveLlmRoleConfig("director").provider === "mock",
    );
  }
  async load(id: string, userId: string): Promise<PlaySnapshot | null> {
    const state = await this.repository.loadOwnedSession(id, userId);
    if (!state) return null;
    if (state.player_id !== userId) return null;
    const compiled = await this.repository.loadPinnedCompile(
      state.compiled_story_id,
    );
    if (!compiled) throw Error("Pinned compiled story not found");
    const snapshot = projectPlaySnapshot(state, compiled);
    if (this.mock)
      snapshot.action_queue = [
        "test_combat",
        "test_social",
        "test_mixed",
        "test_travel",
        "test_drunk_combat",
        "test_protective_combat",
      ];
    return snapshot;
  }
}
