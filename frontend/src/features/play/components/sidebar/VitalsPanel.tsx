import { cn } from "@/lib/utils";
import { Zap, Utensils } from "lucide-react";
import { useActiveGameStore } from "@/stores/useActiveGameStore";

interface VitalsPanelProps {
  mechanicalState: unknown;
  playerId?: string;
}

export const VitalsPanel = (_props: VitalsPanelProps) => {
  void _props;
  // Vitals - Read from store for reactivity (store is source of truth)
  const storeVitals = useActiveGameStore((state) => state.vitals);

  // Fallback to entity properties if store vitals not available

  // Stamina - Use store value first, then fallback to entity properties
  const currentStamina = storeVitals.stamina;
  const staminaPct = Math.min(100, Math.max(0, currentStamina));

  // Color Logic for Stamina
  let staminaColor = "bg-green-500";
  if (staminaPct < 80) staminaColor = "bg-yellow-500";
  if (staminaPct < 50) staminaColor = "bg-orange-500";
  if (staminaPct < 20) staminaColor = "bg-red-500";

  // Satiety - Use store value first, then fallback to entity properties
  const currentSatiety = storeVitals.saturation;
  const satietyPct = Math.min(100, Math.max(0, currentSatiety));

  return (
    <div className="flex flex-col gap-3 w-full p-2 bg-background/50 rounded-lg border border-border/50">
      {/* Stamina Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>Stamina</span>
          </div>
          <span data-testid="stamina-value">{currentStamina}</span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              staminaColor,
            )}
            style={{ width: `${String(staminaPct)}%` }}
          />
        </div>
      </div>

      {/* Satiety Bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          <div className="flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            <span>Satiety</span>
          </div>
          <span>{currentSatiety}</span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${String(satietyPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
