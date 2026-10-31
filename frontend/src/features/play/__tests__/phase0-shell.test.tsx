import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useActiveGameStore } from "@/stores/useActiveGameStore";
import {
  corePlayView,
  socialPlayView,
  combatPlayView,
  fixtureLogs,
} from "../model/fixtures";
import {
  PlayViewSchema,
  readPlayView,
  readTranscript,
  readSuggestions,
} from "../model/play-view";
import { PlayShell } from "../components/PlayShell";
import { PlayFixtureGallery } from "../components/PlayFixtureGallery";
import { Vital } from "../components/HUD/Vital";
import { PopInCard } from "../components/HUD/PopInCard";

beforeEach(() => {
  useActiveGameStore.setState({
    layout: { left: "open", right: "open", focus: false, modules: {} },
    layoutInitialized: true,
    priorPanels: null,
    activeGameId: null,
    pendingInput: null,
    draftText: "",
    inputMode: "idle",
    lastError: null,
  });
});
function shell(view = corePlayView, suggestions = ["Look closer"]) {
  return render(
    <PlayShell
      view={view}
      logs={fixtureLogs}
      suggestions={suggestions}
      onExit={vi.fn()}
    />,
  );
}

describe("Phase 0B safe view boundary", () => {
  it("rejects undeclared sources, duplicate modules, invalid vitals and contradictory empty presence", () => {
    expect(
      PlayViewSchema.safeParse({ ...corePlayView, rulesets: [] }).success,
    ).toBe(false);
    expect(
      PlayViewSchema.safeParse({
        ...corePlayView,
        modules: [corePlayView.modules[0], corePlayView.modules[0]],
      }).success,
    ).toBe(false);
    expect(
      PlayViewSchema.safeParse({
        ...corePlayView,
        presence: { ...corePlayView.presence, availability: "empty" },
      }).success,
    ).toBe(false);
    expect(
      PlayViewSchema.safeParse({
        ...corePlayView,
        modules: [
          {
            id: "bad",
            kind: "vitals",
            label: "Bad",
            source: corePlayView.rulesets[0],
            fields: [
              { id: "bad", label: "Bad", path: "bad", value: 0, max: 0 },
            ],
          },
        ],
      }).success,
    ).toBe(false);
    expect(readPlayView({ play_view: socialPlayView })).toEqual(socialPlayView);
    expect(() => readPlayView({ play_view: { modules: [] } })).toThrow();
  });
  it("does not infer declarations or disclose cast from a legacy response", () => {
    const state = {
      mechanical_state: {
        entities: { npc: { name: "Secret true name", trust: 90, hp: 100 } },
      },
      narrative_focus: {
        scene_context: {
          location: "a0000000-0000-4000-8000-000000000001",
          time: "Unknown",
          atmosphere: "Quiet",
        },
      },
    };
    const view = readPlayView(state);
    expect(view.modules).toEqual([]);
    expect(view.presence).toBeUndefined();
    expect(view.scene).toEqual({
      name: undefined,
      time: undefined,
      atmosphere: "Quiet",
    });
    expect(readPlayView(null).modules).toEqual([]);
    expect(readPlayView(null).scene).toBeUndefined();
    expect(
      readPlayView({
        play_view: {
          ...socialPlayView,
          title: "Unknown",
          scene: {
            name: "a0000000-0000-4000-8000-000000000001",
            time: "Unknown",
          },
        },
      }).scene,
    ).toBeUndefined();
    expect(
      readPlayView({
        story_title: "A story",
        tier0_narrative: {
          scene_context: { location_name: "Inn", time: "Dusk" },
        },
      }).title,
    ).toBe("A story");
  });
  it("reads existing transcript formats and filters prompt/empty/invalid entries", () => {
    const logs = readTranscript({
      narrative: {
        dialogue_history: [
          { speaker: "Narrator", content: '"Plain"' },
          {
            role: "narrator",
            content: JSON.stringify({
              narration: "NARRATOR LENS hidden\nVisible",
            }),
            timestamp: "2026-01-01",
          },
          {
            speaker: "System",
            text: JSON.stringify({
              content: JSON.stringify({ text: "Nested" }),
            }),
          },
          { speaker: "You", text: "Act" },
          { role: "narrator", content: "{broken" },
          { role: "narrator", content: "[THOUGHT] hidden" },
          { role: "tool", content: "Secret" },
          { role: "narrator", content: "" },
          { role: "narrator", content: "{}" },
        ],
      },
    });
    expect(logs.map((log) => log.text)).toEqual([
      '"Plain"',
      "Visible",
      "Nested",
      "Act",
      "{broken",
    ]);
    expect(readTranscript(null)).toEqual([]);
    expect(
      readSuggestions({
        action_queue: ["Act"],
        narrative: { scene_context: { available_actions: ["Wait"] } },
      }),
    ).toEqual(["Act"]);
    expect(
      readSuggestions({
        tier0_narrative: { scene_context: { available_actions: ["Wait"] } },
      }),
    ).toEqual(["Wait"]);
    expect(readSuggestions({})).toEqual([]);
  });
});

