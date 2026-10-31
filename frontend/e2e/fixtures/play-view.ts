import type { Page } from "@playwright/test";
import type { PlayView } from "../../src/features/play/model/play-view";
import type { LogEntry } from "../../src/features/play/components/Narrative/types";

export const gameId = "a0000000-0000-4000-8000-000000000001";
const playerId = "b0000000-0000-4000-8000-000000000002";

export async function mockPlayApi(
  page: Page,
  storedTheme: "dark" | "light" | "system" | null = "dark",
  playView?: PlayView,
  logs?: LogEntry[],
  suggestions: string[] = [],
) {
  await page.addInitScript((theme) => {
    if (theme === null) localStorage.removeItem("stonecaster-ui-theme");
    else localStorage.setItem("stonecaster-ui-theme", theme);
  }, storedTheme);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === "/api/me"
        ? { user: null, kind: "guest", config: { enableChimeraUi: true } }
        : path === "/api/request-access/status"
          ? {
              request: {
                id: "request-1",
                email: "player@example.com",
                user_id: null,
                note: null,
                status: "approved",
                reason: null,
                approved_by: null,
                approved_at: null,
                denied_by: null,
                denied_at: null,
                meta: {},
                created_at: "2026-01-01",
                updated_at: "2026-01-01",
              },
            }
          : path === `/api/chimera/play/${gameId}`
            ? {
                id: gameId,
                ...(playView ? { play_view: playView } : {}),
                story_id: "d0000000-0000-4000-8000-000000000004",
                player_id: playerId,
                mechanical_state: {
                  index: { player_id: playerId },
                  entities: {
                    [playerId]: {
                      id: playerId,
                      type: "PLAYER",
                      properties: {
                        name: "Kiera",
                        current_stamina: 80,
                        satiety: 70,
                      },
                    },
                  },
                },
                narrative_focus: {
                  dialogue_history: logs?.map((log) => ({
                    ...log,
                    content: log.text,
                  })) ?? [
                    {
                      id: "intro",
                      role: "narrator",
                      content: "The road opens before you.",
                      timestamp: "2026-01-01T00:00:00.000Z",
                    },
                  ],
                  scene_context: {
                    location: "The Crossroads",
                    time: "Dusk",
                    atmosphere: "Quiet",
                  },
                },
                scene_registry: {
                  active_scene_id: "crossroads",
                  entity_locations: {},
                  node_states: {},
                },
                action_queue: suggestions,
                compiled_system_prompt: "",
                updated_at: "2026-01-01T00:00:00.000Z",
              }
            : null;
    await route.fulfill({
      status: data ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(
        data ? { ok: true, data } : { ok: false, error: "Unmocked API route" },
      ),
    });
  });
}
