import type { ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModuleCard({
  id,
  label,
  source,
  onHide,
  children,
}: {
  id: string;
  label: string;
  source?: string;
  onHide: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="sc-module" aria-label={label} data-module={id}>
      <div className="sc-module-header">
        <h3>{label}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="sc-icon"
          aria-label={`Hide ${label}`}
          onClick={() => {
            onHide(id);
          }}
        >
          <EyeOff aria-hidden="true" />
        </Button>
      </div>
      {children}
      {source && <p className="sc-source">{source}</p>}
    </section>
  );
}
