import { z } from "zod";
import {
  ActiveContentChoiceSchema,
  EntitlementViewSchema,
  TierLimitsSchema,
  TierPolicyViewSchema,
  type EntitlementView,
  type TierPolicyView,
} from "../../../../shared/src/types/chimera-entitlements.js";
import { EntitlementsRepository } from "../../db/repos/entitlements.repo.js";
import type { Request } from "express";
import { ServiceError } from "../../utils/serviceError.js";
import { ApiErrorCode } from "../../../../shared/src/types/api.js";

type Repository = Pick<
  EntitlementsRepository,
  | "active"
  | "choose"
  | "assertGameWritable"
  | "policies"
  | "setTier"
  | "assign"
  | "createStory"
>;
const reasons = [
  "ENTITLEMENT_NOT_CONFIGURED",
  "STORY_LIMIT_REACHED",
  "GAME_LIMIT_REACHED",
  "STORY_READ_ONLY_TIER_LIMIT",
  "GAME_READ_ONLY_TIER_LIMIT",
  "CHOICES_EXCEED_TIER_LIMIT",
  "CHOICES_NOT_OWNED",
  "TIER_NOT_FOUND",
] as const;
const labels: Record<(typeof reasons)[number], string> = {
  ENTITLEMENT_NOT_CONFIGURED:
    "Account limits are not configured yet. Please try again after configuration.",
  STORY_LIMIT_REACHED:
    "Your story limit has been reached. Delete a story or upgrade to create another.",
  GAME_LIMIT_REACHED:
    "Your saved-game limit has been reached. Delete a saved game or upgrade to start another.",
  STORY_READ_ONLY_TIER_LIMIT:
    "This story is read-only under your current tier. Choose it as active, delete another item, or upgrade.",
  GAME_READ_ONLY_TIER_LIMIT:
    "This game is read-only under your current tier. Choose it as active, delete another item, or upgrade.",
  CHOICES_EXCEED_TIER_LIMIT:
    "Your active selection exceeds your configured limits.",
  CHOICES_NOT_OWNED: "Every selected item must belong to your account.",
  TIER_NOT_FOUND: "That tier is not configured.",
};
export function entitlementFailure(error: unknown): ServiceError {
  const message = error instanceof Error ? error.message : "";
  const reason = reasons.find((candidate) => message.includes(candidate));
  return new ServiceError(
    reason === "ENTITLEMENT_NOT_CONFIGURED" ? 503 : reason ? 403 : 500,
    {
      code: reason ? ApiErrorCode.FORBIDDEN : ApiErrorCode.INTERNAL_ERROR,
      message: reason ? labels[reason] : "Unable to load entitlement settings",
      details: reason ? { entitlement_code: reason } : undefined,
    },
  );
}
export class EntitlementsService {
  constructor(private readonly repo: Repository) {}
  static forRequest = (request: Request) =>
    new EntitlementsService(EntitlementsRepository.forRequest(request));
  private async checked<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw entitlementFailure(error);
    }
  }
  active(): Promise<EntitlementView> {
    return this.checked(async () =>
      EntitlementViewSchema.parse(await this.repo.active()),
    );
  }
  async choose(input: unknown): Promise<EntitlementView> {
    const choice = ActiveContentChoiceSchema.parse(input);
    return this.checked(async () =>
      EntitlementViewSchema.parse(await this.repo.choose(choice)),
    );
  }
  assertGameWritable(gameId: string) {
    return this.checked(() =>
      this.repo.assertGameWritable(z.string().uuid().parse(gameId)),
    );
  }
  policies(): Promise<TierPolicyView> {
    return this.checked(async () =>
      TierPolicyViewSchema.parse(await this.repo.policies()),
    );
  }
  async setTier(input: unknown): Promise<TierPolicyView> {
    const policy = TierLimitsSchema.extend({ make_default: z.boolean() }).parse(
      input,
    );
    await this.checked(() => this.repo.setTier(policy, policy.make_default));
    return this.policies();
  }
  async assign(userId: string, input: unknown) {
    const user = z.string().uuid().parse(userId);
    const { tier_key } = z
      .object({ tier_key: TierLimitsSchema.shape.tier_key })
      .parse(input);
    await this.checked(() => this.repo.assign(user, tier_key));
    return { assigned: true as const };
  }
  createStory(userId: string, story: Record<string, unknown>) {
    return this.checked(() =>
      this.repo.createStory(z.string().uuid().parse(userId), story),
    );
  }
}
