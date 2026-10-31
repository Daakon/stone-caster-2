import { describe, expect, it, vi } from "vitest";
import { GameStateSchema } from "../../../../shared/src/types/chimera-runtime.js";
import { CompiledStorySchema } from "../../../../shared/src/types/chimera-compiled.js";
import { PlayViewService, projectPlaySnapshot } from "./play-view.service.js";

const id = (suffix: string) =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const player = id("1");
const npc = id("2");
const ruleHash = "a".repeat(64);
const compiled = CompiledStorySchema.parse({
  id: id("3"),
  frozen_title: "Pinned story",
  snapshot_world: { key: "test" },
  snapshot_entities: [],
  source_manifest: [
    { kind: "world", key: "test", sha256: "b".repeat(64) },
    { kind: "ruleset", key: "vitality-stamina-system", sha256: ruleHash },
  ],
  config_engine: {
    active_rulesets: [
      {
        key: "vitality-stamina-system",
        content_hash: ruleHash,
        definition: {
          state_contributions: {
            tier1_entity: {
              target_kind: ["player", "npc"],
              definitions: {
                current_stamina: { value: 100 },
                physical_condition: { value: "Rested" },
              },
              form_hints: { current_stamina: { max: 100 } },
            },
          },
        },
      },
    ],
  },
});
const state = () =>
  GameStateSchema.parse({
    id: id("4"),
    player_id: id("5"),
    compiled_story_id: compiled.id,
    player_character_id: player,
    state_initialization_version: 1,
    compiled_system_prompt: "SECRET PROMPT",
    mechanical_state: {
      index: { player_id: player },
      globals: { secret: "HIDDEN" },
      entities: {
        [player]: {
          id: player,
          type: "PLAYER",
          properties: {
            name: "Hero",
            current_stamina: 0,
            physical_condition: "Tired",
            hp: 999,
          },
        },
        [npc]: {
          id: npc,
          type: "NPC",
          status: "active",
          properties: {
            name: "Secret true name",
            display_name: "Secret true name",
            visual_name: "A cloaked traveller",
            is_known: false,
            plot_agenda: "Secret agenda",
          },
        },
      },
    },
    narrative_focus: {
      committed_turn: 2,
      scene_context: {
        location: "The crossroads",
        time: "Dusk",
        hidden: "Secret location",
      },
      director_instructions: { hidden: "SECRET" },
      dialogue_history: [
        {
          role: "narrator",
          content: "The road forks.",
          thought_chain: "SECRET",
        },
        { role: "system", content: "Secret true name Trust +10" },
        {
          role: "narrator",
          content: JSON.stringify({
            narration: "Footsteps approach.",
            thought_chain: "SECRET",
          }),
        },
      ],
    },
    scene_registry: {
      active_scene_id: "crossroads",
      entity_locations: { [npc]: "crossroads" },
      node_states: { hidden: "SECRET" },
    },
  });

