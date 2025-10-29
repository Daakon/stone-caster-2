import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CatalogGridProps {
  children: ReactNode;
  className?: string;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export function CatalogGrid({ 
  children, 
  className,
  columns = { mobile: 2, tablet: 3, desktop: 4 }
}: CatalogGridProps) {
  return (
    <div 
      className={cn(
        'grid gap-4',
        `grid-cols-${columns.mobile || 2}`,
        `md:grid-cols-${columns.tablet || 3}`,
        `lg:grid-cols-${columns.desktop || 4}`,
        className
      )}
    >
      {children}
    </div>
  );
}
