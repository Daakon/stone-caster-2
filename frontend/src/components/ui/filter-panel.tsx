import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';
import { Checkbox } from './checkbox';
import { Slider } from './slider';
import { Search, X } from 'lucide-react';

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  availableTags: FilterOption[];
  selectedDifficulty: string[];
  onDifficultyToggle: (difficulty: string) => void;
  difficultyOptions: FilterOption[];
  stoneCostRange: [number, number];
  onStoneCostChange: (range: [number, number]) => void;
  maxStoneCost: number;
  onClearFilters: () => void;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  searchQuery,
  onSearchChange,
  selectedTags,
  onTagToggle,
  availableTags,
  selectedDifficulty,
  onDifficultyToggle,
  difficultyOptions,
  stoneCostRange,
  onStoneCostChange,
  maxStoneCost,
  onClearFilters,
  className
}) => {
  const hasActiveFilters = selectedTags.length > 0 || selectedDifficulty.length > 0 || 
    stoneCostRange[0] > 0 || stoneCostRange[1] < maxStoneCost || searchQuery.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filters</CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search adventures..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label>Tags</Label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {availableTags.map((tag) => (
              <div key={tag.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-${tag.id}`}
                  checked={selectedTags.includes(tag.id)}
                  onCheckedChange={() => onTagToggle(tag.id)}
                />
                <Label
                  htmlFor={`tag-${tag.id}`}
                  className="text-sm font-normal cursor-pointer flex-1 flex items-center justify-between"
                >
                  <span>{tag.label}</span>
                  {tag.count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {tag.count}
                    </Badge>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-3">
          <Label>Difficulty</Label>
          <div className="space-y-2">
            {difficultyOptions.map((difficulty) => (
              <div key={difficulty.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`difficulty-${difficulty.id}`}
                  checked={selectedDifficulty.includes(difficulty.id)}
                  onCheckedChange={() => onDifficultyToggle(difficulty.id)}
                />
                <Label
                  htmlFor={`difficulty-${difficulty.id}`}
                  className="text-sm font-normal cursor-pointer flex-1 flex items-center justify-between"
                >
                  <span className="capitalize">{difficulty.label}</span>
                  {difficulty.count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {difficulty.count}
                    </Badge>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Stone Cost Range */}
        <div className="space-y-3">
          <Label>Stone Cost Range</Label>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{stoneCostRange[0]} stones</span>
              <span>{stoneCostRange[1]} stones</span>
            </div>
            <Slider
              value={stoneCostRange}
              onValueChange={onStoneCostChange}
              max={maxStoneCost}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};




