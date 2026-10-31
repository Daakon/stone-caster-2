import { record, text, strings } from "../utils/value";
import type { LogEntry } from "../components/Narrative/types";

import { PlayViewSchema, type PlayView } from "@shared/types/chimera-play-view";
export { PlayViewSchema } from "@shared/types/chimera-play-view";
export type {
  PlayView,
  HudModule,
  VitalField,
} from "@shared/types/chimera-play-view";

function visibleLabel(value: unknown): string | undefined {
  const label = text(value).trim();
  return label &&
    !/^unknown(?:\s|$)/i.test(label) &&
    !/^[\da-f]{8}-[\da-f-]{27}$/i.test(label)
    ? label
    : undefined;
}

/** Validate the shared server projection. Legacy snapshots fail closed for
 * HUD/cast; never install a sample fixture in a live session. */
export function readPlayView(state: unknown): PlayView {
  const root = record(state);
  if (root.play_view !== undefined) return PlayViewSchema.parse(root.play_view);
  const narrative = record(
    root.narrative_focus ?? root.tier0_narrative ?? root.narrative,
  );
  const scene = record(narrative.scene_context);
  const safeScene = {
    name: visibleLabel(scene.location_name ?? scene.location),
    time: visibleLabel(scene.time),
    atmosphere: visibleLabel(scene.atmosphere),
  };
  return {
    version: 1,
    rulesets: [],
    modules: [],
    title: visibleLabel(root.story_title),
    scene: Object.values(safeScene).some(Boolean) ? safeScene : undefined,
  };
}

/** Existing plain transcript adapter, not Phase 2 typed narration/entity links. */
export function readTranscript(state: unknown): LogEntry[] {
  const root = record(state);
  const narrative = record(
    root.narrative_focus ?? root.tier0_narrative ?? root.narrative,
  );
  const history: unknown[] = Array.isArray(narrative.dialogue_history)
    ? narrative.dialogue_history
    : [];
  return history.flatMap((entry, index) => {
    const log = record(entry);
    const role =
      log.role ??
      (log.speaker === "Narrator"
        ? "narrator"
        : log.speaker === "System"
          ? "system"
          : "player");
    let content: unknown = log.text ?? log.content;
    for (
      let depth = 0;
      depth < 4 &&
      typeof content === "string" &&
      /^(?:\[|\{)/.test(content.trim());
      depth++
    ) {
      try {
        const decoded: unknown = JSON.parse(content);
        content =
          typeof decoded === "string"
            ? decoded
            : (record(decoded).narration ??
              record(decoded).text ??
              record(decoded).content ??
              "");
      } catch {
        break;
      }
    }
    const prose = text(content)
      .split("\n")
      .filter(
        (line) =>
          !/NARRATOR LENS|DIRECTOR'S NOTE|^ROLE:|^PERSPECTIVE:/.test(
            line.trim(),
          ),
      )
      .join("\n")
      .trim();
    if (
      !prose ||
      prose.includes("[THOUGHT]") ||
      (role !== "narrator" && role !== "player" && role !== "system")
    )
      return [];
    return [
      {
        id: text(log.id) || `log-${String(index)}`,
        role,
        text: prose,
        timestamp: new Date(text(log.timestamp) || 0),
      },
    ];
  });
}

export function readSuggestions(state: unknown): string[] {
  const root = record(state);
  const narrative = record(
    root.narrative_focus ?? root.tier0_narrative ?? root.narrative,
  );
  const queue = strings(root.action_queue);
  return queue.length
    ? queue
    : strings(record(narrative.scene_context).available_actions);
}
