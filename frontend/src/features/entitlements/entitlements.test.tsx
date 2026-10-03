import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import type {
  EntitlementView,
  TierPolicyView,
} from "@shared/types/chimera-entitlements";
import { useAuthStore } from "@/store/auth";
import { entitlementsClient } from "@/services/chimera.entitlements";
import { useEntitlements } from "./hooks";
import { EntitlementPanel } from "./components/EntitlementPanel";
import { ActiveItemPicker } from "./components/ActiveItemPicker";
import TierLimitsPage from "@/pages/admin/chimera/TierLimitsPage";
vi.mock("@/services/chimera.entitlements", () => ({
  entitlementsClient: {
    active: vi.fn(),
    choose: vi.fn(),
    policies: vi.fn(),
    setTier: vi.fn(),
    assign: vi.fn(),
  },
}));
const storyA = "a0000000-0000-4000-8000-000000000001",
  storyB = "a0000000-0000-4000-8000-000000000002",
  gameA = "b0000000-0000-4000-8000-000000000001";
const ready: Extract<EntitlementView, { state: "ready" }> = {
  state: "ready",
  tier_key: "fixture",
  limits: { max_owned_stories: 1, max_saved_games: 1 },
  usage: { owned_stories: 2, saved_games: 1 },
  stories: [
    { id: storyA, label: "First story" },
    { id: storyB, label: "Second story" },
  ],
  games: [{ id: gameA, label: "Frozen adventure" }],
  selected_story_ids: [storyA],
  selected_game_ids: [gameA],
  writable_story_ids: [storyA],
  writable_game_ids: [gameA],
};
const policies: TierPolicyView = {
  default_tier_key: null,
  tiers: [{ tier_key: "fixture", max_owned_stories: 1, max_saved_games: 1 }],
};
let client: QueryClient;
function wrap(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
}
function Panel() {
  const account = useEntitlements();
  return <EntitlementPanel key={account.ownerId} account={account} />;
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  useAuthStore.setState({ userId: storyA, isAuthenticated: true });
  vi.mocked(entitlementsClient.active).mockReset().mockResolvedValue(ready);
  vi.mocked(entitlementsClient.choose).mockReset().mockResolvedValue(ready);
  vi.mocked(entitlementsClient.policies)
    .mockReset()
    .mockResolvedValue(policies);
  vi.mocked(entitlementsClient.setTier).mockReset().mockResolvedValue(policies);
  vi.mocked(entitlementsClient.assign).mockReset().mockResolvedValue();
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({ userId: null, isAuthenticated: false });
});
describe("owner active choices", () => {
  it("sends the whole set, keeps games, and prevents over-cap choices", () => {
    const save = vi.fn();
    wrap(
      <ActiveItemPicker view={ready} busy={false} error={null} onSave={save} />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Second story/ }));
    expect(
      screen.getByRole("button", { name: "Save active choices" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /First story/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save active choices" }),
    );
    expect(save).toHaveBeenCalledWith({
      story_ids: [storyB],
      game_ids: [gameA],
    });
  });
  it("retains downgrade priorities until corrected and allows recent defaults at zero caps", () => {
    const save = vi.fn();
    wrap(
      <ActiveItemPicker
        view={{
          ...ready,
          limits: { max_owned_stories: 0, max_saved_games: 0 },
          selected_story_ids: [storyA, storyB],
        }}
        busy={false}
        error={null}
        onSave={save}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /First story/ })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save active choices" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Use recent activity" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save active choices" }),
    );
    expect(save).toHaveBeenCalledWith({ story_ids: [], game_ids: [] });
  });
  it("persists priority order and locks all inputs while saving", () => {
    const save = vi.fn();
    const view = {
      ...ready,
      limits: { ...ready.limits, max_owned_stories: 2 },
      selected_story_ids: [storyA, storyB],
    };
    const ui = wrap(
      <ActiveItemPicker view={view} busy={false} error={null} onSave={save} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move Second story earlier" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save active choices" }),
    );
    expect(save).toHaveBeenCalledWith({
      story_ids: [storyB, storyA],
      game_ids: [gameA],
    });
    ui.rerender(
      <QueryClientProvider client={client}>
        <ActiveItemPicker view={view} busy error={null} onSave={save} />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("checkbox", { name: /First story/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Saving choices…" }),
    ).toBeDisabled();
  });
  it("shows real usage, preserves unsaved choices after failure, updates cache on retry, restores focus", async () => {
    vi.mocked(entitlementsClient.choose).mockRejectedValueOnce(
      new Error("Choice could not be saved."),
    );
    wrap(<Panel />);
    const trigger = await screen.findByRole("button", {
      name: "Choose active stories and saved games",
    });
    expect(
      screen.getByRole("progressbar", { name: "Stories you own" }),
    ).toHaveAttribute("aria-valuetext", "2 of 1");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("checkbox", { name: /First story/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Second story/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save active choices" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choice could not be saved.",
    );
    expect(
      screen.getByRole("checkbox", { name: /Second story/ }),
    ).toBeChecked();
    vi.mocked(entitlementsClient.choose).mockResolvedValueOnce({
      ...ready,
      selected_story_ids: [storyB],
      writable_story_ids: [storyB],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save active choices" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(client.getQueryData(["entitlements", "active", storyA])).toEqual(
      expect.objectContaining({ selected_story_ids: [storyB] }),
    );
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
  it("never invents counts for pending configuration and does not reuse another owner's cache", async () => {
    vi.mocked(entitlementsClient.active).mockResolvedValueOnce({
      state: "configuration_pending",
    });
    wrap(<Panel />);
    await screen.findByText("Account limits pending");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    act(() => {
      useAuthStore.setState({ userId: storyB });
    });
    await screen.findByRole("button", {
      name: "Choose active stories and saved games",
    });
    expect(entitlementsClient.active).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(["entitlements", "active", storyA])).toEqual({
      state: "configuration_pending",
    });
  });
  it("hides stale controls when the account query fails and retries", async () => {
    vi.mocked(entitlementsClient.active).mockRejectedValue(
      new Error("Unavailable"),
    );
    wrap(<Panel />);
    expect(
      await screen.findByRole("alert", {}, { timeout: 3000 }),
    ).toHaveTextContent("could not be loaded");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    vi.mocked(entitlementsClient.active).mockResolvedValue(ready);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", {
      name: "Choose active stories and saved games",
    });
  });
});
describe("admin tier controls", () => {
  it("starts blank, requires explicit caps, and saves zero with explicit default choice", async () => {
    wrap(<TierLimitsPage />);
    await screen.findByRole("heading", { name: "Set tier limits" });
    expect(screen.getByLabelText("Owned-story limit")).toHaveValue(null);
    expect(screen.getByLabelText("Saved-game limit")).toHaveValue(null);
    fireEvent.submit(screen.getByRole("form", { name: "Set tier limits" }));
    expect(entitlementsClient.setTier).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "nonnegative whole number",
    );
    fireEvent.change(screen.getByLabelText("Tier key"), {
      target: { value: "new-fixture" },
    });
    fireEvent.change(screen.getByLabelText("Owned-story limit"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Saved-game limit"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save tier limits" }));
    await screen.findByText("Tier limits saved.");
    expect(entitlementsClient.setTier).toHaveBeenCalledWith({
      tier_key: "new-fixture",
      max_owned_stories: 0,
      max_saved_games: 2,
      make_default: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear form" }));
    expect(screen.getByLabelText("Tier key")).toHaveValue("");
  });
  it("edits real policy values, retains values on rejection, never silently changes the default", async () => {
    vi.mocked(entitlementsClient.setTier).mockRejectedValueOnce(
      new Error("Limits not saved."),
    );
    wrap(<TierLimitsPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit fixture" }),
    );
    expect(screen.getByLabelText("Owned-story limit")).toHaveValue(1);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save tier limits" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Limits not saved.",
    );
    expect(screen.getByLabelText("Tier key")).toHaveValue("fixture");
    expect(entitlementsClient.setTier).toHaveBeenCalledWith({
      tier_key: "fixture",
      max_owned_stories: 1,
      max_saved_games: 1,
      make_default: false,
    });
  });
  it("validates assignment and sends the selected configured tier", async () => {
    wrap(<TierLimitsPage />);
    await screen.findByLabelText("Account ID");
    fireEvent.change(screen.getByLabelText("Account ID"), {
      target: { value: "invalid" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Assign an account" }));
    expect(entitlementsClient.assign).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Account ID"), {
      target: { value: storyB },
    });
    fireEvent.change(screen.getByLabelText("Configured tier"), {
      target: { value: "fixture" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign tier" }));
    await screen.findByText("Account tier assigned.");
    expect(entitlementsClient.assign).toHaveBeenCalledWith(storyB, "fixture");
  });
  it("exposes no assignment choices or invented default without configured policies", async () => {
    vi.mocked(entitlementsClient.policies).mockResolvedValueOnce({
      tiers: [],
      default_tier_key: null,
    });
    wrap(<TierLimitsPage />);
    await screen.findByText("No tiers are configured.");
    expect(screen.getByLabelText("Configured tier")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Assign tier" })).toBeDisabled();
  });
  it("fails closed on a denied policy query", async () => {
    vi.mocked(entitlementsClient.policies).mockRejectedValue(
      new Error("Forbidden"),
    );
    wrap(<TierLimitsPage />);
    await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(screen.queryByLabelText("Tier key")).not.toBeInTheDocument();
  });
});
