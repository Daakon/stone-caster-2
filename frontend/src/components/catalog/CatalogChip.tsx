import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CatalogChipProps {
  label: string;
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
}

export function CatalogChip({ 
  label, 
  variant = 'secondary', 
  size = 'sm',
  className 
}: CatalogChipProps) {
  return (
    <Badge 
      variant={variant}
      className={cn(
        size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1',
        className
      )}
    >
      {label}
    </Badge>
  );
}
