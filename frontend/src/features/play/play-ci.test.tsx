import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { GameStateSchema } from "@shared/types/chimera-runtime";
import { useActiveGameStore } from "@/stores/useActiveGameStore";
import { useGameSettings } from "@/stores/useGameSettings";
import { record, text, number, strings, parse } from "./utils/value";
import {
  resolveEntityDisplay,
  resolveEntityDescription,
  resolveEntityVitals,
} from "./utils/entity-utils";
import { parseEntitiesInText } from "./utils/text-parser";
import { splitSchema } from "./create/utils/schemaSplitter";
import { mergeCharacterSchema } from "./start/utils/schemaMerger";
import { LEGACY_PREMADES, mapPremadeToTemplate } from "./start/data/premades";
import { NarrativeStream } from "./components/Narrative/NarrativeStream";
import { StoryBlock } from "./components/Narrative/StoryBlock";
import { SystemLine } from "./components/Narrative/SystemLine";
import { EntityLink } from "./components/Narrative/EntityLink";
import { TurnBlock } from "./components/Narrative/TurnBlock";
import { GameHeader } from "./components/GameHeader";
import { LeftSidebar } from "./components/LeftSidebar";
import { HudSidebar } from "./components/HUD/HudSidebar";
import { MobileVitalsBar } from "./components/HUD/MobileVitalsBar";
import { SceneDeck } from "./components/HUD/SceneDeck";
import { VitalsPanel } from "./components/sidebar/VitalsPanel";
import { WorldClock } from "./components/sidebar/WorldClock";
import { StatusBadges } from "./components/sidebar/StatusBadges";
import { EntityInspectorModal } from "./components/modals/EntityInspectorModal";
import { InspectorPanel } from "./components/Inspector/InspectorPanel";
import { EntityCard } from "./components/Inspector/EntityCard";
import { SensoryObserver } from "./components/FX/SensoryObserver";
import { ThreeColumnLayout } from "./layout/ThreeColumnLayout";
import { InputDeck } from "./components/Deck/InputDeck";
import { SuggestionRail } from "./components/Deck/SuggestionRail";
import { DynamicControl } from "./create/components/DynamicControl";

import { Step2_Capabilities } from "./create/steps/Step2_Capabilities";
import { Step2_Attributes } from "./create/steps/Step2_Attributes";
import { Step3_Personality } from "./create/steps/Step3_Personality";
import { LiveCharacterSheet } from "./create/components/LiveCharacterSheet";
import CharacterCreatorWizard from "./create/CharacterCreatorWizard";
import StartStoryPage from "./start/StartStoryPage";
import { CharacterSelector } from "./start/components/CharacterSelector";
import type { ApiResponse } from "@/lib/api";
import type { Character } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  submit: vi.fn<[string, unknown], Promise<unknown>>(),
  post: vi.fn<[string, unknown], Promise<ApiResponse<{ id: string }>>>(),
  story: vi.fn<[string], Promise<ApiResponse<unknown>>>(),
  characters: vi.fn<[string?], Promise<ApiResponse<Character[]>>>(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/features/active-game/services/activeGameApi", () => ({
  activeGameApi: { submitTurn: mocks.submit },
}));
vi.mock("@/lib/api", () => ({ apiPost: mocks.post }));
vi.mock("@/api/chimera-client", () => ({
  getCompiledStory: mocks.story,
  getMyCharacters: mocks.characters,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/form/DynamicSchemaField", () => ({
  DynamicSchemaField: ({ name }: { name: string }) => <div>{name}</div>,
}));

const id = "a0000000-0000-4000-8000-000000000001";
const game = (
  mechanical: Record<string, unknown> = {},
  narrative: Record<string, unknown> = {},
) =>
  GameStateSchema.parse({
    player_id: id,
    compiled_story_id: id,
    player_character_id: id,
    state_initialization_version: 1,
    mechanical_state: mechanical,
    narrative_focus: narrative,
  });
const player = (properties: Record<string, unknown> = {}) => ({
  id,
  type: "PLAYER",
  properties,
});
const log = (
  role: "player" | "narrator" | "system",
  content: string,
  metadata?: Record<string, unknown>,
) => ({
  id: role + content,
  role,
  text: content,
  timestamp: new Date(),
  metadata,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  useActiveGameStore.setState({
    activeGameId: null,
    gameState: null,
    draftText: "",
    inputMode: "idle",
    pendingInput: null,
    lastError: null,
    selectedEntityId: null,
    entities: {},
    suggested_actions: [],
    vitals: {
      hp: 100,
      maxHp: 100,
      stamina: 100,
      saturation: 100,
      inCombat: false,
      condition: null,
    },
  });
  mocks.post.mockResolvedValue({ ok: true, data: { id } });
});

