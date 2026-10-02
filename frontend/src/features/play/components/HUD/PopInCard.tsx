import { useEffect, useRef, useState } from "react";
import type { HudModule } from "../../model/play-view";
import { ModuleContent } from "./CharacterRail";
export function PopInCard({ module }: { module: HudModule }) {
  const signature = JSON.stringify(module.fields);
  const previous = useRef(signature);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (previous.current === signature) return;
    previous.current = signature;
    setChanged(true);
    const timeout = setTimeout(() => {
      setChanged(false);
    }, 8000);
    return () => {
      clearTimeout(timeout);
    };
  }, [signature]);
  if (!changed) return null;
  return (
    <div className="sc-pop-in" role="status">
      <p className="sc-overline">Changed this turn · {module.label}</p>
      <ModuleContent module={module} />
    </div>
  );
}
