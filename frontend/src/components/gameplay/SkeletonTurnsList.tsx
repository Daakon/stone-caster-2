/**
 * Phase 5.1: Skeleton loading state for TurnsList
 */

import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface SkeletonTurnsListProps {
  count?: number;
}

export function SkeletonTurnsList({ count = 3 }: SkeletonTurnsListProps) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading turns">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

