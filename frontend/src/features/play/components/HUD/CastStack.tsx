import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown } from "lucide-react";
import type { PlayView } from "../../model/play-view";
export function CastStack({
  view,
  onOpen,
}: {
  view: PlayView;
  onOpen: () => void;
}) {
  if (!view.presence && !view.scene) return null;
  return (
    <Button
      variant="ghost"
      className="sc-cast-stack"
      aria-label="Open Here"
      onClick={onOpen}
    >
      {view.presence?.cast.slice(0, 3).map((person) => (
        <span
          key={person.id}
          className={`sc-avatar${person.identified ? "" : " sc-unidentified"}`}
          aria-hidden="true"
        >
          {person.identified ? person.name.slice(0, 1) : "?"}
        </span>
      ))}
      {!view.presence?.cast.length && (
        <>
          <MapPin aria-hidden="true" />
          <span>Here</span>
        </>
      )}
      <ChevronDown aria-hidden="true" />
    </Button>
  );
}
