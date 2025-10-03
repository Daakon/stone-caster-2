import React from 'react';
import { Gem } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StoneCostProps {
  cost: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StoneCost: React.FC<StoneCostProps> = ({
  cost,
  className,
  size = 'md',
  showIcon = true
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-1 font-medium text-primary',
      sizeClasses[size],
      className
    )}>
      {showIcon && (
        <Gem className={cn('text-primary', iconSizes[size])} />
      )}
      <span>{cost}</span>
      <span className="text-xs text-muted-foreground">stones</span>
    </div>
  );
};



