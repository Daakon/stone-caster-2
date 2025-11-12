/**
 * Named Multi Picker Component
 * Multi-select picker for named entities with drag-to-reorder support
 */

import { useState, useEffect, useRef } from 'react';
import { X, GripVertical, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface NamedEntity {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

interface NamedMultiPickerProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  items: NamedEntity[];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  allowReorder?: boolean;
  onReorder?: (reorderedIds: string[]) => void;
}

export function NamedMultiPicker({
  value,
  onValueChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  items,
  loading = false,
  disabled = false,
  className,
  allowReorder = false,
  onReorder
}: NamedMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const lastSelectionRef = useRef<{ itemId: string; timestamp: number } | null>(null);

  const selectedItems = items.filter(item => value.includes(item.id));
  const availableItems = items.filter(item => !value.includes(item.id));

  const filteredAvailableItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

  const handleSelect = (itemId: string) => {
    const newValue = [...value, itemId];
    onValueChange(newValue);
  };

  const handleRemove = (itemId: string) => {
    const newValue = value.filter(id => id !== itemId);
    onValueChange(newValue);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!allowReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newValue = [...value];
    const draggedId = newValue[draggedIndex];
    newValue.splice(draggedIndex, 1);
    newValue.splice(dropIndex, 0, draggedId);

    onValueChange(newValue);
    onReorder?.(newValue);
    setDraggedIndex(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Selected Items</div>
          <div className="space-y-1">
            {selectedItems.map((item, index) => (
              <div
                key={item.id}
                draggable={allowReorder}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2",
                  allowReorder && "cursor-move hover:bg-muted"
                )}
              >
                <div className="flex items-center space-x-2">
                  {allowReorder && (
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    {item.description && (
                      <span className="text-sm text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(item.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Items */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || loading}
          >
            {placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-full p-0" 
          align="start"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus on open to avoid form interference
            e.preventDefault();
          }}
        >
          <Command shouldFilter={false} loop={true}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              onKeyDown={(e) => {
                // Prevent form submission on Enter in search
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {filteredAvailableItems.map((item) => {
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
                    
                    handleSelect(item.id);
                    setOpen(false);
                    setSearchValue(''); // Clear search when item is selected
                  };

                  return (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      disabled={false}
                      onSelect={() => {
                        // cmdk's onSelect fires on both click and keyboard Enter
                        handleItemSelect();
                      }}
                      onMouseDown={(e) => {
                        // Handle mousedown for mouse clicks
                        e.preventDefault();
                        e.stopPropagation();
                        handleItemSelect(e);
                      }}
                      onClick={(e) => {
                        // Fallback click handler if onSelect doesn't fire
                        e.preventDefault();
                        e.stopPropagation();
                        // Use setTimeout to check if onSelect already handled it
                        setTimeout(() => {
                          if (!lastSelectionRef.current || lastSelectionRef.current.itemId !== item.id) {
                            handleItemSelect(e);
                          }
                        }, 50);
                      }}
                    className={cn(
                      "cursor-pointer hover:bg-accent active:bg-accent/80",
                      "data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                    )}
                    data-disabled={false}
                    style={{ 
                      pointerEvents: 'auto !important',
                      opacity: '1 !important',
                      cursor: 'pointer'
                    }}
                  >
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
    </div>
  );
}