describe("Validated legacy payloads", () => {
  it("rejects invalid object, number, string and list shapes without throwing", () => {
    expect(record(null)).toEqual({});
    expect(record([])).toEqual({});
    expect(record(5)).toEqual({});
    expect(record({ zero: 0 })).toEqual({ zero: 0 });
    expect(text(5, "safe")).toBe("safe");
    expect(number(Number.NaN, 7)).toBe(7);
    expect(number(0, 7)).toBe(0);
    expect(strings(["a", 2, null])).toEqual(["a"]);
    expect(strings(null)).toEqual([]);
    expect(parse('{"x":1}')).toEqual({ x: 1 });
    expect(parse("prose")).toBe("prose");
  });
  it.each([
    [{ display_name: "Captain" }, "Captain"],
    [{ properties: { display_name: "Scout" } }, "Scout"],
    [{ properties: { name: "Sage" } }, "Sage"],
    [{ raw_data: { identity: { name: "Bard" } } }, "Bard"],
    [{ name: "Keeper" }, "Keeper"],
    [null, "Unknown Entity"],
    [{ name: "Unknown figure" }, "Unknown figure"],
  ])("resolves names across supported entity shapes", (entity, expected) => {
    expect(resolveEntityDisplay(entity).name).toBe(expected);
  });
  it.each([
    [{ properties: { archetype: "Mage" } }, "Mage"],
    [{ properties: { occupation_tags: ["Guide"] } }, "Guide"],
    [{ raw_data: { identity: { species: "Elf" } } }, "Elf"],
    [{ properties: { race: "Human" } }, "Human"],
    [{ raw_data: { tier1_entity: { occupation_tags: ["Ranger"] } } }, "Ranger"],
    [null, "Unknown Role"],
  ])("resolves role priorities", (entity, expected) => {
    expect(resolveEntityDisplay(entity).role).toBe(expected);
  });
  it.each([
    [{ properties: { description: "A" } }, "A"],
    [{ description: "B" }, "B"],
    [{ raw_data: { identity: { description: "C" } } }, "C"],
    [{ raw_data: { tier1_entity: { description: "D" } } }, "D"],
    [null, null],
  ])("extracts descriptions safely", (entity, expected) => {
    expect(resolveEntityDescription(entity)).toBe(expected);
  });
  it("keeps absent vitals absent and accepts zeroes and both max spellings", () => {
    expect(resolveEntityVitals(null).hp).toBeNull();
    expect(
      resolveEntityVitals({ properties: { hp: 0, max_hp: 75, stamina: 0 } }),
    ).toMatchObject({ hp: 0, maxHp: 75, stamina: 0 });
    expect(
      resolveEntityVitals({
        properties: {
          maxHp: 80,
          current_stamina: 65,
          combat_condition: "Wounded",
          physical_condition: "Tired",
        },
      }),
    ).toMatchObject({
      maxHp: 80,
      stamina: 65,
      combatCondition: "Wounded",
      physicalCondition: "Tired",
    });
  });
  it("links longest names and escapes regex characters without processing existing nodes twice", () => {
    expect(parseEntitiesInText("", {})).toEqual([]);
    const nodes = parseEntitiesInText(
      "King Arthur greets King, then King Arthur.",
      {
        a: { name: "King Arthur", type: "npc" },
        b: { name: "King", type: "enemy" },
        c: { name: "X?", type: "item" },
        d: { name: "Missing", type: "unknown" },
      },
    );
    render(<div>{nodes}</div>);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(
      screen.getAllByRole("button")[0] ?? screen.getByRole("button"),
    );
    expect(useActiveGameStore.getState().selectedEntityId).toBe("a");
  });
});

