import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorldsQuery } from '@/lib/queries';
import { trackFilterChange } from '@/lib/analytics';
import type { FilterValue } from '@/lib/useURLFilters';

interface NPCFilters {
  q: string;
  world: string | undefined;
  tags?: string[];
  [key: string]: FilterValue;
}

interface NPCsFilterBarProps {
  filters: NPCFilters;
  updateFilters: (patch: Partial<NPCFilters>) => void;
  reset: () => void;
  availableTags?: string[];
  selectedTags?: string[];
  onTagToggle?: (tag: string) => void;
}

export function NPCsFilterBar({ 
  filters, 
  updateFilters, 
  reset,
  availableTags = [],
  selectedTags = [],
  onTagToggle
}: NPCsFilterBarProps) {
  // Load worlds for dropdown
  const worldsQ: any = useWorldsQuery();
  const worlds = Array.isArray(worldsQ?.data)
    ? worldsQ.data
    : (worldsQ?.data?.data ?? []);

  // Track filter changes for analytics
  React.useEffect(() => {
    trackFilterChange('npcs', filters);
  }, [filters]);

  const handleSearchChange = (value: string) => {
    updateFilters({ q: value });
  };

  const handleWorldChange = (value: string) => {
    updateFilters({ world: value === 'all' ? undefined : value });
  };

  const hasActiveFilters = filters.q || filters.world || (selectedTags && selectedTags.length > 0);

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search NPCs..."
            value={filters.q}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            aria-label="Search NPCs"
          />
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* World Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">World</label>
            <Select value={filters.world || 'all'} onValueChange={handleWorldChange}>
              <SelectTrigger>
                <SelectValue placeholder="All worlds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All worlds</SelectItem>
                {worlds.map((world) => (
                  <SelectItem key={world.id} value={world.id}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tags Filter (only for public NPCs) */}
        {availableTags.length > 0 && onTagToggle && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => onTagToggle(tag)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTagToggle(tag);
                      }
                    }}
                  >
                    {tag}
                    {isSelected && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Tags Display */}
        {selectedTags && selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {selectedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  onClick={() => onTagToggle?.(tag)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  aria-label={`Remove ${tag} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
