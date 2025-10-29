import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useURLFilters } from '@/lib/useURLFilters';
import { trackFilterChange } from '@/lib/analytics';

interface WorldsFilterBarProps {
  onFiltersChange?: (filters: any) => void;
}

interface WorldFilters {
  q: string;
}

export function WorldsFilterBar({ onFiltersChange }: WorldsFilterBarProps) {
  const { filters, updateFilters, reset } = useURLFilters<WorldFilters>({
    q: ''
  });

  // Notify parent of filter changes
  React.useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Track filter changes for analytics
  React.useEffect(() => {
    trackFilterChange('worlds', filters);
  }, [filters]);

  const handleSearchChange = (value: string) => {
    updateFilters({ q: value });
  };

  const hasActiveFilters = filters.q;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex gap-4 items-end">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search worlds..."
              value={filters.q}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
              aria-label="Search worlds"
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