describe("Phase 0B layout and modules", () => {
  it("renders each rule mix without invented Health or missing modules", () => {
    const { rerender } = shell();
    expect(screen.queryByText(/Health/)).not.toBeInTheDocument();
    expect(screen.getAllByText("90").length).toBeGreaterThan(0);
    rerender(
      <PlayShell
        view={socialPlayView}
        logs={[]}
        suggestions={[]}
        onExit={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Hide Stamina")).not.toBeInTheDocument();
    expect(screen.queryByText("Force")).not.toBeInTheDocument();
    expect(screen.getByText("A visiting poet")).toBeInTheDocument();
    rerender(
      <PlayShell
        view={combatPlayView}
        logs={[]}
        suggestions={[]}
        onExit={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Wounded")[0]).toBeInTheDocument();
    expect(screen.getByText("Prowess")).toBeInTheDocument();
    expect(screen.getByText("No one else is here.")).toBeInTheDocument();
    expect(screen.queryByText(/Health/)).not.toBeInTheDocument();
  });
  it("preserves zeroes and renders unbounded declared fields without a bar", () => {
    render(
      <Vital
        field={{
          id: "custom",
          label: "Custom",
          path: "player.custom",
          value: 0,
          delta: 2,
          tone: "danger",
        }}
      />,
    );
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.getByText("+2")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("cycles both panels, expands rails, and restores asymmetric panels after focus", () => {
    shell();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cycle Character panel, currently open",
      }),
    );
    expect(useActiveGameStore.getState().layout.left).toBe("slim");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cycle Character panel, currently slim",
      }),
    );
    expect(screen.queryByLabelText("Character panel")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cycle Character panel, currently hidden",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Cycle Here panel, currently open" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enter focus" }));
    expect(useActiveGameStore.getState().layout).toMatchObject({
      left: "hidden",
      right: "hidden",
      focus: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Exit focus" }));
    expect(useActiveGameStore.getState().layout).toMatchObject({
      left: "open",
      right: "slim",
      focus: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Expand Here" }));
    expect(useActiveGameStore.getState().layout.right).toBe("open");
    act(() => {
      useActiveGameStore.getState().toggleFocus();
      useActiveGameStore.getState().togglePanel("right");
    });
    expect(useActiveGameStore.getState().layout).toMatchObject({
      left: "open",
      right: "slim",
      focus: false,
    });
    act(() => {
      useActiveGameStore.getState().setPanel("left", "slim");
      useActiveGameStore.getState().toggleFocus();
      useActiveGameStore.getState().setPanel("right", "open");
    });
    expect(useActiveGameStore.getState().layout.left).toBe("slim");
  });
  it("initializes once at each responsive tier and preserves later preferences", () => {
    for (const width of [390, 1100, 1440]) {
      useActiveGameStore.setState({ layoutInitialized: false });
      useActiveGameStore.getState().initializeLayout(width);
      expect(useActiveGameStore.getState().layout.left).toBe(
        width === 1100 ? "slim" : "open",
      );
      useActiveGameStore.getState().initializeLayout(1100);
      expect(useActiveGameStore.getState().layout.left).toBe(
        width === 1100 ? "slim" : "open",
      );
    }
  });
  it("hides and restores modules through the declared-module chooser", () => {
    shell();
    fireEvent.click(screen.getByRole("button", { name: "Hide Stamina" }));
    expect(screen.queryByLabelText("Hide Stamina")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Layout and HUD" }));
    const stanza = screen.getByRole("group", { name: "Stamina" });
    fireEvent.click(within(stanza).getByRole("button", { name: "On change" }));
    expect(useActiveGameStore.getState().layout.modules.stamina).toBe(
      "on_change",
    );
    fireEvent.click(within(stanza).getByRole("button", { name: "Always" }));
    expect(useActiveGameStore.getState().layout.modules.stamina).toBe("always");
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
  });
  it("opens Character, Here, Journal and the action tray with named controls", () => {
    shell();
    for (const [label, title] of [
      ["Open Character", "Character"],
      ["Open Here", "Here"],
      ["Open Journal", "Journal"],
      ["Open action tray", "Actions"],
    ]) {
      if (!label || !title) throw new Error("Invalid test case");
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("dialog")).toHaveAccessibleName(title);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    }
    for (const button of screen.getAllByRole("button"))
      expect(button).toHaveAccessibleName();
  });
  it("drafts suggestions without sending, locks busy input and preserves failure draft", () => {
    shell();
    fireEvent.click(screen.getByText("Look closer"));
    expect(screen.getByLabelText("Your action")).toHaveValue("Look closer");
    expect(useActiveGameStore.getState().pendingInput).toBeNull();
    fireEvent.change(screen.getByLabelText("Your action"), {
      target: { value: "Wait" },
    });
    fireEvent.focus(screen.getByLabelText("Your action"));
    fireEvent.blur(screen.getByLabelText("Your action"));
    act(() => {
      useActiveGameStore.setState({
        inputMode: "thinking",
        pendingInput: "Wait",
      });
    });
    expect(screen.getByLabelText("Your action")).toBeDisabled();
    expect(screen.getByLabelText("Send action")).toBeDisabled();
    expect(screen.getByTestId("turn-pending")).toHaveTextContent("Wait");
    act(() => {
      useActiveGameStore.setState({
        inputMode: "drafting",
        pendingInput: null,
        lastError: "Try your action again.",
      });
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Try your action again.",
    );
    expect(screen.getByLabelText("Your action")).toHaveValue("Wait");
  });
  it("shows on-change values only after a real change and removes them after eight seconds", () => {
    vi.useFakeTimers();
    const module = corePlayView.modules.find(
      (entry) => entry.kind === "vitals",
    );
    if (!module || !module.fields[0]) throw new Error("Missing fixture");
    const { rerender } = render(<PopInCard module={module} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    rerender(
      <PopInCard
        module={{ ...module, fields: [{ ...module.fields[0], value: 80 }] }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("80");
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
  it("exposes the three fixtures and fullscreen gallery route", () => {
    const { unmount } = render(
      <MemoryRouter>
        <PlayFixtureGallery />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(3);
    unmount();
    render(
      <MemoryRouter initialEntries={["/_test_gallery?play=social"]}>
        <PlayFixtureGallery />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("play-shell")).toBeInTheDocument();
  });
});
