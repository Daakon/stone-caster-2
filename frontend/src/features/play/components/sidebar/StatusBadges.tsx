import { record, text } from "../../utils/value";
import { Badge } from "@/components/ui/badge";

interface StatusBadgesProps {
  mechanicalState: unknown;
  playerId?: string;
}

export const StatusBadges = ({
  mechanicalState,
  playerId,
}: StatusBadgesProps) => {
  // Defensive coding
  const state = record(mechanicalState);
  const pId = playerId || text(record(state.index).player_id);
  const playerEntity = pId ? record(state.entities)[pId] : null;
  const props = record(record(playerEntity).properties);

  const badges = [];

  // 1. Health/Combat Condition
  const combat = text(props.combat_condition) || "Healthy";
  if (combat !== "Healthy" && combat !== "None") {
    badges.push({ label: combat, variant: "destructive" });
  }

  // 2. Hunger
  const hunger = props.hunger_state || "Satiated";
  if (hunger === "Starving" || hunger === "Hungry") {
    badges.push({ label: hunger, variant: "destructive" });
  }

  // 3. Physical
  const phys = text(props.physical_condition) || "Rested";
  if (phys === "Exhausted" || phys === "Collapsed" || phys === "Fatigued") {
    badges.push({ label: phys, variant: "warning" }); // We'll map to 'secondary' or a custom style if 'warning' doesn't exist in standard Shadcn, usually 'secondary' or 'destructive'
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {badges.map((b, i) => (
        <Badge
          key={i}
          variant={b.variant === "destructive" ? "destructive" : "secondary"}
          className="text-[10px] px-1.5 py-0 h-5"
        >
          {b.label}
        </Badge>
      ))}
    </div>
  );
};
