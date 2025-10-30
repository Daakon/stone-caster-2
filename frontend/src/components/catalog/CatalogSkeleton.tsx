import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CatalogSkeletonProps {
  showImage?: boolean;
  showChips?: boolean;
  chipCount?: number;
  className?: string;
}

export function CatalogSkeleton({ 
  showImage = true, 
  showChips = true, 
  chipCount = 2,
  className 
}: CatalogSkeletonProps) {
  return (
    <Card className={className}>
      {showImage && (
        <div className="aspect-video">
          <Skeleton className="w-full h-full rounded-t-lg" />
        </div>
      )}
      
      <CardContent className="p-4">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        
        {showChips && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Array.from({ length: chipCount }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-16 rounded-full" />
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Skeleton className="h-8 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

interface CatalogGridSkeletonProps {
  count?: number;
  showImage?: boolean;
  showChips?: boolean;
  chipCount?: number;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}

export function CatalogGridSkeleton({ 
  count = 6, 
  showImage = true, 
  showChips = true, 
  chipCount = 2,
  columns = { mobile: 2, tablet: 3, desktop: 4 }
}: CatalogGridSkeletonProps) {
  return (
    <div 
      className={`grid gap-4 grid-cols-${columns.mobile || 2} md:grid-cols-${columns.tablet || 3} lg:grid-cols-${columns.desktop || 4}`}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CatalogSkeleton 
          key={index}
          showImage={showImage}
          showChips={showChips}
          chipCount={chipCount}
        />
      ))}
    </div>
  );
}
