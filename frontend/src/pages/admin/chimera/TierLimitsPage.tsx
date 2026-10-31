import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { entitlementsClient } from "@/services/chimera.entitlements";
import { useTierPolicies } from "@/features/entitlements/hooks";
import {
  TierLimitsSchema,
  type TierLimits,
} from "@shared/types/chimera-entitlements";
import "@/features/entitlements/entitlements.css";

const count = z
  .string()
  .regex(/^\d+$/, "Enter a whole number, including zero.")
  .transform(Number)
  .pipe(z.number().int().nonnegative().max(2147483647));
const draftSchema = z.object({
  stories: count,
  games: count,
  make_default: z.boolean(),
});
const emptyDraft = {
  tier_key: "",
  stories: "",
  games: "",
  make_default: false,
};
export default function TierLimitsPage() {
  const account = useTierPolicies();
  const client = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft);
  const [validation, setValidation] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [assignedTier, setAssignedTier] = useState("");
  const [assignmentValidation, setAssignmentValidation] = useState<
    string | null
  >(null);
  const save = useMutation({
    mutationFn: (policy: TierLimits & { make_default: boolean }) =>
      entitlementsClient.setTier(policy),
    onSuccess: (value) => {
      client.setQueryData(account.queryKey, value);
      void client.invalidateQueries({ queryKey: ["entitlements", "active"] });
    },
  });
  const assign = useMutation({
    mutationFn: ({ user, tier }: { user: string; tier: string }) =>
      entitlementsClient.assign(user, tier),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["entitlements", "active"] });
    },
  });
  function edit(policy: TierLimits) {
    save.reset();
    setValidation(null);
    setDraft({
      tier_key: policy.tier_key,
      stories: String(policy.max_owned_stories),
      games: String(policy.max_saved_games),
      make_default: false,
    });
  }
  function saveDraft() {
    if (save.isPending) return;
    setValidation(null);
    save.reset();
    const parsed = draftSchema.safeParse(draft);
    const tier = TierLimitsSchema.shape.tier_key.safeParse(draft.tier_key);
    if (!parsed.success || !tier.success) {
      setValidation(
        "Enter a tier key and a nonnegative whole number for each limit.",
      );
      return;
    }
    const value = parsed.data;
    save.mutate({
      tier_key: tier.data,
      max_owned_stories: value.stories,
      max_saved_games: value.games,
      make_default: value.make_default,
    });
  }
  function assignTier() {
    if (assign.isPending) return;
    setAssignmentValidation(null);
    assign.reset();
    if (
      !z.string().uuid().safeParse(userId.trim()).success ||
      !account.data?.tiers.some((tier) => tier.tier_key === assignedTier)
    ) {
      setAssignmentValidation(
        "Enter a valid account ID and choose a configured tier.",
      );
      return;
    }
    assign.mutate({ user: userId.trim(), tier: assignedTier });
  }
  return (
    <section
      className="sc-entitlements sc-tier-page"
      aria-labelledby="tier-page-title"
    >
      <header>
        <h1 id="tier-page-title">Tier limits</h1>
        <p className="sc-hint">
          Configure owned-story and saved-game limits. No tier or limit is
          chosen for you.
        </p>
      </header>
      {account.isPending ? (
        <p role="status">Loading tier limits…</p>
      ) : account.isError ? (
        <>
          <p role="alert">Tier limits could not be loaded.</p>
          <Button
            variant="outline"
            onClick={() => {
              void account.refetch();
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <>
          <section
            className="sc-tier-card"
            aria-labelledby="configured-tiers-title"
          >
            <h2 id="configured-tiers-title">Configured tiers</h2>
            <p className="sc-hint">
              {account.data.default_tier_key ? (
                <>
                  Default tier:{" "}
                  <span className="sc-key">
                    {account.data.default_tier_key}
                  </span>
                </>
              ) : (
                "No default tier is configured. Accounts without an assignment cannot create stories or saved games yet."
              )}
            </p>
            {account.data.tiers.length === 0 ? (
              <p>No tiers are configured.</p>
            ) : (
              <ul className="sc-tier-list">
                {account.data.tiers.map((policy) => (
                  <li key={policy.tier_key}>
                    <div>
                      <strong className="sc-key">{policy.tier_key}</strong>
                      <p className="sc-hint">
                        {policy.max_owned_stories} owned stories ·{" "}
                        {policy.max_saved_games} saved games
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() => {
                        edit(policy);
                      }}
                      aria-label={`Edit ${policy.tier_key}`}
                    >
                      Edit limits
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="sc-tier-forms">
            <form
              className="sc-tier-card"
              onSubmit={(event) => {
                event.preventDefault();
                saveDraft();
              }}
              aria-labelledby="tier-edit-title"
            >
              <h2 id="tier-edit-title">Set tier limits</h2>
              <fieldset disabled={save.isPending} className="sc-tier-fields">
                <label htmlFor="tier-key">
                  Tier key
                  <Input
                    id="tier-key"
                    required
                    maxLength={100}
                    value={draft.tier_key}
                    onChange={(event) => {
                      save.reset();
                      setValidation(null);
                      setDraft({ ...draft, tier_key: event.target.value });
                    }}
                  />
                </label>
                <label htmlFor="story-limit">
                  Owned-story limit
                  <Input
                    id="story-limit"
                    type="number"
                    required
                    min={0}
                    max={2147483647}
                    step={1}
                    value={draft.stories}
                    onChange={(event) => {
                      save.reset();
                      setValidation(null);
                      setDraft({ ...draft, stories: event.target.value });
                    }}
                  />
                </label>
                <label htmlFor="game-limit">
                  Saved-game limit
                  <Input
                    id="game-limit"
                    type="number"
                    required
                    min={0}
                    max={2147483647}
                    step={1}
                    value={draft.games}
                    onChange={(event) => {
                      save.reset();
                      setValidation(null);
                      setDraft({ ...draft, games: event.target.value });
                    }}
                  />
                </label>
                <label className="sc-check-label">
                  <input
                    type="checkbox"
                    checked={draft.make_default}
                    onChange={(event) => {
                      save.reset();
                      setValidation(null);
                      setDraft({
                        ...draft,
                        make_default: event.target.checked,
                      });
                    }}
                  />
                  Use as the default for unassigned accounts
                </label>
              </fieldset>
              <p className="sc-hint">
                Zero prevents new items. Lowering a limit makes excess items
                read-only and preserves existing content and priorities.
              </p>
              {(validation || save.error) && (
                <p role="alert" className="sc-notice">
                  {validation ?? save.error?.message}
                </p>
              )}
              {save.isSuccess && <p role="status">Tier limits saved.</p>}
              <div className="sc-form-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    setDraft(emptyDraft);
                    setValidation(null);
                    save.reset();
                  }}
                >
                  Clear form
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving limits…" : "Save tier limits"}
                </Button>
              </div>
            </form>
            <form
              className="sc-tier-card"
              onSubmit={(event) => {
                event.preventDefault();
                assignTier();
              }}
              aria-labelledby="tier-assign-title"
            >
              <h2 id="tier-assign-title">Assign an account</h2>
              <fieldset
                disabled={assign.isPending || account.data.tiers.length === 0}
                className="sc-tier-fields"
              >
                <label htmlFor="tier-account">
                  Account ID
                  <Input
                    id="tier-account"
                    aria-describedby="tier-account-hint"
                    required
                    value={userId}
                    onChange={(event) => {
                      setUserId(event.target.value);
                      assign.reset();
                    }}
                  />
                </label>
                <small id="tier-account-hint" className="sc-hint">
                  Use the account's UUID.
                </small>
                <label htmlFor="assigned-tier">
                  Configured tier
                  <select
                    id="assigned-tier"
                    required
                    value={assignedTier}
                    onChange={(event) => {
                      setAssignedTier(event.target.value);
                      assign.reset();
                    }}
                  >
                    <option value="">Choose a tier</option>
                    {account.data.tiers.map((tier) => (
                      <option key={tier.tier_key} value={tier.tier_key}>
                        {tier.tier_key}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
              {(assignmentValidation || assign.error) && (
                <p role="alert" className="sc-notice">
                  {assignmentValidation ?? assign.error?.message}
                </p>
              )}
              {assign.isSuccess && <p role="status">Account tier assigned.</p>}
              <Button
                type="submit"
                disabled={assign.isPending || account.data.tiers.length === 0}
              >
                {assign.isPending ? "Assigning tier…" : "Assign tier"}
              </Button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}
