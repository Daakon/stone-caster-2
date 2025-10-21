/**
 * Ref ID Picker Component
 * Phase 4: Polymorphic picker for selecting reference IDs based on type
 */

import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { refsService, type RefItem } from '@/services/admin.refs';

interface RefIdPickerProps {
  refKind: 'world' | 'ruleset' | 'entry' | 'npc' | 'none';
  value: string;
  onChange: (refId: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function RefIdPicker({ 
  refKind, 
  value, 
  onChange, 
  required = false,
  placeholder 
}: RefIdPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load items when refKind changes
  useEffect(() => {
    if (refKind === 'none') {
      setItems([]);
      return;
    }

    loadItems();
  }, [refKind]);

  // Load selected item when value changes
  useEffect(() => {
    if (value && refKind !== 'none') {
      loadSelectedItem();
    }
  }, [value, refKind]);

  const loadItems = async (query = '') => {
    try {
      setLoading(true);
      let items: RefItem[] = [];

      switch (refKind) {
        case 'world':
          items = await refsService.searchWorlds({ q: query, limit: 50 });
          break;
        case 'ruleset':
          items = await refsService.searchRulesets({ q: query, limit: 50 });
          break;
        case 'entry':
          items = await refsService.searchEntryPoints({ q: query, limit: 50 });
          break;
        case 'npc':
          items = await refsService.searchNPCs({ q: query, limit: 50 });
          break;
      }

      setItems(items);
    } catch (error) {
      console.error('Error loading items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedItem = async () => {
    try {
      const item = await refsService.getRefItem(value, refKind);
      if (item) {
        setItems(prev => {
          const exists = prev.some(i => i.id === item.id);
          if (!exists) {
            return [item, ...prev];
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error loading selected item:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    loadItems(query);
  };

  const handleSelect = (item: RefItem) => {
    onChange(item.id);
    setOpen(false);
  };

  const getSelectedItem = () => {
    return items.find(item => item.id === value);
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    const placeholders = {
      world: 'Select a world...',
      ruleset: 'Select a ruleset...',
      entry: 'Select an entry point...',
      npc: 'Select an NPC...',
      none: 'No reference needed'
    };

    return placeholders[refKind] || 'Select...';
  };

  const getSearchPlaceholder = () => {
    const placeholders = {
      world: 'Search worlds...',
      ruleset: 'Search rulesets...',
      entry: 'Search entry points...',
      npc: 'Search NPCs...',
      none: ''
    };

    return placeholders[refKind] || 'Search...';
  };

  const getEmptyMessage = () => {
    const messages = {
      world: 'No worlds found',
      ruleset: 'No rulesets found',
      entry: 'No entry points found',
      npc: 'No NPCs found',
      none: ''
    };

    return messages[refKind] || 'No items found';
  };

  if (refKind === 'none') {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted">
        <Badge variant="outline">No reference needed</Badge>
        <span className="text-sm text-muted-foreground">
          This scope does not require a reference
        </span>
      </div>
    );
  }

  const selectedItem = getSelectedItem();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem ? (
            <div className="flex items-center gap-2">
              <span className="truncate">{selectedItem.name}</span>
              <Badge variant="outline" className="text-xs">
                {selectedItem.type}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">
              {getPlaceholder()}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onValueChange={handleSearch}
          />
          <CommandList>
            {loading ? (
              <CommandEmpty>Loading...</CommandEmpty>
            ) : items.length === 0 ? (
              <CommandEmpty>{getEmptyMessage()}</CommandEmpty>
            ) : (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item.name}</div>
                      {item.type && (
                        <div className="text-xs text-muted-foreground">
                          {item.type}
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.id}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
