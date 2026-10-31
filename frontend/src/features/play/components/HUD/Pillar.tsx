import { Progress } from "@/components/ui/progress";
import type { VitalField } from "../../model/play-view";
export function Pillar({ field }: { field: VitalField }) {
  return (
    <div className="sc-pillar">
      <span>{field.label}</span>
      {field.max !== undefined && (
        <Progress
          aria-label={field.label}
          value={Math.max(0, Math.min(100, (field.value / field.max) * 100))}
          className="sc-progress"
        />
      )}
      <strong className="sc-number">{field.value}</strong>
    </div>
  );
}
