import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MyCreationsPage } from "../MyCreationsPage";
import { MemoryRouter, useLocation } from "react-router-dom";
import * as ChimeraApi from "@/services/chimera-api";

const mockInitializeDraft = vi.hoisted(() => vi.fn());
const mockAccount = vi.hoisted(() => vi.fn());
vi.mock("@/features/entitlements/hooks", () => ({
  useEntitlements: mockAccount,
}));
vi.mock("@/features/entitlements/components/EntitlementPanel", () => ({
  EntitlementPanel: () => null,
}));

// Mock dependencies
vi.mock("@/services/chimera-api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/chimera-api")>();
  return {
    ...actual,
    useMyStories: vi.fn(),
    useMyWorlds: vi.fn(),
    useMyEntities: vi.fn(),
    useCreateWorld: vi.fn(),
    useDeleteEntity: vi.fn(),
    useDeleteStory: vi.fn(),
  };
});

// Mock the backend-backed story draft store used by the compose entry point.
vi.mock("@/features/casting-circle/stores/useStoryDraftStore", () => ({
  useStoryDraftStore: (
    selector: (state: {
      initializeDraft: typeof mockInitializeDraft;
    }) => unknown,
  ) => selector({ initializeDraft: mockInitializeDraft }),
}));

vi.mock("../components/editors/WorldEditorModal", () => ({
  WorldEditorModal: () => null,
}));

vi.mock("../components/editors/EntityEditorModal", () => ({
  EntityEditorModal: () => null,
}));

// Mock Radix Tabs (Simplified version again, focusing on rendering structure)
// Since we test logic affecting URL, we need to ensure clicks work.
vi.mock("@/components/ui/tabs", () => {
  const React = require("react");
  return {
    Tabs: ({ value, onValueChange, children }: any) => (
      <div data-testid="tabs-mock">
        <div data-testid="active-tab">{value}</div>
        {React.Children.map(children, (child: any) => {
          return React.cloneElement(child, {
            _onValueChange: onValueChange,
            _activeValue: value,
          });
        })}
      </div>
    ),
    TabsList: ({ children, _onValueChange }: any) => (
      <div>
        {React.Children.map(children, (child: any) => {
          // Check if child is valid
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, {
            onClick: () => _onValueChange && _onValueChange(child.props.value),
          } as any);
        })}
      </div>
    ),
    TabsTrigger: ({ children, onClick }: any) => (
      <button role="tab" onClick={onClick}>
        {children}
      </button>
    ),
    TabsContent: ({ value, children, _activeValue }: any) => {
      if (value !== _activeValue) return null;
      return <div>{children}</div>;
    },
  };
});

describe("MyCreationsPage Routing", () => {
  beforeEach(() => {
    // Reset mocks
    mockInitializeDraft.mockReset();
    mockAccount.mockReturnValue({
      ownerId: "owner",
      isError: false,
      data: {
        state: "ready",
        usage: { owned_stories: 0 },
        limits: { max_owned_stories: 2 },
        stories: [],
        writable_story_ids: [],
      },
      refetch: vi.fn(),
    });
    (ChimeraApi.useMyStories as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (ChimeraApi.useMyWorlds as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (ChimeraApi.useMyEntities as any).mockReturnValue({
      data: [],
      isLoading: false,
    });
    // Make useCreateWorld return a dummy hook result to avoid crashes if it's rendered
    (ChimeraApi.useCreateWorld as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (ChimeraApi.useDeleteEntity as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (ChimeraApi.useDeleteStory as any).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("defaults to stories tab when no param provided", () => {
    render(
      <MemoryRouter initialEntries={["/my-creations"]}>
        <MyCreationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("active-tab")).toHaveTextContent("stories");
    expect(screen.getByText("Compose Story")).toBeInTheDocument();
  });

  it("loads worlds tab from URL param", () => {
    render(
      <MemoryRouter initialEntries={["/my-creations?tab=worlds"]}>
        <MyCreationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("active-tab")).toHaveTextContent("worlds");
    // Check text that only appears in Worlds tab
    expect(screen.getByText("Create World")).toBeInTheDocument();
  });

  it("does not fetch worlds if tab is stories", () => {
    render(
      <MemoryRouter initialEntries={["/my-creations?tab=stories"]}>
        <MyCreationsPage />
      </MemoryRouter>,
    );

    // Check if useMyWorlds was called with enabled: false (or checking that data isn't displayed if we relied on it)
    // More robust: spy on the hook arguments.
    expect(ChimeraApi.useMyWorlds).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(ChimeraApi.useMyEntities).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it("creates a backend draft before routing to the compose wizard", async () => {
    mockInitializeDraft.mockResolvedValue("story-123");

    function LocationProbe() {
      return <output data-testid="location">{useLocation().pathname}</output>;
    }

    render(
      <MemoryRouter initialEntries={["/my-creations"]}>
        <MyCreationsPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /compose story/i }));

    await waitFor(() => {
      expect(mockInitializeDraft).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/stories/story-123/compose/world",
      );
    });
  });

  it("does not create a draft when configuration is pending or the cap is reached", () => {
    mockAccount.mockReturnValue({
      ownerId: "owner",
      isError: false,
      data: { state: "configuration_pending" },
    });
    const view = render(
      <MemoryRouter>
        <MyCreationsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Compose Story" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Compose Story" }));
    expect(mockInitializeDraft).not.toHaveBeenCalled();
    mockAccount.mockReturnValue({
      ownerId: "owner",
      isError: false,
      data: {
        state: "ready",
        usage: { owned_stories: 2 },
        limits: { max_owned_stories: 2 },
        stories: [],
        writable_story_ids: [],
      },
    });
    view.rerender(
      <MemoryRouter>
        <MyCreationsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Compose Story" }),
    ).toBeDisabled();
  });

  it("switches tab updates URL (simulated via mock)", async () => {
    // In MemoryRouter, we can't easily check internal state change unless we use a wrapper that exposes it
    // or we can spy on setSearchParams?
    // Actually, integration tests usually check the visual outcome.
    // If we click "Worlds", the component should call setSearchParams.
    // The router should update.
    // And the component re-renders with new value.
    // Let's verify standard flow.

    const { container } = render(
      <MemoryRouter initialEntries={["/my-creations"]}>
        <MyCreationsPage />
      </MemoryRouter>,
    );

    // Initial
    expect(screen.getByTestId("active-tab")).toHaveTextContent("stories");

    // Click Worlds
    fireEvent.click(screen.getByRole("tab", { name: /worlds/i }));

    // Expect update (MemoryRouter updates synchronously usually for this)
    expect(screen.getByTestId("active-tab")).toHaveTextContent("worlds");
  });
});