describe("hash-pinned player play projection", () => {
  it("renders declared actual values, including zero, and no invented Health or raw NPC state", () => {
    const result = projectPlaySnapshot(state(), compiled);
    expect(result.play_view.title).toBe("Pinned story");
    expect(result.play_view.committed_turn).toBe(2);
    expect(result.play_view.modules[0]?.fields[0]).toMatchObject({
      value: 0,
      max: 100,
    });
    expect(result.play_view.presence?.cast).toEqual([
      { id: npc, name: "A cloaked traveller", identified: false },
    ]);
    const encoded = JSON.stringify(result);
    for (const secret of [
      "SECRET",
      "Secret true name",
      "Secret agenda",
      "Secret location",
      "999",
      "compiled_system_prompt",
    ])
      expect(encoded).not.toContain(secret);
    expect(result.narrative_focus.dialogue_history).toEqual([
      { role: "narrator", content: "The road forks." },
      { role: "narrator", content: "Footsteps approach." },
    ]);
  });

  it("omits absent declared values and unknown metadata, without installing defaults", () => {
    const snapshot = state();
    snapshot.mechanical_state = {
      index: { player_id: player },
      entities: { [player]: { properties: { name: "Hero" } } },
    };
    snapshot.narrative_focus = {
      scene_context: { location: "Unknown Location", time: id("9") },
    };
    const view = projectPlaySnapshot(snapshot, compiled).play_view;
    expect(view.modules).toEqual([]);
    expect(view.scene).toBeUndefined();
    expect(view.committed_turn).toBeUndefined();
  });

  it("distinguishes empty presence from undisclosed aliases and never treats selection as learned identity", () => {
    const snapshot = state();
    snapshot.scene_registry = {
      active_scene_id: "elsewhere",
      entity_locations: { [npc]: "crossroads" },
    };
    expect(projectPlaySnapshot(snapshot, compiled).play_view.presence).toEqual({
      availability: "empty",
      cast: [],
    });
    snapshot.scene_registry = {
      active_scene_id: "crossroads",
      entity_locations: { [npc]: "crossroads" },
    };
    const mechanical = snapshot.mechanical_state;
    const entities = mechanical.entities as Record<
      string,
      { properties: Record<string, unknown> }
    >;
    const npcEntity = entities[npc];
    if (!npcEntity) throw Error("NPC fixture missing");
    delete npcEntity.properties.visual_name;
    expect(
      projectPlaySnapshot(snapshot, compiled).play_view.presence,
    ).toBeUndefined();
    npcEntity.properties.is_known = true;
    expect(
      projectPlaySnapshot(snapshot, compiled).play_view.presence?.cast[0],
    ).toMatchObject({ name: "Secret true name", identified: true });
  });

  it("rejects a mismatched manifest and an invalid session pin", () => {
    expect(() =>
      projectPlaySnapshot(state(), { ...compiled, id: id("99") }),
    ).toThrow(/pin/);
    expect(() =>
      projectPlaySnapshot(state(), { ...compiled, source_manifest: [] }),
    ).toThrow(/manifest pin/);
  });

  it("verifies ownership before loading the pinned compile", async () => {
    const repository = {
      loadOwnedSession: vi.fn().mockResolvedValue(null),
      loadPinnedCompile: vi.fn(),
    };
    expect(
      await new PlayViewService(repository).load(id("4"), id("8")),
    ).toBeNull();
    expect(repository.loadOwnedSession).toHaveBeenCalledWith(id("4"), id("8"));
    expect(repository.loadPinnedCompile).not.toHaveBeenCalled();
    repository.loadOwnedSession.mockResolvedValue(state());
    repository.loadPinnedCompile.mockResolvedValue(compiled);
    expect(
      (await new PlayViewService(repository).load(id("4"), id("5")))?.play_view
        .title,
    ).toBe("Pinned story");
    expect(repository.loadPinnedCompile).toHaveBeenCalledWith(compiled.id);
  });
  it("projects only declared player/world fields across rule mixes and hides system/NPC-only fields", () => {
    const definition = {
      state_contributions: {
        tier1_entity: {
          target_kind: ["player"],
          definitions: {
            current_stamina: { value: 100 },
            satiety: { value: 80 },
            root_force: { value: 50 },
            combat_condition: { value: "Healthy" },
            wealth_tier: { value: "Modest" },
            prepared: { value: false },
            archetype_loadout: { value: ["Sword"] },
            secret: { value: "hidden", context_priority: "system_hidden" },
            hidden_control: { value: 1 },
            npc_only: { value: 20, target_kind: ["npc"] },
            unsupported: { value: {} },
            empty: { value: [] },
            nullable: { value: null },
          },
          form_hints: {
            current_stamina: { max: 100 },
            root_force: { max: 100 },
            hidden_control: { control: "hidden" },
          },
        },
        tier1_world: {
          target_kind: ["global_rules"],
          definitions: {
            time_band: { value: "Dawn" },
            current_tick: { value: 0 },
            engine_secret: { value: 1 },
          },
        },
        tier2_system: { definitions: { private_threshold: { value: 10 } } },
      },
    };
    const source = (key: string) => ({
      key,
      content_hash: ruleHash,
      definition,
    });
    const frozen = CompiledStorySchema.parse({
      ...compiled,
      config_engine: {
        active_rulesets: [
          source("d100-5-pillars"),
          source("wealth-capability-lite"),
        ],
      },
      source_manifest: [
        { kind: "world", key: "test", sha256: "b".repeat(64) },
        ...["d100-5-pillars", "wealth-capability-lite"].map((key) => ({
          kind: "ruleset",
          key,
          sha256: ruleHash,
        })),
      ],
    });
    const snapshot = state();
    snapshot.mechanical_state = {
      index: { player_id: player },
      globals: { time_band: "Midday", current_tick: 3, engine_secret: 99 },
      entities: {
        [player]: {
          properties: {
            current_stamina: 12,
            satiety: 0,
            root_force: 62,
            combat_condition: "Wounded",
            wealth_tier: "Wealthy",
            prepared: false,
            archetype_loadout: ["Sword", "Shield"],
            secret: "PRIVATE",
            hidden_control: 9,
            npc_only: 99,
            unsupported: { nested: 1 },
            empty: [],
            nullable: null,
          },
        },
      },
    };
    const view = projectPlaySnapshot(snapshot, frozen).play_view;
    expect(view.scene?.time).toBe("Midday");
    expect(
      view.modules.find((module) => module.kind === "pillars")?.fields[0],
    ).toMatchObject({ id: "root_force", value: 62, max: 100 });
    expect(
      view.modules.find((module) => module.label === "Means")?.fields,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "wealth_tier", value: "Wealthy" }),
        expect.objectContaining({ id: "prepared", value: "false" }),
        expect.objectContaining({
          id: "archetype_loadout",
          value: "Sword, Shield",
        }),
        expect.objectContaining({ id: "current_tick", value: 3 }),
      ]),
    );
    const visibleIds = view.modules.flatMap((module) =>
      module.fields.map((field) => field.id),
    );
    for (const key of [
      "secret",
      "hidden_control",
      "npc_only",
      "unsupported",
      "empty",
      "nullable",
      "private_threshold",
    ])
      expect(visibleIds).not.toContain(key);
    // A ruleset with only NPC contributions has no player HUD module.
    definition.state_contributions.tier1_entity.target_kind = ["npc"];
    const npcFrozen = CompiledStorySchema.parse({
      ...frozen,
      config_engine: { active_rulesets: [source("d100-5-pillars")] },
      source_manifest: frozen.source_manifest,
    });
    expect(
      projectPlaySnapshot(snapshot, npcFrozen)
        .play_view.modules.flatMap((module) => module.fields)
        .every((field) => field.path.startsWith("mechanical_state.globals.")),
    ).toBe(true);
  });

  it("omits unsupported presence and internal transcript forms", () => {
    const snapshot = state();
    snapshot.scene_registry = {};
    snapshot.narrative_focus = {
      dialogue_history: [
        {
          role: "player",
          text: "I look around.",
          id: "entry",
          timestamp: "now",
        },
        { role: "narrator", content: "[THOUGHT] private" },
        { role: "narrator", content: "ROLE: Director" },
        { role: "narrator", content: "{invalid" },
        { role: "narrator", content: '{"thought_chain":"private"}' },
        { role: "narrator", content: "" },
        null,
      ],
    };
    const result = projectPlaySnapshot(snapshot, compiled);
    expect(result.play_view.presence).toBeUndefined();
    expect(result.narrative_focus.dialogue_history).toEqual([
      {
        role: "player",
        content: "I look around.",
        id: "entry",
        timestamp: "now",
      },
    ]);
    snapshot.narrative_focus.dialogue_history = null;
    expect(
      projectPlaySnapshot(snapshot, compiled).narrative_focus.dialogue_history,
    ).toEqual([]);
    snapshot.player_character_id = id("99");
    expect(() => projectPlaySnapshot(snapshot, compiled)).toThrow(
      /character pin/,
    );
  });

  it("does not load a compile for another owner, rejects a missing pinned row, and confines test actions to mock mode", async () => {
    const repository = {
      loadOwnedSession: vi.fn().mockResolvedValue(state()),
      loadPinnedCompile: vi.fn().mockResolvedValue(null),
    };
    expect(
      await new PlayViewService(repository).load(id("4"), id("8")),
    ).toBeNull();
    expect(repository.loadPinnedCompile).not.toHaveBeenCalled();
    await expect(
      new PlayViewService(repository).load(id("4"), id("5")),
    ).rejects.toThrow("Pinned compiled story not found");
    repository.loadPinnedCompile.mockResolvedValue(compiled);
    expect(
      (await new PlayViewService(repository).load(id("4"), id("5")))
        ?.action_queue,
    ).toEqual([]);
    expect(
      (await new PlayViewService(repository, true).load(id("4"), id("5")))
        ?.action_queue,
    ).toContain("test_social");
  });
});
