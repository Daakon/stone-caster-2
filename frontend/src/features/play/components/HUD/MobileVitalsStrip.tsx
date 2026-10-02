import { Button } from "@/components/ui/button";
import type { PlayView } from "../../model/play-view";
import { Vital } from "./Vital";
import { ConditionPill } from "./ConditionPill";
export function MobileVitalsStrip({
  view,
  onOpen,
}: {
  view: PlayView;
  onOpen: () => void;
}) {
  if (!view.modules.length && !view.player) return null;
  return (
    <Button
      variant="ghost"
      className="sc-mobile-vitals"
      aria-label="Open Character"
      onClick={onOpen}
    >
      {view.modules.map((module) =>
        module.kind === "vitals"
          ? module.fields.map((field) => (
              <Vital key={field.id} field={field} compact />
            ))
          : module.kind === "conditions"
            ? module.fields.map((field) => (
                <ConditionPill key={field.id} value={field.value} />
              ))
            : null,
      )}
      {!view.modules.some(
        (module) => module.kind === "vitals" || module.kind === "conditions",
      ) && <span>Character</span>}
    </Button>
  );
}
