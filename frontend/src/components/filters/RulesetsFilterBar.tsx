import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useURLFilters } from '@/lib/useURLFilters';
import { trackFilterChange } from '@/lib/analytics';

interface RulesetsFilterBarProps {
  onFiltersChange?: (filters: any) => void;
}

interface RulesetFilters {
  q: string;
}

export function RulesetsFilterBar({ onFiltersChange }: RulesetsFilterBarProps) {
  const { filters, updateFilters, reset } = useURLFilters<RulesetFilters>({
    q: ''
  });

  // Notify parent of filter changes
  React.useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Track filter changes for analytics
  React.useEffect(() => {
    trackFilterChange('rulesets', filters);
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
              placeholder="Search rulesets..."
              value={filters.q}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
              aria-label="Search rulesets"
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