describe("State reconciliation and turn submission", () => {
  it.each([
    [
      {
        hp: 44,
        maxHp: 80,
        current_stamina: 31,
        satiety: 42,
        combat_condition: "Wounded",
      },
      31,
      "Wounded",
    ],
    [
      {
        hp: 0,
        max_hp: 80,
        stamina: 0,
        saturation: 0,
        physical_condition: "Exhausted",
      },
      0,
      "Exhausted",
    ],
    [{ combat_condition: "Healthy", physical_condition: "Rested" }, 100, null],
  ])(
    "hydrates vitals and prioritizes the resource field",
    (props, stamina, condition) => {
      const state = game({
        index: { player_id: id },
        entities: { [id]: player(props) },
        in_combat: true,
      });
      useActiveGameStore.getState().syncState(state);
      expect(useActiveGameStore.getState().vitals).toMatchObject({
        stamina,
        condition,
        inCombat: true,
      });
      expect(useActiveGameStore.getState().entities).not.toBe(
        record(state.mechanical_state).entities,
      );
    },
  );
  it("finds a player by type, handles legacy health and updates context suggestions", () => {
    useActiveGameStore
      .getState()
      .syncState(
        game(
          { entities: { a: player({ current_stamina: 72 }) } },
          { scene_context: { name: "Road", available_actions: ["Look"] } },
        ),
      );
    expect(useActiveGameStore.getState().suggested_actions).toEqual(["Look"]);
    useActiveGameStore
      .getState()
      .syncState(
        game({ health: { current: 33, max: 50 }, stamina: { current: 45 } }),
      );
    expect(useActiveGameStore.getState().vitals).toMatchObject({
      hp: 33,
      maxHp: 50,
      stamina: 45,
    });
    useActiveGameStore.getState().syncState(game());
    expect(useActiveGameStore.getState().gameState).toBeTruthy();
  });
  it("does not submit empty, unbound, locked or already processing drafts", async () => {
    const store = useActiveGameStore.getState();
    await store.commitInput();
    store.setDraft("Look");
    await store.commitInput();
    store.setActiveGameId(id);
    store.lockInput();
    store.setDraft("Move");
    await store.commitInput();
    useActiveGameStore.setState({ inputMode: "thinking" });
    store.setDraft("Wait");
    await store.commitInput();
    expect(mocks.submit).not.toHaveBeenCalled();
    store.unlockInput();
    store.clearDraft();
    store.setSelectedEntity("npc");
    expect(useActiveGameStore.getState()).toMatchObject({
      inputMode: "idle",
      draftText: "",
      selectedEntityId: "npc",
    });
  });
  it("routes deltas into their shards, adds numbers recursively and appends logs", async () => {
    const state = game(
      {
        entities: {
          [id]: player({
            current_stamina: 80,
            nested: { amount: 2 },
            items: ["old"],
          }),
        },
      },
      { dialogue_history: ["old"] },
    );
    const store = useActiveGameStore.getState();
    store.setActiveGameId(id);
    store.syncState(state);
    store.setDraft("Walk");
    mocks.submit.mockResolvedValue({
      delta: {
        entities: {
          [id]: {
            properties: {
              current_stamina: -9,
              satiety: -3,
              nested: { amount: 3 },
              items: ["new"],
              new: { n: 2 },
              label: "changed",
            },
          },
        },
        world: { narrative: { scene_context: { location: "Bridge" } } },
        action_queue: ["Inspect"],
      },
      new_logs: ["new"],
    });
    await store.commitInput();
    expect(useActiveGameStore.getState()).toMatchObject({
      inputMode: "idle",
      draftText: "",
      pendingInput: null,
      suggested_actions: ["Inspect"],
      vitals: { stamina: 71, saturation: 97 },
    });
    expect(
      record(
        record(
          record(useActiveGameStore.getState().gameState?.mechanical_state)
            .entities,
        )[id],
      ).properties,
    ).toMatchObject({
      nested: { amount: 5 },
      items: ["new"],
      label: "changed",
    });
    expect(state.mechanical_state).toMatchObject({
      entities: { [id]: { properties: { current_stamina: 80 } } },
    });
    expect(
      useActiveGameStore.getState().gameState?.narrative_focus.dialogue_history,
    ).toEqual(["old", "new"]);
  });
  it("finishes without a hydrated state and handles missing delta/logs", async () => {
    const store = useActiveGameStore.getState();
    store.setActiveGameId(id);
    store.setDraft("Look");
    mocks.submit.mockResolvedValue({});
    await store.commitInput();
    expect(useActiveGameStore.getState().inputMode).toBe("idle");
    store.syncState(game());
    store.setDraft("Wait");
    await store.commitInput();
    expect(
      useActiveGameStore.getState().gameState?.narrative_focus.dialogue_history,
    ).toEqual([]);
  });
  it.each([new Error("Try again"), new Error(""), "offline"])(
    "preserves a failed draft and offers retry",
    async (error) => {
      const store = useActiveGameStore.getState();
      store.setActiveGameId(id);
      store.setDraft("Look");
      mocks.submit.mockRejectedValue(error);
      await store.commitInput();
      expect(useActiveGameStore.getState()).toMatchObject({
        inputMode: "drafting",
        draftText: "Look",
        pendingInput: null,
      });
      expect(mocks.toast.error).toHaveBeenCalled();
    },
  );
});

