import { Zap, Utensils, Heart } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { VitalField } from "../../model/play-view";

export function Vital({
  field,
  compact = false,
}: {
  field: VitalField;
  compact?: boolean;
}) {
  const Icon =
    field.tone === "stamina" ? Zap : field.tone === "danger" ? Heart : Utensils;
  return (
    <div
      className={`sc-vital sc-tone-${field.tone}${compact ? " sc-vital-compact" : ""}`}
    >
      <div className="sc-vital-label">
        <span>
          <Icon aria-hidden="true" />
          {!compact && field.label}
        </span>
        {field.delta !== undefined && (
          <span className="sc-delta">
            {field.delta > 0 ? "+" : ""}
            {field.delta}
          </span>
        )}
        <span className="sc-number">
          {field.value}
          {field.max !== undefined && !compact && (
            <span className="sc-muted"> / {field.max}</span>
          )}
        </span>
      </div>
      {field.max !== undefined && (
        <Progress
          aria-label={field.label}
          aria-valuetext={`${String(field.value)} of ${String(field.max)}`}
          value={Math.max(0, Math.min(100, (field.value / field.max) * 100))}
          className="sc-progress"
        />
      )}
    </div>
  );
}
