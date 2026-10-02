import { z } from "zod";

export const TierLimitsSchema = z.object({
  tier_key: z.string().trim().min(1).max(100),
  max_owned_stories: z.number().int().nonnegative(),
  max_saved_games: z.number().int().nonnegative(),
});
export type TierLimits = z.infer<typeof TierLimitsSchema>;
const ids = z
  .array(z.string().uuid())
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate selection",
  );
export const ActiveContentChoiceSchema = z
  .object({ story_ids: ids, game_ids: ids })
  .strict();
export type ActiveContentChoice = z.infer<typeof ActiveContentChoiceSchema>;
const item = z.object({ id: z.string().uuid(), label: z.string() });
export const EntitlementViewSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("configuration_pending") }),
  z.object({
    state: z.literal("ready"),
    tier_key: z.string(),
    limits: TierLimitsSchema.omit({ tier_key: true }),
    usage: z.object({
      owned_stories: z.number().int().nonnegative(),
      saved_games: z.number().int().nonnegative(),
    }),
    stories: z.array(item),
    games: z.array(item),
    selected_story_ids: ids,
    selected_game_ids: ids,
    writable_story_ids: ids,
    writable_game_ids: ids,
  }),
]);
export type EntitlementView = z.infer<typeof EntitlementViewSchema>;
export const TierPolicyViewSchema = z.object({
  tiers: z.array(TierLimitsSchema),
  default_tier_key: z.string().nullable(),
});
export type TierPolicyView = z.infer<typeof TierPolicyViewSchema>;
