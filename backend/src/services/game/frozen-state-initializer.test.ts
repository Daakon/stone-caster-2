import { readFileSync } from "node:fs";
import {
  readPinnedStateSources,
  stateDefaults,
} from "../../../../shared/src/types/chimera-state-contributions.js";
import { describe, expect, it } from "vitest";
import { applyFrozenStateDefaults } from "./frozen-state-initializer.js";
import type { GameStateBundle } from "../../domain/game-state.types.js";

const makeBundle = (): GameStateBundle => ({
  mechanical: {
    globals: { current_tick: 7 },
    index: { player_id: "player" },
    entities: {
      player: {
        id: "player",
        type: "PLAYER",
        status: "active",
        properties: { current_stamina: 9 },
      },
      npc: {
        id: "npc",
        type: "NPC",
        status: "active",
        properties: { display_name: "Kiera" },
      },
    },
  },
  narrative: {
    scene_context: { name: "Mystika", description: "" },
    entity_visuals: {},
    dialogue_history: [],
  },
  registry: { active_scene_id: "start", entity_locations: {}, node_states: {} },
});

const compiled = {
  source_manifest: [
    { kind: "world", key: "mystika", sha256: "b".repeat(64) },
    { kind: "ruleset", key: "vitality", sha256: "a".repeat(64) },
  ],
  config_mechanics: {
    runtime: {
      state_defaults: {
        tier1_entity: {
          race_handle: "Human",
          current_stamina: 100,
          combat_condition: "Healthy",
        },
        tier1_world: { current_tick: 0, time_band: "scene" },
        tier2_system: { success_bands: { critical: 5 } },
      },
    },
  },
  snapshot_world: {
    key: "mystika",
    character_schema_contributions: {
      tier1_entity: { definitions: { race_handle: { value: "Human" } } },
    },
  },
  config_engine: {
    active_rulesets: [
      {
        key: "vitality",
        content_hash: "a".repeat(64),
        definition: {
          state_contributions: {
            tier1_entity: {
              definitions: {
                current_stamina: { value: 100, target_kind: ["player"] },
                combat_condition: {
                  value: "Healthy",
                  target_kind: ["player", "npc"],
                },
              },
            },
            tier1_world: {
              definitions: {
                current_tick: { value: 0 },
                time_band: { value: "scene" },
              },
            },
            tier2_system: {
              definitions: { success_bands: { value: { critical: 5 } } },
            },
          },
        },
      },
    ],
  },
};

