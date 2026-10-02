import { describe, expect, it, vi } from "vitest";
import type { GameStateBundle } from "../../domain/game-state.types.js";
import type { StoriesRepository } from "../../db/repos/stories.repo.js";
import type { IGameStateRepository } from "./state.repository.interface.js";
import type { NarrativeService } from "./narrative.service.js";
import { GameInitService } from "./game-init.service.js";
import {
  stateDefaults,
  readPinnedStateSources,
} from "../../../../shared/src/types/chimera-state-contributions.js";

describe("genesis state before save and opening provider", () => {
  it("saves player/NPC/world/system contributions and explicit overrides before calling the provider", async () => {
    const owner = "00000000-0000-4000-8000-000000000001";
    const characterId = "00000000-0000-4000-8000-000000000002";
    const compiledId = "00000000-0000-4000-8000-000000000003";
    const compiled = {
      id: compiledId,
      snapshot_world: { key: "test", name: "Test" },
      snapshot_entities: [
        {
          key: "npc",
          entity_type: "NPC",
          raw_data: { identity: { name: "Hidden cast name" } },
        },
      ],
      source_manifest: [
        { kind: "world", key: "test", sha256: "b".repeat(64) },
        { kind: "ruleset", key: "test-rule", sha256: "a".repeat(64) },
      ],
      config_engine: {
        active_rulesets: [
          {
            key: "test-rule",
            content_hash: "a".repeat(64),
            definition: {
              state_contributions: {
                tier1_entity: {
                  target_kind: ["player", "npc"],
                  definitions: {
                    score: { value: 50 },
                    condition: { value: "Rested" },
                  },
                },
                tier1_world: { definitions: { time_band: { value: "Dawn" } } },
                tier2_system: {
                  target_kind: ["global_rules"],
                  definitions: {
                    thresholds: { value: { critical: 5, fumble: 96 } },
                  },
                },
              },
            },
          },
        ],
      },
      config_mechanics: { runtime: { state_defaults: {} } },
    };
    compiled.config_mechanics.runtime.state_defaults = stateDefaults(
      readPinnedStateSources(compiled),
    );
    const character = {
      id: characterId,
      user_id: owner,
      name: "Hero",
      state_snapshot: { tier1_entity: { score: 0 } },
    };
    const original = structuredClone({ compiled, character });
    const order: string[] = [];
    let saved: GameStateBundle | undefined;
    const repository = {
      getCompiledStoryById: vi.fn().mockResolvedValue(compiled),
      getOwnedPlayerCharacter: vi.fn().mockResolvedValue(character),
      createGameState: vi.fn(
        (
          _story: unknown,
          bundle: GameStateBundle,
          ownerId: string,
          compiledPin: string,
          characterPin: string,
        ) => {
          expect([ownerId, compiledPin, characterPin]).toEqual([
            owner,
            compiledId,
            characterId,
          ]);
          order.push("save");
          saved = structuredClone(bundle);
          return Promise.resolve("game");
        },
      ),
      updateGameState: vi
        .fn<[string, unknown], Promise<void>>()
        .mockResolvedValue(undefined),
      recordTurn: vi.fn(),
    };
    const narrative = {
      generateOpeningNarrative: vi.fn(() => {
        if (!saved)
          throw Error("Opening provider called before state was saved");
        order.push("provider");
        expect(
          saved.mechanical.entities[characterId]?.properties,
        ).toMatchObject({ score: 0, condition: "Rested" });
        expect(
          Object.values(saved.mechanical.entities).find(
            (entity) => entity.type === "NPC",
          )?.properties,
        ).toMatchObject({ score: 50, condition: "Rested" });
        expect(saved.mechanical.globals).toEqual({
          time_band: "Dawn",
          tier2_system: { thresholds: { critical: 5, fumble: 96 } },
        });
        return Promise.resolve("The sun rises.");
      }),
    };
    const service = new GameInitService(
      repository as unknown as StoriesRepository,
      {} as IGameStateRepository,
      narrative as unknown as NarrativeService,
    );
    expect(
      await service.initializeGame(compiledId, {}, owner, characterId),
    ).toBe("game");
    expect(order).toEqual(["save", "provider"]);
    expect(repository.createGameState.mock.calls[0]?.slice(2)).toEqual([
      owner,
      compiledId,
      characterId,
    ]);
    expect(repository.updateGameState.mock.calls[0]?.[0]).toBe("game");
    expect(repository.updateGameState.mock.calls[0]?.[1]).toMatchObject({
      narrative_focus: { committed_turn: 0 },
    });
    expect({ compiled, character }).toEqual(original);
  });
});
