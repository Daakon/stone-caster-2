import React from 'react';
import { cn } from '@/lib/utils';

export interface CardBaseProps extends React.HTMLAttributes<HTMLDivElement> {
    isSelected?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
}

export function CardBase({ isSelected, onClick, className, children, ...props }: CardBaseProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "relative p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden backdrop-blur-sm",
                "bg-stone-900/50",
                isSelected
                    ? "border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/50"
                    : "border-white/10 hover:border-white/20 hover:bg-stone-800/50",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
