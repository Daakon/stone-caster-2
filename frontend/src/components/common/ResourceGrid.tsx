import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResourceGridProps {
    children: ReactNode;
    isEmpty?: boolean;
    emptyState?: ReactNode;
    className?: string;
}

export function ResourceGrid({ children, isEmpty, emptyState, className }: ResourceGridProps) {
    if (isEmpty) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-stone-900/50 rounded-lg border-2 border-dashed border-stone-800 text-center">
                {emptyState}
            </div>
        );
    }

    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
            className
        )}>
            {children}
        </div>
    );
}
