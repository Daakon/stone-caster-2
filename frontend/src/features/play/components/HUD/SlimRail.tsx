import { Button } from "@/components/ui/button";
import { MapPin, Layers, UserRound } from "lucide-react";
import type { PlayView } from "../../model/play-view";
import type { ModulePolicy } from "../../model/layout";
import { Vital } from "./Vital";
export function SlimRail({
  side,
  view,
  policies,
  onExpand,
}: {
  side: "left" | "right";
  view: PlayView;
  policies: Record<string, ModulePolicy>;
  onExpand: () => void;
}) {
  return (
    <div className="sc-slim">
      <Button
        variant="ghost"
        className="sc-icon"
        aria-label={side === "left" ? "Expand Character" : "Expand Here"}
        onClick={onExpand}
      >
        {side === "left" ? <UserRound /> : <MapPin />}
      </Button>
      {side === "left" ? (
        <>
          {view.player && (
            <span className="sc-avatar" aria-label={view.player.name}>
              {view.player.name.slice(0, 1)}
            </span>
          )}
          {view.modules
            .filter((module) => (policies[module.id] ?? "always") === "always")
            .map((module) => (
              <Button
                variant="ghost"
                key={module.id}
                className="sc-slim-module"
                aria-label={`Expand ${module.label}`}
                onClick={onExpand}
              >
                {module.kind === "vitals" ? (
                  module.fields.map((field) => (
                    <Vital key={field.id} field={field} compact />
                  ))
                ) : (
                  <>
                    <Layers aria-hidden="true" />
                    <span className="sr-only">{module.label}</span>
                  </>
                )}
              </Button>
            ))}
        </>
      ) : (
        (policies.cast ?? "always") === "always" &&
        view.presence?.cast.map((person) => (
          <Button
            variant="ghost"
            className="sc-icon"
            aria-label={`Show ${person.name} in Here`}
            key={person.id}
            onClick={onExpand}
          >
            <span
              className={`sc-avatar${person.identified ? "" : " sc-unidentified"}`}
              aria-hidden="true"
            >
              {person.identified ? person.name.slice(0, 1) : "?"}
            </span>
          </Button>
        ))
      )}
    </div>
  );
}
