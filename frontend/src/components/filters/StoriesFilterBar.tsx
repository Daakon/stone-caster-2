import React, { useState, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorldsQuery } from '@/lib/queries';
import { useRulesetsQuery } from '@/lib/queries';
import { useURLFilters } from '@/lib/useURLFilters';
import { trackFilterChange } from '@/lib/analytics';

interface StoriesFilterBarProps {
  onFiltersChange?: (filters: any) => void;
}

interface StoryFilters {
  q: string;
  world: string | undefined;
  kind: string | undefined;
  ruleset: string | undefined;
  tags: string[];
}

const STORY_KINDS = [
  { value: 'adventure', label: 'Adventure' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'scenario', label: 'Scenario' },
];

export function StoriesFilterBar({ onFiltersChange }: StoriesFilterBarProps) {
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  const { filters, updateFilters, reset } = useURLFilters<StoryFilters>({
    q: '',
    world: undefined,
    kind: undefined,
    ruleset: undefined,
    tags: []
  });

  // Load options for dropdowns
  const { data: worlds = [] } = useWorldsQuery();
  const { data: rulesets = [] } = useRulesetsQuery();

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Track filter changes for analytics
  useEffect(() => {
    trackFilterChange('stories', filters);
  }, [filters]);

  const handleSearchChange = (value: string) => {
    updateFilters({ q: value });
  };

  const handleWorldChange = (value: string) => {
    updateFilters({ world: value === 'all' ? undefined : value });
  };

  const handleKindChange = (value: string) => {
    updateFilters({ kind: value === 'all' ? undefined : value });
  };

  const handleRulesetChange = (value: string) => {
    updateFilters({ ruleset: value === 'all' ? undefined : value });
  };

  const handleTagAdd = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !filters.tags.includes(normalizedTag)) {
      updateFilters({ tags: [...filters.tags, normalizedTag] });
    }
    setTagInput('');
    setShowTagInput(false);
  };

  const handleTagRemove = (tagToRemove: string) => {
    updateFilters({ 
      tags: filters.tags.filter(tag => tag !== tagToRemove) 
    });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleTagAdd(tagInput);
    } else if (e.key === 'Escape') {
      setShowTagInput(false);
      setTagInput('');
    }
  };

  const handleTagInputBlur = () => {
    if (tagInput.trim()) {
      handleTagAdd(tagInput);
    } else {
      setShowTagInput(false);
      setTagInput('');
    }
  };

  const hasActiveFilters = 
    filters.q || 
    filters.world || 
    filters.kind || 
    filters.ruleset || 
    filters.tags.length > 0;

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search stories..."
            value={filters.q}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
            aria-label="Search stories"
          />
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Kind Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Kind</label>
            <Select value={filters.kind || 'all'} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {STORY_KINDS.map((kind) => (
                  <SelectItem key={kind.value} value={kind.value}>
                    {kind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ruleset Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Ruleset</label>
            <Select value={filters.ruleset || 'all'} onValueChange={handleRulesetChange}>
              <SelectTrigger>
                <SelectValue placeholder="All rulesets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rulesets</SelectItem>
                {rulesets.map((ruleset) => (
                  <SelectItem key={ruleset.id} value={ruleset.id}>
                    {ruleset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tags</label>
          <div className="flex flex-wrap gap-2">
            {filters.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => handleTagRemove(tag)}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
            {showTagInput ? (
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={handleTagInputBlur}
                placeholder="Enter tag..."
                className="w-32 h-8"
                autoFocus
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagInput(true)}
                className="h-8"
                aria-label="Add tag"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add tag
              </Button>
            )}
          </div>
        </div>

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