describe("Play presentation and interactions", () => {
  it("groups player, mechanics and narration, filters hidden prompt text and shows pending turns", () => {
    render(
      <NarrativeStream
        pendingInput="Waiting"
        logs={[
          log("system", "Initial system"),
          log("narrator", "Opening"),
          log("player", "Look"),
          log("system", "Roll"),
          log(
            "narrator",
            "NARRATOR LENS hidden\nROLE: hidden\nPERSPECTIVE: hidden\nDIRECTOR'S NOTE hidden\nVisible prose",
          ),
          log("narrator", "[THOUGHT] private"),
          log("narrator", ""),
          log("narrator", '{"narration":"JSON prose"}'),
          log("narrator", "[broken"),
          log(
            "narrator",
            JSON.stringify({ content: JSON.stringify({ text: "Nested" }) }),
          ),
        ]}
      />,
    );
    expect(screen.getByText("Visible prose")).toBeVisible();
    expect(screen.getByText("JSON prose")).toBeVisible();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(screen.getByTestId("turn-pending")).toHaveTextContent("Waiting");
  });
  it("renders mechanics and all system line variants", () => {
    const { rerender } = render(
      <TurnBlock
        data={{
          id: "turn",
          input: log("player", "Act"),
          system: [log("system", "System")],
          narrative: [
            log("narrator", "Prose", {
              mechanics: {
                outcome: "success",
                skill_check: "Insight",
                roll: 15,
                target: 10,
              },
            }),
          ],
        }}
      />,
    );
    expect(screen.getByText("Act")).toBeVisible();
    rerender(
      <TurnBlock
        data={{
          id: "turn",
          system: [],
          narrative: [log("narrator", "Prose", { mechanics: {} })],
        }}
      />,
    );
    for (const type of ["combat", "check", "info"] as const) {
      rerender(<SystemLine text="Receipt" type={type} />);
      expect(screen.getByText("Receipt")).toBeVisible();
    }
  });
  it("opens known entities from markdown and handles player prose and external links", () => {
    useActiveGameStore.setState({
      entities: {
        guide: { id: "guide", name: "Guide" },
        unknown: { id: "unknown", name: "Unknown figure" },
      },
    });
    const { rerender } = render(
      <StoryBlock
        role="narrator"
        text="Guide says **welcome**. [Docs](https://example.com)"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(useActiveGameStore.getState().selectedEntityId).toBe("guide");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    rerender(<StoryBlock role="player" text="Guide" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<StoryBlock role="narrator" text="" />);
    expect(screen.queryByText("Guide")).not.toBeInTheDocument();
    rerender(<EntityLink id="enemy" name="Enemy" type="enemy" />);
    fireEvent.click(screen.getByRole("button"));
    expect(useActiveGameStore.getState().selectedEntityId).toBe("enemy");
  });
  it.each([
    "Day",
    "Dawn",
    "Early morning",
    "Noon",
    "Dusk",
    "Evening",
    "Night",
    "Midnight",
    "Other",
  ])("renders declared world time %s", (time) => {
    render(<WorldClock time={time} />);
    expect(screen.getByText(time)).toBeVisible();
  });
  it("renders world time from both legacy shards", () => {
    const { rerender } = render(
      <WorldClock mechanicalState={{ world: { time_band: "Dusk" } }} />,
    );
    expect(screen.getByText("Dusk")).toBeVisible();
    rerender(
      <WorldClock mechanicalState={{ tier1_world: { time_band: "Night" } }} />,
    );
    expect(screen.getByText("Night")).toBeVisible();
    rerender(<WorldClock />);
    expect(screen.getByText("Day")).toBeVisible();
  });
  it.each([100, 70, 40, 10])(
    "shows reactive stamina %s and condition badges",
    (stamina) => {
      useActiveGameStore.setState({
        vitals: {
          hp: stamina,
          maxHp: 100,
          stamina,
          saturation: stamina,
          inCombat: false,
          condition: stamina < 30 ? "Wounded" : null,
        },
      });
      render(
        <>
          <VitalsPanel mechanicalState={{}} />
          <MobileVitalsBar />
          <LeftSidebar
            player={player({ name: "Hero", occupation_tags: ["Scout"] })}
          />
          <StatusBadges
            mechanicalState={{
              index: { player_id: id },
              entities: {
                [id]: player({
                  combat_condition: "Wounded",
                  hunger_state: "Hungry",
                  physical_condition: "Fatigued",
                }),
              },
            }}
          />
        </>,
      );
      for (const element of screen.getAllByTestId("stamina-value"))
        expect(element).toHaveTextContent(String(stamina));
      expect(screen.getByText("Hero")).toBeInTheDocument();
      expect(screen.getAllByText("Wounded").length).toBeGreaterThan(0);
    },
  );
  it("renders neutral condition state without badges and safe empty player values", () => {
    render(
      <>
        <StatusBadges mechanicalState={{}} />
        <LeftSidebar player={null} />
      </>,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
  it.each([
    "Healthy",
    "Wounded",
    "Critical",
    "Surrendered",
    "Defeated",
    "Unconscious",
  ])("inspects nearby cast with %s condition", (condition) => {
    const inspect = vi.fn();
    render(
      <HudSidebar
        context={{}}
        entities={{
          npc: {
            id: "npc",
            name: "Guide",
            properties: { combat_condition: condition },
            status: "hostile",
          },
          unknown: { id: "unknown", name: "Unknown figure", type: "item" },
          enemy: { id: "enemy", name: "Enemy", type: "enemy" },
        }}
        locations={{
          npc: "scene",
          unknown: "scene",
          enemy: "scene",
          [id]: "scene",
          absent: "scene",
        }}
        playerId={id}
        activeSceneId="scene"
        onInspect={inspect}
      />,
    );
    fireEvent.click(screen.getByTitle("Guide"));
    expect(inspect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "npc" }),
    );
  });
  it("renders an empty cast and accessible header controls", () => {
    const exit = vi.fn(),
      config = vi.fn();
    render(
      <>
        <HudSidebar
          context={{}}
          entities={{}}
          locations={{}}
          playerId={id}
          activeSceneId="scene"
          onInspect={vi.fn()}
        />
        <GameHeader
          scene={{ name: "Story", location_name: "Inn", time: "Night" }}
          onExit={exit}
          onConfig={config}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Exit Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(exit).toHaveBeenCalledOnce();
    expect(config).toHaveBeenCalledOnce();
    expect(screen.getByText("Inn")).toBeInTheDocument();
  });
  it.each([
    null,
    { id: "npc", name: "Guide" },
    {
      id: "npc",
      properties: {
        name: "Guide",
        hp: 30,
        maxHp: 50,
        current_stamina: 45,
        combat_condition: "Wounded",
        physical_condition: "Exhausted",
        description: "A scout",
        tags: ["friend"],
      },
      relationships: { trust: 9, fear: 2 },
    },
    { name: "Guide", properties: { combat_condition: "Defeated" } },
    {
      name: "Guide",
      properties: {
        combat_condition: "Unconscious",
        physical_condition: "Rested",
      },
    },
  ])("renders only available inspector fields", (entity) => {
    render(<EntityInspectorModal entity={entity} isOpen onClose={vi.fn()} />);
    if (entity) expect(screen.getAllByText("Guide").length).toBeGreaterThan(0);
    else expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("opens and closes the side inspector", () => {
    const { rerender } = render(<InspectorPanel />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      useActiveGameStore.getState().setSelectedEntity("npc");
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(useActiveGameStore.getState().selectedEntityId).toBeNull();
    rerender(
      <EntityCard
        entityId="npc"
        name="Scout"
        description="Known description"
      />,
    );
    expect(screen.getByText("Scout")).toBeVisible();
  });
  it("renders scene settings in ordinary and zen modes", () => {
    const { rerender } = render(<SceneDeck />);
    expect(screen.getByText("Unknown Location")).toBeInTheDocument();
    act(() => {
      useActiveGameStore
        .getState()
        .syncState(
          game({}, { scene_context: { location: "Inn", time: "Dusk" } }),
        );
    });
    expect(screen.getByText("Inn")).toBeInTheDocument();
    act(() => {
      useGameSettings.setState({ zenMode: true });
    });
    rerender(<SceneDeck />);
    expect(screen.queryByText("Dusk")).not.toBeInTheDocument();
  });
  it("renders layout slots and a mobile strip only when supplied", () => {
    const { rerender } = render(
      <ThreeColumnLayout
        header="Header"
        leftSidebar="Player"
        rightSidebar="Cast"
        footer="Composer"
        mobileBar="Vitals"
      >
        Story
      </ThreeColumnLayout>,
    );
    expect(screen.getByRole("main")).toHaveTextContent("Story");
    expect(screen.getByText("Vitals")).toBeInTheDocument();
    rerender(<ThreeColumnLayout>Story</ThreeColumnLayout>);
    expect(screen.queryByText("Vitals")).not.toBeInTheDocument();
  });
  it("drafts suggestions, respects locked state and sends with Enter", async () => {
    const commit = vi.fn();
    render(
      <>
        <SuggestionRail onCommit={commit} />
        <InputDeck />
      </>,
    );
    fireEvent.click(screen.getByText("Look around"));
    expect(useActiveGameStore.getState().draftText).toBe("Look around");
    fireEvent.doubleClick(screen.getByText("Wait"));
    expect(commit).toHaveBeenCalledWith("Wait");
    act(() => {
      useActiveGameStore.getState().lockInput();
    });
    fireEvent.click(screen.getByText("Status"));
    expect(useActiveGameStore.getState().draftText).toBe("Wait");
    expect(screen.getByRole("button", { name: "Send action" })).toBeDisabled();
    act(() => {
      useActiveGameStore.getState().unlockInput();
      useActiveGameStore.getState().setActiveGameId(id);
    });
    mocks.submit.mockResolvedValue({});
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Walk" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => {
      expect(mocks.submit).toHaveBeenCalledOnce();
    });
  });
  it("reacts to sensory drops and restores the vignette after recovery", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SensoryObserver gameState={{}} />);
    rerender(
      <SensoryObserver
        gameState={{
          tier1_mechanical: { current_stamina: 90, current_hp: 70 },
        }}
      />,
    );
    rerender(
      <SensoryObserver
        gameState={{
          tier1_mechanical: { current_stamina: 20, current_hp: 10 },
        }}
      />,
    );
    expect(document.body).toHaveClass("animate-shake");
    act(() => {
      vi.advanceTimersByTime(550);
    });
    expect(document.body).not.toHaveClass("animate-shake");
    rerender(<SensoryObserver gameState={{ tier1_mechanical: {} }} />);
    expect(document.querySelector(".fx-vignette")).toHaveStyle({
      opacity: "0",
    });
    vi.useRealTimers();
  });
});

describe("Character schema and creation flow", () => {
  it("splits universal, special, hidden, hinted, numeric and narrative fields", () => {
    expect(splitSchema(null).capabilities).toEqual({});
    const parts = splitSchema({
      definitions: {
        name: {},
        race_handle: {},
        hidden: {},
        force: {},
        fear: {},
        coins: { type: "integer" },
        custom: {},
        hintedStat: {},
        hintedSoul: {},
      },
      form_hints: {
        hidden: { hidden: true },
        hintedStat: { section: "stats" },
        hintedSoul: { section: "soul" },
      },
    });
    expect(parts.identity.specialFields).toHaveProperty("race_handle");
    expect(parts.capabilities).toHaveProperty("coins");
    expect(parts.capabilities).toHaveProperty("force");
    expect(parts.personality).toHaveProperty("fear");
    expect(parts.personality).toHaveProperty("custom");
    expect(parts.personality).not.toHaveProperty("hidden");
    expect(parts.identity.otherFields).toEqual({});
  });
  it("merges world overrides without mutating engine defaults and builds creation hints", () => {
    const story = {
      config_engine: {
        schema: {
          tier1_entity: {
            definitions: { strength: { type: "number", default: 4 } },
            form_hints: {},
          },
        },
        creation: {
          fields: [
            { key: "strength", label: "Power", control: "slider", min: 0 },
            { key: "name", label: "Name", control: "text" },
            {},
          ],
        },
      },
      snapshot_world: {
        character_schema_contributions: {
          tier1_entity: {
            definitions: { strength: { maximum: 10 } },
            form_hints: { strength: { section: "stats" } },
          },
        },
      },
    };
    const merged = mergeCharacterSchema(story);
    expect(merged.definitions.strength).toMatchObject({
      default: 4,
      maximum: 10,
    });
    expect(merged.definitions.name).toMatchObject({ type: "string" });
    expect(
      story.config_engine.schema.tier1_entity.definitions.strength,
    ).toEqual({ type: "number", default: 4 });
    expect(mergeCharacterSchema(null).definitions).toEqual({});
    expect(
      mapPremadeToTemplate(
        LEGACY_PREMADES[0] ?? {
          id: "",
          name: "",
          tagline: "",
          description: "",
          portrait_key: "",
          base_traits: "",
        },
      ),
    ).toMatchObject({ archetype_handle: "fighter", strength: 4 });
  });
  it("handles corrupt premade traits safely", () => {
    expect(
      mapPremadeToTemplate({
        id: "",
        name: "Scout",
        tagline: "",
        description: "Bio",
        portrait_key: "",
        base_traits: "{broken",
      }),
    ).toMatchObject({ name: "Scout", backstory: "Bio" });
  });
  it.each([
    { type: "string" },
    { type: "string", maxLength: 150 },
    { type: "integer" },
    { type: "number", minimum: 0, maximum: 10 },
    { enum: ["one", "two"] },
  ])("renders dynamic controls and accepts user input", (schema) => {
    const change = vi.fn();
    render(
      <DynamicControl
        fieldKey="test_field"
        schema={schema}
        value={undefined}
        onChange={change}
      />,
    );
    const textbox =
      screen.queryByRole("textbox") ?? screen.queryByRole("spinbutton");
    if (textbox) {
      fireEvent.change(textbox, {
        target: { value: schema.type === "integer" ? "3" : "Changed" },
      });
      expect(change).toHaveBeenCalled();
    } else
      expect(
        screen.queryByRole("combobox") ?? screen.getByRole("slider"),
      ).toBeInTheDocument();
  });
  it("keeps tag state stable across control types and prevents duplicate tags", () => {
    const change = vi.fn();
    const { rerender } = render(
      <DynamicControl
        fieldKey="traits"
        schema={{ type: "array" }}
        value={["Brave"]}
        onChange={change}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Kind" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(change).toHaveBeenCalledWith(["Brave", "Kind"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Brave" }));
    expect(change).toHaveBeenCalledWith([]);
    rerender(
      <DynamicControl
        fieldKey="traits"
        schema={{ type: "string" }}
        value="Ready"
        onChange={change}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Ready");
  });
  it("renders empty and populated creation steps and live sheet fields", () => {
    const update = vi.fn();
    const { rerender } = render(
      <Step2_Capabilities data={{}} updateData={update} schema={{}} />,
    );
    expect(screen.getByText(/no numeric stats/)).toBeVisible();
    rerender(
      <Step2_Capabilities
        data={{ strength: 2 }}
        updateData={update}
        schema={{ strength: { type: "integer" } }}
      />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "3" },
    });
    expect(update).toHaveBeenCalledWith("strength", 3);
    rerender(<Step3_Personality data={{}} updateData={update} schema={{}} />);
    expect(screen.getByText(/No additional personality/)).toBeVisible();
    rerender(
      <Step3_Personality
        data={{ fear: "" }}
        updateData={update}
        schema={{ fear: { type: "string" } }}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Heights" },
    });
    expect(update).toHaveBeenCalledWith("fear", "Heights");
    rerender(
      <Step2_Attributes
        data={{}}
        updateData={update}
        schema={{ strength: { label: "Strength" }, coins: { type: "integer" } }}
        activeRulesets={[
          {},
          {
            name: "Core",
            character_schema_contributions: {
              tier1_entity: { definitions: { strength: {}, absent: {} } },
            },
          },
        ]}
      />,
    );
    expect(screen.getByText("Core")).toBeVisible();
    expect(screen.getByText("General Attributes")).toBeVisible();
    rerender(
      <Step2_Attributes
        data={{}}
        updateData={update}
        schema={{}}
        activeRulesets={[]}
      />,
    );
    expect(screen.getByText(/No attributes/)).toBeVisible();
    rerender(
      <LiveCharacterSheet
        data={{
          name: "Hero",
          pronouns: "They/Them",
          appearance: "x".repeat(160),
          backstory: "y".repeat(220),
          species: "Elf",
          class: "Mage",
          strength: 5,
          values: ["Kind"],
          small: "Small",
          empty: "",
        }}
      />,
    );
    expect(screen.getByText("Hero")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(screen.getByText("Kind")).toBeVisible();
    rerender(<LiveCharacterSheet data={{}} />);
    expect(screen.getByText("Unnamed Hero")).toBeVisible();
  });
  it("validates identity before advancing, preserves data across Back and submits a completed wizard", async () => {
    const cancel = vi.fn();
    render(
      <MemoryRouter>
        <CharacterCreatorWizard
          storyId={id}
          mergedSchema={{
            definitions: { strength: { type: "number" }, fear: {} },
          }}
          onCancel={cancel}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }));
    expect(mocks.toast.error).toHaveBeenCalled();
    expect(screen.getByText("Who are you?")).toBeVisible();
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Hero" },
    });
    fireEvent.change(screen.getByLabelText("Appearance"), {
      target: { value: "Tall" },
    });
    fireEvent.change(screen.getByLabelText("Backstory"), {
      target: { value: "Traveler" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }));
    expect(screen.getAllByText("Attributes").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByLabelText(/Name/)).toHaveValue("Hero");
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin Adventure/ }));
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalled();
    });
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/chimera/game/init",
      expect.objectContaining({ storyId: id }),
    );
  });
  it("cancels on the first step and reports submission failures", async () => {
    const cancel = vi.fn();
    mocks.post.mockRejectedValue(new Error("Unavailable"));
    render(
      <MemoryRouter>
        <CharacterCreatorWizard
          storyId={id}
          mergedSchema={{ definitions: {} }}
          onCancel={cancel}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(cancel).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: "Hero" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin Adventure/ }));
    await waitFor(() => {
      expect(mocks.toast.error).toHaveBeenCalledWith("Error", {
        description: "Unavailable",
      });
    });
  });
  it("renders both selector tabs and calls their handlers", () => {
    const select = vi.fn(),
      create = vi.fn(),
      premade = vi.fn();
    const { rerender } = render(
      <CharacterSelector
        characters={[
          {
            id,
            name: "Hero",
            created_at: "",
            updated_at: "",
            portrait_url: "/portrait.png",
          },
        ]}
        premades={[]}
        selectedTab="MY_CHARACTERS"
        onSelectCharacter={select}
        onSelectPremade={premade}
        onCreateNew={create}
      />,
    );
    fireEvent.click(screen.getByText("Hero"));
    expect(select).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Create New"));
    expect(create).toHaveBeenCalled();
    rerender(
      <CharacterSelector
        characters={[]}
        premades={LEGACY_PREMADES}
        selectedTab="PREMADES"
        onSelectCharacter={select}
        onSelectPremade={premade}
        onCreateNew={create}
      />,
    );
    fireEvent.click(screen.getByText("The Mercenary"));
    expect(premade).toHaveBeenCalled();
  });
});

