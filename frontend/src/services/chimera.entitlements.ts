import { z } from "zod";
import { apiGet, apiPut, apiPatch, apiPost, type ApiResponse } from "@/lib/api";
import {
  ActiveContentChoiceSchema,
  EntitlementViewSchema,
  TierLimitsSchema,
  TierPolicyViewSchema,
  type ActiveContentChoice,
  type EntitlementView,
  type TierLimits,
  type TierPolicyView,
} from "@shared/types/chimera-entitlements";

function read<T>(
  result: ApiResponse<unknown>,
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false };
  },
): T {
  if (!result.ok) throw new Error(result.error.message);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success)
    throw new Error("Account limits could not be read. Try again.");
  return parsed.data;
}
export const entitlementsClient = {
  active: async (): Promise<EntitlementView> => {
    return read(
      await apiGet("/api/me/entitlements/active"),
      EntitlementViewSchema,
    );
  },
  choose: async (choice: ActiveContentChoice): Promise<EntitlementView> => {
    return read(
      await apiPut(
        "/api/me/entitlements/active",
        ActiveContentChoiceSchema.parse(choice),
      ),
      EntitlementViewSchema,
    );
  },
  policies: async (): Promise<TierPolicyView> => {
    return read(await apiGet("/api/admin/tier-limits"), TierPolicyViewSchema);
  },
  setTier: async (
    policy: TierLimits & { make_default: boolean },
  ): Promise<TierPolicyView> => {
    const validated = {
      ...TierLimitsSchema.parse(policy),
      make_default: z.boolean().parse(policy.make_default),
    };
    return read(
      await apiPatch("/api/admin/tier-limits", validated),
      TierPolicyViewSchema,
    );
  },
  assign: async (userId: string, tierKey: string): Promise<void> => {
    const user = z.string().uuid().parse(userId);
    const tier_key = TierLimitsSchema.shape.tier_key.parse(tierKey);
    read(
      await apiPost(`/api/admin/users/${user}/tier`, { tier_key }),
      z.object({ assigned: z.literal(true) }),
    );
  },
};
