import { z } from "zod";
import { record, text, strings } from "../utils/value";
import type { LogEntry } from "../components/Narrative/types";

const field = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
});
const vital = field.extend({
  value: z.number().finite(),
  max: z.number().finite().positive().optional(),
  delta: z.number().finite().optional(),
  tone: z.enum(["stamina", "accent", "danger"]).default("accent"),
});
const base = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
});
const moduleSchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("vitals"), fields: z.array(vital).min(1) }),
  base.extend({
    kind: z.literal("conditions"),
    fields: z.array(field.extend({ value: z.string().min(1) })).min(1),
  }),
  base.extend({ kind: z.literal("pillars"), fields: z.array(vital).min(1) }),
  base.extend({
    kind: z.literal("values"),
    fields: z
      .array(
        field.extend({
          value: z.union([z.string().min(1), z.number().finite()]),
        }),
      )
      .min(1),
  }),
]);
const cast = z.object({
  id: z.string().min(1),
  // Only the observed alias and learned facts belong at this boundary.
  name: z.string().min(1),
  identified: z.boolean(),
  role: z.string().optional(),
  disposition: z.string().optional(),
  known_count: z.number().int().nonnegative().optional(),
});

/** Frontend contract for 0B. Phase 0C should move this schema to shared and
 * provide play_view in the GET response; the shell consumes this shape only.
 * No compiled prompt, raw NPC properties, or inferred resource defaults. */
export const PlayViewSchema = z
  .object({
    version: z.literal(1),
    title: z.string().transform(visibleLabel).optional(),
    committed_turn: z.number().int().nonnegative().optional(),
    rulesets: z.array(z.string()),
    player: z
      .object({ name: z.string().min(1), description: z.string().optional() })
      .optional(),
    scene: z
      .object({
        name: z.string().transform(visibleLabel).optional(),
        time: z.string().transform(visibleLabel).optional(),
        atmosphere: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .transform((scene) =>
        Object.values(scene).some((value) =>
          Array.isArray(value) ? value.length > 0 : Boolean(value),
        )
          ? scene
          : undefined,
      )
      .optional(),
    presence: z
      .object({
        availability: z.enum(["available", "empty"]),
        cast: z.array(cast),
      })
      .optional(),
    modules: z.array(moduleSchema),
  })
  .superRefine((view, context) => {
    const ids = new Set<string>();
    view.modules.forEach((module, index) => {
      if (!view.rulesets.includes(module.source))
        context.addIssue({
          code: "custom",
          path: ["modules", index, "source"],
          message: "Module source must be a declared ruleset",
        });
      if (ids.has(module.id))
        context.addIssue({
          code: "custom",
          path: ["modules", index, "id"],
          message: "Module IDs must be unique",
        });
      ids.add(module.id);
    });
    if (view.presence?.availability === "empty" && view.presence.cast.length)
      context.addIssue({
        code: "custom",
        path: ["presence"],
        message: "Empty presence cannot contain cast",
      });
  });
export type PlayView = z.infer<typeof PlayViewSchema>;
export type HudModule = PlayView["modules"][number];
export type VitalField = z.infer<typeof vital>;

function visibleLabel(value: unknown): string | undefined {
  const label = text(value).trim();
  return label &&
    !/^unknown(?:\s|$)/i.test(label) &&
    !/^[\da-f]{8}-[\da-f-]{27}$/i.test(label)
    ? label
    : undefined;
}

/** The current endpoint has no pinned declaration/disclosure projection.
 * Fail closed for HUD/cast; never install a sample fixture in a live session. */
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