describe("frozen state initialization", () => {
  it("uses pinned definitions for player, NPC, world and system while preserving explicit values", () => {
    const bundle = makeBundle();
    const source = structuredClone(compiled);
    applyFrozenStateDefaults(bundle, compiled);
    expect(bundle.mechanical.entities.player.properties).toMatchObject({
      current_stamina: 9,
      combat_condition: "Healthy",
      race_handle: "Human",
    });
    expect(bundle.mechanical.entities.npc.properties).toMatchObject({
      display_name: "Kiera",
      combat_condition: "Healthy",
      race_handle: "Human",
    });
    expect(
      bundle.mechanical.entities.npc.properties.current_stamina,
    ).toBeUndefined();
    expect(bundle.mechanical.globals).toMatchObject({
      current_tick: 7,
      time_band: "scene",
      tier2_system: { success_bands: { critical: 5 } },
    });
    (bundle.mechanical.globals as any).tier2_system.success_bands.critical = 99;
    expect(compiled).toEqual(source);
  });

  it("rejects a missing starting value before the state can be saved", () => {
    const invalid = structuredClone(compiled);
    delete (
      invalid.config_engine.active_rulesets[0].definition.state_contributions
        .tier1_world.definitions.current_tick as any
    ).value;
    expect(() => applyFrozenStateDefaults(makeBundle(), invalid)).toThrow(
      /ruleset:vitality@.*current_tick has no starting value/,
    );
  });

  it("rejects compiled defaults that disagree with a pinned declaration", () => {
    const invalid = {
      ...structuredClone(compiled),
      config_mechanics: {
        runtime: { state_defaults: { tier1_entity: { current_stamina: 999 } } },
      },
    };
    expect(() => applyFrozenStateDefaults(makeBundle(), invalid)).toThrow(
      /compiled state defaults/,
    );
  });

  it("rejects a non-numeric character override of a declared numeric value", () => {
    const bundle = makeBundle();
    bundle.mechanical.entities.player.properties.current_stamina = "many";
    expect(() => applyFrozenStateDefaults(bundle, compiled)).toThrow(
      /current_stamina/,
    );
  });

  it("rejects unsafe runtime field paths", () => {
    const invalid = structuredClone(compiled);
    Object.defineProperty(
      invalid.config_engine.active_rulesets[0].definition.state_contributions
        .tier1_entity.definitions,
      "__proto__",
      { value: { value: { polluted: true } }, enumerable: true },
    );
    expect(() => applyFrozenStateDefaults(makeBundle(), invalid)).toThrow(
      /__proto__/,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

const catalog = JSON.parse(
  readFileSync(
    new URL("../../../../content/first-party/rulesets.json", import.meta.url),
    "utf8",
  ),
) as {
  items: Array<{
    key: string;
    body: {
      definition: {
        state_contributions?: Record<
          string,
          {
            target_kind?: string[];
            definitions: Record<
              string,
              { value: unknown; target_kind?: string[] }
            >;
          }
        >;
      };
    };
  }>;
};
describe("the reconciled first-party ruleset inventory", () => {
  it.each(catalog.items)(
    "initializes $key in its declared targets and tiers",
    (row) => {
      const frozen = {
        snapshot_world: { key: "test" },
        source_manifest: [
          { kind: "world", key: "test", sha256: "b".repeat(64) },
          { kind: "ruleset", key: row.key, sha256: "a".repeat(64) },
        ],
        config_engine: {
          active_rulesets: [
            {
              key: row.key,
              content_hash: "a".repeat(64),
              definition: row.body.definition,
            },
          ],
        },
        config_mechanics: { runtime: { state_defaults: {} } },
      };
      frozen.config_mechanics.runtime.state_defaults = stateDefaults(
        readPinnedStateSources(frozen),
      );
      const bundle = makeBundle();
      bundle.mechanical.entities.player.properties = {};
      bundle.mechanical.entities.npc.properties = {};
      bundle.mechanical.globals = {};
      const original = structuredClone(frozen);
      applyFrozenStateDefaults(bundle, frozen);
      for (const [scope, section] of Object.entries(
        row.body.definition.state_contributions ?? {},
      ))
        for (const [field, definition] of Object.entries(section.definitions)) {
          if (scope === "tier1_entity")
            for (const kind of ["player", "npc"]) {
              const expected =
                (!section.target_kind || section.target_kind.includes(kind)) &&
                (!definition.target_kind ||
                  definition.target_kind.includes(kind));
              expect(
                bundle.mechanical.entities[kind].properties[field],
              ).toEqual(expected ? definition.value : undefined);
            }
          else if (scope === "tier1_world")
            expect(bundle.mechanical.globals[field]).toEqual(definition.value);
          else
            expect(bundle.mechanical.globals.tier2_system[field]).toEqual(
              definition.value,
            );
        }
      expect(frozen).toEqual(original);
      expect(bundle.mechanical.entities.player.properties.hp).toBeUndefined();
    },
  );
  it("fills absent nested leaves while retaining explicit system values", () => {
    const bundle = makeBundle();
    bundle.mechanical.globals.tier2_system = { success_bands: { critical: 2 } };
    applyFrozenStateDefaults(bundle, compiled);
    expect(bundle.mechanical.globals.tier2_system.success_bands.critical).toBe(
      2,
    );
  });
  it("rejects illegal scope targets, conflicting defaults and missing pins", () => {
    const bad = structuredClone(compiled);
    Object.assign(
      bad.config_engine.active_rulesets[0].definition.state_contributions
        .tier1_entity,
      { target_kind: ["global_rules"] },
    );
    expect(() => applyFrozenStateDefaults(makeBundle(), bad)).toThrow(
      /target_kind/,
    );
    expect(() =>
      applyFrozenStateDefaults(makeBundle(), {
        ...compiled,
        source_manifest: [],
      }),
    ).toThrow(/manifest pin/);
    const conflict = structuredClone(compiled);
    conflict.config_engine.active_rulesets.push({
      ...conflict.config_engine.active_rulesets[0],
      key: "other",
      definition: {
        state_contributions: {
          tier1_entity: {
            definitions: {
              current_stamina: { value: 10, target_kind: ["player"] },
              combat_condition: { value: "Healthy", target_kind: ["npc"] },
            },
          },
          tier1_world: {
            definitions: {
              current_tick: { value: 0 },
              time_band: { value: "scene" },
            },
          },
          tier2_system: {
            definitions: { success_bands: { value: { critical: 5 } } },
          },
        },
      },
    });
    conflict.source_manifest.push({
      kind: "ruleset",
      key: "other",
      sha256: "a".repeat(64),
    });
    expect(() => applyFrozenStateDefaults(makeBundle(), conflict)).toThrow(
      /conflicting starting values/,
    );
  });
});
