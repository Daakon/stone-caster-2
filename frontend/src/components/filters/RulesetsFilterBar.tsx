import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { trackFilterChange } from '@/lib/analytics';
import type { FilterValue } from '@/lib/useURLFilters';

interface RulesetFilters {
  q: string;
  [key: string]: FilterValue;
}

interface RulesetsFilterBarProps {
  filters: RulesetFilters;
  updateFilters: (patch: Partial<RulesetFilters>) => void;
  reset: () => void;
}

export function RulesetsFilterBar({ filters, updateFilters, reset }: RulesetsFilterBarProps) {
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
