import { Heart, Zap, Apple } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface VitalsClusterProps {
    tier1Entity: any; // Using any for flexibility with legacy data shapes, but strictly accessed below
}

export function VitalsCluster({ tier1Entity }: VitalsClusterProps) {
    // 1. Safe Extraction with Defaults
    const attributes = tier1Entity?.attributes || {};
    const stats = tier1Entity?.stats || {}; // Fallback if data is in stats

    // Stamina
    // Look for current_stamina, stamina, or default 100
    const staminaCurrent = attributes.current_stamina ?? stats.stamina ?? 100;
    const staminaMax = attributes.max_stamina ?? stats.max_stamina ?? 100;
    const staminaPercent = Math.min((staminaCurrent / staminaMax) * 100, 100);

    // Health / Combat Condition
    const hpStatus = attributes.hp_status || attributes.combat_condition || "Healthy";
    const isHealthy = hpStatus === "Healthy";

    // Hunger - Conditional rendering
    const hungerState = attributes.hunger_state || "Satisfied";
    const isHungry = ["Hungry", "Starving"].includes(hungerState);

    return (
        <TooltipProvider>
            <div className="flex items-center gap-4 pointer-events-auto filter drop-shadow-md">

                {/* Health */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className={cn(
                            "transition-all duration-300",
                            !isHealthy && "grayscale opacity-80"
                        )}>
                            <Heart
                                className={cn(
                                    "w-8 h-8 fill-current transition-colors",
                                    isHealthy ? "text-red-500" : "text-red-900"
                                )}
                                strokeWidth={2.5}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Health Status: {hpStatus}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Stamina */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="relative">
                            <Zap
                                className={cn(
                                    "w-8 h-8 fill-current text-yellow-500 transition-opacity duration-300",
                                    staminaPercent < 20 && "animate-pulse"
                                )}
                                style={{ opacity: Math.max(0.3, staminaPercent / 100) }}
                                strokeWidth={2.5}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Stamina: {Math.round(staminaCurrent)}/{staminaMax}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Hunger (Conditional) */}
                {isHungry && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="animate-bounce-slow">
                                <Apple
                                    className="w-7 h-7 fill-current text-green-600/80"
                                    strokeWidth={2.5}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Hunger: {hungerState}</p>
                        </TooltipContent>
                    </Tooltip>
                )}

            </div>
        </TooltipProvider>
    );
}