function gateway(children: ReactNode = <StartStoryPage />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/play/start/" + id]}>
        <Routes>
          <Route path="/play/start/:storyId" element={children} />
          <Route path="/play/:gameId" element={<div>Game opened</div>} />
          <Route
            path="/play/create/:storyId"
            element={<div>Forge opened</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Gateway requests", () => {
  it("loads compatible characters and starts an existing character", async () => {
    mocks.story.mockResolvedValue({
      ok: true,
      data: {
        display_name: "Story",
        snapshot_world: { id: "world" },
        world: { display_name: "World" },
      },
    });
    mocks.characters.mockResolvedValue({
      ok: true,
      data: [{ id, name: "Hero", created_at: "", updated_at: "" }],
    });
    gateway();
    expect(screen.getByText("Loading Story Gateway...")).toBeVisible();
    fireEvent.click(await screen.findByText("Hero"));
    await screen.findByText("Game opened");
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/chimera/game/init",
      expect.objectContaining({ characterId: id }),
    );
  });
  it("reports unavailable compiled stories", async () => {
    mocks.story.mockRejectedValue({ status: 404 });
    gateway();
    expect(await screen.findByText("Failed to load story")).toBeVisible();
    expect(screen.getByText(/hasn't been compiled/)).toBeVisible();
  });
  it("opens the forge from the empty library and handles API failures", async () => {
    mocks.story.mockResolvedValue({
      ok: true,
      data: { display_name: "Story" },
    });
    mocks.characters.mockResolvedValue({ ok: true, data: [] });
    gateway();
    await screen.findByText("Create New");
    fireEvent.click(screen.getByText("Create New"));
    expect(await screen.findByText("Forge opened")).toBeVisible();
  });
});
