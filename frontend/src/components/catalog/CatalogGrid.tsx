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

// Map column numbers to Tailwind classes
const gridColsMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

const mdGridColsMap: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
};

const lgGridColsMap: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

export function CatalogGrid({ 
  children, 
  className,
  columns = { mobile: 2, tablet: 3, desktop: 4 }
}: CatalogGridProps) {
  const mobile = columns.mobile || 2;
  const tablet = columns.tablet || 3;
  const desktop = columns.desktop || 4;

  return (
    <div 
      className={cn(
        'grid gap-4',
        gridColsMap[mobile] || 'grid-cols-2',
        mdGridColsMap[tablet] || 'md:grid-cols-3',
        lgGridColsMap[desktop] || 'lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}
