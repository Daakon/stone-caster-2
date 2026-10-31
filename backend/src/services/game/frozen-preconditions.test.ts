import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoriesRepository } from "../../db/repos/stories.repo.js";
import { GameInitService } from "./game-init.service.js";
import { GameTurnService } from "./game-turn.service.js";
import { NarrativeService } from "./narrative.service.js";
import { DirectorService } from "../runtime/director.service.js";
import { Mas2Service } from "../runtime/mas2.service.js";
import { LlmService } from "../llm/llm.service.js";
import { EntitlementsRepository } from "../../db/repos/entitlements.repo.js";

const playerId = "00000000-0000-4000-8000-00000000a001";
const characterId = "00000000-0000-4000-8000-00000000b001";
const compiledId = "00000000-0000-4000-8000-00000000c001";

describe("frozen session preconditions before any AI provider call", () => {
  const calls = vi.fn(async () => ({}));
  let textCalls: ReturnType<typeof vi.spyOn>;
  const provider = { generateJson: calls };
  const llm = new LlmService(provider as any);
  const narrative = new NarrativeService(llm);
  const compiled = {
    source_manifest: [
      { kind: "world", key: "mystika", sha256: "b".repeat(64) },
      { kind: "ruleset", key: "vitality", sha256: "a".repeat(64) },
    ],
    config_mechanics: {
      runtime: { state_defaults: { tier1_entity: { current_stamina: 100 } } },
    },
    id: compiledId,
    snapshot_entities: [],
    snapshot_world: { key: "mystika", name: "Mystika" },
    prompt_interpreter_logic: "OLD PINNED PROMPT",
    prompt_narrator_style: "OLD PINNED STYLE",
    config_engine: {
      active_rulesets: [
        {
          key: "vitality",
          content_hash: "a".repeat(64),
          definition: {
            state_contributions: {
              tier1_entity: {
                definitions: { current_stamina: { value: 100 } },
              },
            },
          },
        },
      ],
    },
  };

  beforeEach(() => {
    calls.mockClear();
    textCalls = vi
      .spyOn(LlmService.prototype, "generateText")
      .mockResolvedValue("unused");
  });
  afterEach(() => vi.restoreAllMocks());

  const init = () => {
    const storiesRepo = {
      getCompiledStoryById: vi.fn().mockResolvedValue(compiled),
      createGameState: vi.fn(),
      getOwnedPlayerCharacter: vi.fn().mockResolvedValue({
        id: characterId,
        user_id: playerId,
        name: "Hero",
        state_snapshot: {},
      }),
    };
    const service = new GameInitService(
      storiesRepo as any,
      {} as any,
      narrative,
    );
    return { service, storiesRepo };
  };

  it("rejects a missing required state path without saving or calling the provider", async () => {
    const { service, storiesRepo } = init();
    const bad = structuredClone(compiled);
    delete (
      bad.config_engine.active_rulesets[0].definition.state_contributions
        .tier1_entity.definitions.current_stamina as any
    ).value;
    storiesRepo.getCompiledStoryById.mockResolvedValue(bad);
    await expect(
      service.initializeGame(compiledId, {}, playerId, characterId),
    ).rejects.toThrow(/current_stamina has no starting value/);
    expect(storiesRepo.createGameState).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });

  it("rejects a foreign character without saving or calling the provider", async () => {
    const { service, storiesRepo } = init();
    storiesRepo.getOwnedPlayerCharacter.mockResolvedValue(null);
    await expect(
      service.initializeGame(compiledId, {}, playerId, characterId),
    ).rejects.toThrow(/not found for this player/);
    expect(storiesRepo.getOwnedPlayerCharacter).toHaveBeenCalledWith(
      characterId,
      playerId,
    );
    expect(storiesRepo.createGameState).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });

  it("rejects a missing session pin before Director or Narrator can call the provider", async () => {
    vi.spyOn(StoriesRepository.prototype, "loadGameState").mockResolvedValue({
      id: "00000000-0000-4000-8000-00000000d001",
      player_id: playerId,
      compiled_story_id: null,
      player_character_id: null,
      state_initialization_version: null,
      mechanical_state: {},
      narrative_focus: {},
      scene_registry: {},
      action_queue: [],
    } as any);
    const service = new GameTurnService(
      {} as any,
      narrative,
      new DirectorService(llm),
      undefined,
      new Mas2Service(llm),
    );
    await expect(
      service.processTurn(
        "00000000-0000-4000-8000-00000000d001",
        "look around",
        playerId,
      ),
    ).rejects.toThrow(/missing required frozen-session pins/);
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });
  it("rejects game creation at the cap before the opening provider call", async () => {
    const { service, storiesRepo } = init();
    storiesRepo.createGameState.mockRejectedValue(
      new Error("GAME_LIMIT_REACHED"),
    );
    await expect(
      service.initializeGame(compiledId, {}, playerId, characterId),
    ).rejects.toMatchObject({
      error: {
        code: "FORBIDDEN",
        details: { entitlement_code: "GAME_LIMIT_REACHED" },
      },
    });
    expect(storiesRepo.createGameState).toHaveBeenCalledTimes(1);
    expect(calls).not.toHaveBeenCalled();
    expect(textCalls).not.toHaveBeenCalled();
  });
  it("rejects a read-only game before Director or Narrator can call the provider", async () => {
    vi.spyOn(StoriesRepository.prototype, "loadGameState").mockResolvedValue({
      id: "00000000-0000-4000-8000-00000000d001",
      player_id: playerId,
      compiled_story_id: compiledId,
      player_character_id: characterId,
      state_initialization_version: 1,
      mechanical_state: {},
      narrative_focus: {},
      scene_registry: {},
      action_queue: [],
    } as Awaited<ReturnType<StoriesRepository["loadGameState"]>>);
    vi.spyOn(
      StoriesRepository.prototype,
      "getCompiledStoryById",
    ).mockResolvedValue(
      compiled as unknown as Awaited<
        ReturnType<StoriesRepository["getCompiledStoryById"]>
      >,
    );
    const gate = vi
      .spyOn(EntitlementsRepository.prototype, "assertGameWritable")
      .mockRejectedValue(new Error("GAME_READ_ONLY_TIER_LIMIT"));
    const service = new GameTurnService(
      {} as ConstructorParameters<typeof GameTurnService>[0],
      narrative,
      new DirectorService(llm),
      undefined,
      new Mas2Service(llm),
    );
    await expect(
      service.processTurn(
        "00000000-0000-4000-8000-00000000d001",
        "look around",
        playerId,
      ),
    ).rejects.toMatchObject({
      error: {
        code: "FORBIDDEN",
        details: { entitlement_code: "GAME_READ_ONLY_TIER_LIMIT" },
      },
    });
    expect(gate).toHaveBeenCalledTimes(1);
    expect(calls).not.toHaveBeenCalled();
    expect(textCalls).not.toHaveBeenCalled();
  });
});
