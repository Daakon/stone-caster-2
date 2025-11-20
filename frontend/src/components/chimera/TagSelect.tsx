/**
 * Reusable Tag Select Component
 * Allows users to select from approved tags or create new ones
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chimeraLoreService, type ChimeraTag } from '@/services/chimera.lore';

interface TagSelectProps {
  selectedTagNames: string[];
  onTagNamesChange: (tagNames: string[]) => void;
  label?: string;
  description?: string;
}

export function TagSelect({
  selectedTagNames,
  onTagNamesChange,
  label = 'Tags',
  description,
}: TagSelectProps) {
  const [tagSearch, setTagSearch] = useState('');
  const [tagOpen, setTagOpen] = useState(false);

  // Load approved tags
  const { data: tags, isLoading: isLoadingTags, error: tagsError } = useQuery({
    queryKey: ['chimera-tags'],
    queryFn: () => chimeraLoreService.getTags(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once
    // Don't throw on error - allow component to work even if tags can't be loaded
    throwOnError: false,
  });

  // Filter tags based on search
  // If query failed, use empty array so user can still create new tags
  const availableTags = tags || [];
  const filteredTags = availableTags.filter((tag) =>
    tag.tag_name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // Check if search matches an existing tag
  const searchMatchesExisting = filteredTags.some(
    (tag) => tag.tag_name.toLowerCase() === tagSearch.toLowerCase()
  );

  // Check if search matches a selected tag
  const searchMatchesSelected = selectedTagNames.some(
    (name) => name.toLowerCase() === tagSearch.toLowerCase()
  );

  const canCreateNew = tagSearch.trim() && !searchMatchesExisting && !searchMatchesSelected;

  const handleAddTag = (tagName: string) => {
    const normalized = tagName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!selectedTagNames.includes(normalized)) {
      onTagNamesChange([...selectedTagNames, normalized]);
    }
    setTagSearch('');
    setTagOpen(false);
  };

  const handleToggleTag = (tagName: string) => {
    if (selectedTagNames.includes(tagName)) {
      onTagNamesChange(selectedTagNames.filter((n) => n !== tagName));
    } else {
      onTagNamesChange([...selectedTagNames, tagName]);
    }
    setTagSearch('');
    setTagOpen(false);
  };

  const handleRemoveTag = (tagName: string) => {
    onTagNamesChange(selectedTagNames.filter((n) => n !== tagName));
  };

  return (
    <div>
      <Label>{label}</Label>
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={tagOpen}
            className="w-full justify-between"
            type="button"
            disabled={isLoadingTags}
          >
            {selectedTagNames.length > 0
              ? `${selectedTagNames.length} tag${selectedTagNames.length !== 1 ? 's' : ''} selected`
              : 'Select tags...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" onInteractOutside={(e) => e.preventDefault()}>
          <Command shouldFilter={false} loop={true}>
            <CommandInput
              placeholder="Search existing tags or type a new name..."
              value={tagSearch}
              onValueChange={setTagSearch}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreateNew) {
                  e.preventDefault();
                  const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                  handleAddTag(newTagName);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {canCreateNew ? (
                  <div className="py-2 text-center text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                        handleAddTag(newTagName);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add &quot;{tagSearch.trim()}&quot;
                    </Button>
                  </div>
                ) : (
                  'No tags found.'
                )}
              </CommandEmpty>
              {canCreateNew && (
                <CommandGroup heading="Create New">
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                      handleAddTag(newTagName);
                    }}
                    className="cursor-pointer"
                    disabled={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const newTagName = tagSearch.trim().toUpperCase().replace(/\s+/g, '_');
                      handleAddTag(newTagName);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add &quot;{tagSearch.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Existing Tags">
                {filteredTags.map((tag) => {
                  const isSelected = selectedTagNames.includes(tag.tag_name);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.tag_name}
                      onSelect={() => handleToggleTag(tag.tag_name)}
                      className={cn(
                        'cursor-pointer !pointer-events-auto !opacity-100',
                        '[&[data-disabled]]:!pointer-events-auto [&[data-disabled]]:!opacity-100'
                      )}
                      disabled={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleTag(tag.tag_name);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {tag.tag_name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedTagNames.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedTagNames.map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
            >
              {tagName}
              <button
                type="button"
                onClick={() => handleRemoveTag(tagName)}
                className="hover:text-destructive"
                aria-label={`Remove ${tagName}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {description && (
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      )}
    </div>
  );
}

