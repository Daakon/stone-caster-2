/** Genesis regressions migrated from the retired raw initial_state path. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameInitService } from "./game-init.service.js";
import type { StoriesRepository } from "../../db/repos/stories.repo.js";
import type { NarrativeService } from "./narrative.service.js";
import type { IGameStateRepository } from "./state.repository.interface.js";
import type { GameStateBundle } from "../../domain/game-state.types.js";
import type { CharacterTemplate } from "../../domain/character.types.js";

const storyId = "00000000-0000-4000-8000-000000000001";
const characterId = "00000000-0000-4000-8000-000000000002";
const owner = "00000000-0000-4000-8000-000000000003";
// HP/mana belong only to this explicit custom test ruleset, never core defaults.
const createCompiled = () => ({
  id: storyId,
  snapshot_world: { key: "test" },
  snapshot_entities: [],
  source_manifest: [
    { kind: "world", key: "test", sha256: "b".repeat(64) },
    { kind: "ruleset", key: "custom-test", sha256: "a".repeat(64) },
  ],
  config_engine: {
    active_rulesets: [
      {
        key: "custom-test",
        content_hash: "a".repeat(64),
        definition: {
          state_contributions: {
            tier1_entity: {
              target_kind: ["player"],
              definitions: { hp: { value: 100 }, mana: { value: 50 } },
            },
          },
        },
      },
    ],
  },
  config_mechanics: {
    runtime: { state_defaults: { tier1_entity: { hp: 100, mana: 50 } } },
  },
  genesis_config: {
    location: "A clearing",
    set_design: "Morning light spills between the trees.",
    narrator_tone: "Hopeful",
  },
});

describe("GameInitService", () => {
  let character: CharacterTemplate;
  let compiled: ReturnType<typeof createCompiled>;
  let saved: GameStateBundle | undefined;
  const repository = {
    getCompiledStoryById: vi.fn(),
    getOwnedPlayerCharacter: vi.fn(),
    createGameState: vi.fn(),
    updateGameState: vi.fn(),
    recordTurn: vi.fn(),
  };
  let service: GameInitService;
  const initialize = () =>
    service.initializeGame(
      storyId,
      { identity: { name: "Untrusted request name" } },
      owner,
      characterId,
    );
  const player = () => {
    const entity = saved?.mechanical.entities[characterId];
    if (!entity) throw Error("Expected saved player entity");
    return entity.properties;
  };
  beforeEach(() => {
    vi.clearAllMocks();
    compiled = createCompiled();
    saved = undefined;
    character = {
      id: characterId,
      user_id: owner,
      name: "Test Player",
      state_snapshot: {
        tier1_entity: {
          identity: {
            name: "Test Player",
            pronouns: "they/them",
            role: "Adventurer",
            age: 25,
          },
        },
      },
    };
    repository.getCompiledStoryById.mockResolvedValue(compiled);
    repository.getOwnedPlayerCharacter.mockResolvedValue(character);
    repository.createGameState.mockImplementation(
      (_origin: unknown, bundle: GameStateBundle) => {
        saved = bundle;
        return Promise.resolve("game-state-id");
      },
    );
    service = new GameInitService(
      repository as unknown as StoriesRepository,
      {} as IGameStateRepository,
      {
        generateOpeningNarrative: vi
          .fn()
          .mockResolvedValue("The story begins."),
      } as unknown as NarrativeService,
    );
  });

  describe("Test 1: State Cloning (Deep Copy)", () => {
    it("should create a deep copy of pinned defaults and character values that does not affect the original", async () => {
      const original = structuredClone({ compiled, character });
      repository.createGameState.mockImplementation(
        (_origin: unknown, bundle: GameStateBundle) => {
          saved = bundle;
          const properties = bundle.mechanical.entities[characterId].properties;
          properties.hp = 999;
          properties.identity.pronouns = "mutated";
          return Promise.resolve("game-state-id");
        },
      );
      await initialize();
      expect({ compiled, character }).toEqual(original);
      expect(
        compiled.config_mechanics.runtime.state_defaults.tier1_entity.hp,
      ).toBe(100);
    });
    it("should preserve all declared starting values in the saved state", async () => {
      await initialize();
      expect(player().hp).toBe(100);
      expect(player().mana).toBe(50);
      expect(repository.createGameState).toHaveBeenCalledWith(
        null,
        expect.any(Object),
        owner,
        storyId,
        characterId,
      );
    });
  });
  describe("Test 2: Player Data Injection", () => {
    it("should inject the owned character identity into player properties", async () => {
      await initialize();
      expect(player().identity).toEqual({
        name: "Test Player",
        pronouns: "they/them",
        role: "Adventurer",
        age: 25,
      });
      expect(player().name).toBe("Test Player");
    });
    it("should inject appearance into player narrative visuals", async () => {
      character.state_snapshot.appearance = "Tall and athletic";
      await initialize();
      expect(saved?.narrative.entity_visuals[characterId]).toBe(
        "Tall and athletic",
      );
      expect(player().appearance).toBeUndefined();
    });
    it("should preserve the selected character profile rather than request overrides", async () => {
      Object.assign(character.state_snapshot.tier1_entity ?? {}, {
        backstory: "A mysterious past",
        personality_traits: ["brave", "curious"],
        drive: "Seek the truth",
        flaw: "Too trusting",
      });
      await initialize();
      expect(player().backstory).toBe("A mysterious past");
      expect(player().personality_traits).toEqual(["brave", "curious"]);
      expect(player().drive).toBe("Seek the truth");
      expect(player().flaw).toBe("Too trusting");
    });
  });
  describe("Test 3: Stats Preservation", () => {
    it("should preserve stats declared by a custom compiled ruleset (e.g., hp: 100)", async () => {
      await initialize();
      expect(player().hp).toBe(100);
      expect(player().mana).toBe(50);
    });
    it("should preserve frozen scene configuration in the narrative bundle", async () => {
      await initialize();
      expect(saved?.narrative.scene_context.location).toBe("A clearing");
      expect(saved?.narrative.scene_context.atmosphere).toBe("Hopeful");
      expect(saved?.narrative.director_instructions?.tone).toBe("Hopeful");
      expect(saved?.narrative.dialogue_history).toEqual([
        expect.objectContaining({
          role: "narrator",
          content: "The story begins.",
        }),
      ]);
    });
  });
  describe("World Extensions", () => {
    it("should inject world-specific character extensions into player properties", async () => {
      Object.assign(character.state_snapshot.tier1_entity ?? {}, {
        essence_alignment: "light",
        faction: "Guardians",
      });
      await initialize();
      expect(player().essence_alignment).toBe("light");
      expect(player().faction).toBe("Guardians");
    });
  });
  describe("Error Handling", () => {
    it("should throw error if compiled story not found", async () => {
      repository.getCompiledStoryById.mockResolvedValue(null);
      await expect(initialize()).rejects.toThrow("Compiled story not found");
      expect(repository.createGameState).not.toHaveBeenCalled();
    });
  });
});
