/**
 * Ruleset Filter Bar
 * Horizontal scrolling filter chips for tags
 * 
 * Features:
 * - Toggleable tag badges
 * - Horizontal scroll on mobile
 * - Visual feedback for active filters
 */

import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RulesetFilterBarProps {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function RulesetFilterBar({
  availableTags,
  selectedTags,
  onToggleTag,
}: RulesetFilterBarProps) {
  if (availableTags.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Filter by tags</h4>
        {selectedTags.length > 0 && (
          <button
            onClick={() => {
              // Clear all filters by toggling each selected tag
              selectedTags.forEach((tag) => onToggleTag(tag));
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <Badge
              key={tag}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-all min-h-[32px] px-3 py-1.5 flex items-center gap-1.5',
                isSelected && 'ring-2 ring-primary ring-offset-1'
              )}
              onClick={() => onToggleTag(tag)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleTag(tag);
                }
              }}
              aria-pressed={isSelected}
            >
              {tag}
              {isSelected && (
                <X className="h-3 w-3 ml-1" />
              )}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

