/**
 * Named Single Picker Component
 * Single-select picker for named entities (Worlds, Rulesets, etc.)
 */

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CreateWorldDialog } from './CreateWorldDialog';

export interface NamedEntity {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface NamedSinglePickerProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  items: NamedEntity[];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  allowCreateNew?: boolean;
  onCreateNewLabel?: string;
  onCreated?: (newItemId: string) => void;
}

export function NamedSinglePicker({
  value,
  onValueChange,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  items,
  loading = false,
  disabled = false,
  className,
  allowCreateNew = false,
  onCreateNewLabel = "Create New",
  onCreated
}: NamedSinglePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const lastSelectionRef = useRef<{ itemId: string; timestamp: number } | null>(null);

  const selectedItem = items.find(item => item.id === value);
  
  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && value) {
      const found = items.find(item => item.id === value);
      if (!found && items.length > 0) {
        console.log('NamedSinglePicker: Value not found in items', {
          value,
          itemIds: items.map(i => i.id),
          itemNames: items.map(i => i.name),
        });
      }
    }
  }, [value, items]);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || loading}
          onClick={(e) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('NamedSinglePicker: Button clicked', {
                open,
                disabled,
                loading,
                value,
                itemsCount: items.length,
              });
            }
            // Don't prevent default - let Popover handle it
          }}
        >
          {selectedItem ? selectedItem.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus on open to avoid form interference
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          // Prevent form from interfering when clicking outside
          e.preventDefault();
        }}
      >
        <Command shouldFilter={false} loop={true}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
              <CommandList>
                <CommandEmpty>
                  {allowCreateNew && searchValue.trim() ? (
                    <div className="py-2 text-center">
                      <p className="text-sm text-muted-foreground mb-2">{emptyMessage}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOpen(false);
                          setCreateDialogOpen(true);
                        }}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {onCreateNewLabel}
                      </Button>
                    </div>
                  ) : (
                    emptyMessage
                  )}
                </CommandEmpty>
                <CommandGroup>
              {filteredItems.map((item) => {
                const isSelected = value === item.id;
                
                const handleItemSelect = (e?: React.MouseEvent | React.KeyboardEvent) => {
                  // Prevent double-triggering if both onSelect and onClick fire
                  const now = Date.now();
                  const lastSelection = lastSelectionRef.current;
                  
                  // If same item selected within 200ms, ignore (likely double-trigger)
                  if (lastSelection && lastSelection.itemId === item.id && now - lastSelection.timestamp < 200) {
                    if (e) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                    return;
                  }
                  
                  lastSelectionRef.current = { itemId: item.id, timestamp: now };
                  
                  // Stop event propagation to prevent form interference
                  if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  
                  // Always use item.id
                  const newValue = isSelected ? '' : item.id;
                  
                  if (process.env.NODE_ENV === 'development') {
                    console.log('NamedSinglePicker: handleItemSelect called', {
                      itemId: item.id,
                      itemName: item.name,
                      newValue,
                      isSelected,
                    });
                  }
                  
                  onValueChange(newValue);
                  setOpen(false);
                  setSearchValue(''); // Clear search when item is selected
                };
                
                return (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => {
                      // cmdk's onSelect fires on both click and keyboard Enter
                      if (process.env.NODE_ENV === 'development') {
                        console.log('NamedSinglePicker: onSelect fired for', item.name);
                      }
                      handleItemSelect();
                    }}
                    disabled={false}
                    className={cn(
                      "cursor-pointer hover:bg-accent active:bg-accent/80",
                      "data-[disabled]:pointer-events-auto data-[disabled]:opacity-100",
                      className
                    )}
                    data-item-id={item.id}
                    data-disabled={false}
                    style={{ 
                      pointerEvents: 'auto !important',
                      opacity: '1 !important',
                      cursor: 'pointer'
                    }}
                    onMouseDown={(e) => {
                      // Ensure clicks work - don't prevent default, let cmdk handle it
                      if (process.env.NODE_ENV === 'development') {
                        console.log('NamedSinglePicker: MouseDown on item', item.name);
                      }
                    }}
                    onClick={(e) => {
                      // Fallback click handler if onSelect doesn't fire
                      if (process.env.NODE_ENV === 'development') {
                        console.log('NamedSinglePicker: Click on item', item.name);
                      }
                      // Don't prevent default - let cmdk's onSelect handle it
                      // But if onSelect doesn't fire, we'll handle it here
                      setTimeout(() => {
                        // Check if selection was handled, if not, handle it manually
                        if (!lastSelectionRef.current || lastSelectionRef.current.itemId !== item.id) {
                          handleItemSelect(e);
                        }
                      }, 50);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      {item.description && (
                        <span className="text-sm text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {allowCreateNew && (
      <CreateWorldDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(worldId) => {
          onValueChange(worldId);
          if (onCreated) {
            onCreated(worldId);
          }
        }}
      />
    )}
  </>
  );
}
