import React from 'react';
import { cn } from '@/lib/utils';
import type { WorldPreset } from '@/data/world-presets';
import { Check } from 'lucide-react';

interface PresetSelectorProps {
    options: WorldPreset[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    className?: string;
}

export function PresetSelector({ options, selectedId, onSelect, className }: PresetSelectorProps) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
            {options.map((option) => {
                const isSelected = selectedId === option.id;
                const Icon = option.icon;

                return (
                    <button
                        key={option.id}
                        onClick={() => onSelect(option.id)}
                        className={cn(
                            "relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left group",
                            isSelected
                                ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
                                : "border-stone-800 bg-stone-900/50 hover:border-stone-700 hover:bg-stone-900"
                        )}
                    >
                        <div className="flex w-full items-start justify-between mb-3">
                            <div className={cn(
                                "p-2 rounded-lg",
                                isSelected ? "bg-primary/20 text-primary" : "bg-stone-800 text-stone-400 group-hover:text-stone-200"
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>
                            {isSelected && (
                                <div className="absolute top-4 right-4 text-primary">
                                    <Check className="w-5 h-5" />
                                </div>
                            )}
                        </div>

                        <h3 className={cn(
                            "font-semibold mb-1",
                            isSelected ? "text-primary" : "text-stone-200"
                        )}>
                            {option.label}
                        </h3>

                        <p className={cn(
                            "text-sm line-clamp-2",
                            isSelected ? "text-stone-300" : "text-stone-500"
                        )}>
                            {option.description}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}
