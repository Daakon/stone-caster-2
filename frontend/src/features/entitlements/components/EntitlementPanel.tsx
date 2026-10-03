import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { entitlementsClient } from "@/services/chimera.entitlements";
import { useEntitlements } from "../hooks";
import { ActiveItemPicker } from "./ActiveItemPicker";
import type { ActiveContentChoice } from "@shared/types/chimera-entitlements";
import "../entitlements.css";

function Usage({
  label,
  used,
  cap,
}: {
  label: string;
  used: number;
  cap: number;
}) {
  const atCap = used >= cap;
  return (
    <div className="sc-usage">
      <div>
        <span>{label}</span>
        <strong>
          {used} <span>/ {cap}</span>
        </strong>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={Math.min(used, cap)}
        aria-valuetext={`${String(used)} of ${String(cap)}`}
        className={`sc-meter${atCap ? " sc-at-cap" : ""}`}
      >
        <span
          style={{
            width: `${String(cap === 0 ? 0 : Math.min(100, (used / cap) * 100))}%`,
          }}
        />
      </div>
      {atCap && (
        <p className="sc-notice">
          {used > cap
            ? "Over your limit. Excess items are read-only."
            : "At your limit."}
        </p>
      )}
    </div>
  );
}
export function EntitlementPanel({
  account,
}: {
  account: ReturnType<typeof useEntitlements>;
}) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (choice: ActiveContentChoice) =>
      entitlementsClient.choose(choice),
    onSuccess: (value) => {
      client.setQueryData(account.queryKey, value);
      setOpen(false);
    },
  });
  return (
    <aside
      className="sc-entitlements sc-entitlement-panel"
      aria-label="Your account limits"
    >
      {account.isPending ? (
        <p role="status">Loading your account limits…</p>
      ) : account.isError ? (
        <>
          <p role="alert" className="sc-notice">
            Your account limits could not be loaded.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void account.refetch();
            }}
          >
            Try again
          </Button>
        </>
      ) : account.data.state === "configuration_pending" ? (
        <>
          <h2>Account limits pending</h2>
          <p className="sc-hint">
            Your account limits are not configured yet. Story and saved-game
            creation will be available after configuration.
          </p>
        </>
      ) : (
        <>
          <h2>
            Your plan · <span className="sc-key">{account.data.tier_key}</span>
          </h2>
          <Usage
            label="Stories you own"
            used={account.data.usage.owned_stories}
            cap={account.data.limits.max_owned_stories}
          />
          <Usage
            label="Saved games"
            used={account.data.usage.saved_games}
            cap={account.data.limits.max_saved_games}
          />
          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (!save.isPending) {
                save.reset();
                setOpen(next);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                Choose active stories and saved games
              </Button>
            </DialogTrigger>
            <DialogContent className="sc-entitlements sc-picker-dialog">
              <DialogHeader>
                <DialogTitle>Choose active items</DialogTitle>
                <DialogDescription>
                  Set which stories stay editable and which saved games you can
                  continue.
                </DialogDescription>
              </DialogHeader>
              <ActiveItemPicker
                view={account.data}
                busy={save.isPending}
                error={save.error?.message ?? null}
                onSave={(choice) => {
                  save.mutate(choice);
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </aside>
  );
}
