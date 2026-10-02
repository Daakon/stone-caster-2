import { z } from "zod";
import type { GameState } from "./chimera-runtime.js";

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

/** Version-1 server projection consumed by the Phase 0B shell.
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
  const label = typeof value === "string" ? value.trim() : "";
  return label &&
    !/^unknown(?:\s|$)/i.test(label) &&
    !/^[\da-f]{8}-[\da-f-]{27}$/i.test(label)
    ? label
    : undefined;
}

/** Compatible shards contain player-visible data only, never an internal prompt. */
export type PlaySnapshot = Omit<GameState, "compiled_system_prompt"> & {
  play_view: PlayView;
};
