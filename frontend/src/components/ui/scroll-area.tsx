/**
 * ScrollArea component (simplified)
 * For now, just a wrapper div with overflow
 */

import * as React from 'react';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ScrollArea({ children, className, ...props }: ScrollAreaProps) {
  return (
    <div
      className={`overflow-auto ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}
