/**
 * Complex Asset Selector Component
 * Phase 3: Asset selection with Info modal and Create New button
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { chimeraWorldsService } from '@/services/chimera.worlds';
import { chimeraPacksService } from '@/services/chimera.packs';

export interface AssetItem {
  id: string;
  display_name: string;
  description_short?: string | null;
  description_long?: string | null;
  [key: string]: unknown;
}

export type AssetType = 'world' | 'pack' | 'ruleset';

export interface ComplexAssetSelectorProps {
  assetType: AssetType;
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  mode?: 'single' | 'multi';
  emptyMessage?: string;
  itemLabel?: string;
  renderItemDetails?: (item: AssetItem) => React.ReactNode;
  onCreateNew?: () => void;
  createNewLabel?: string;
  maxHeight?: string;
  className?: string;
  filterFn?: (item: AssetItem) => boolean;
}

export function ComplexAssetSelector({
  assetType,
  selectedIds,
  onSelectionChange,
  mode = 'multi',
  emptyMessage = 'No items available',
  itemLabel,
  renderItemDetails,
  onCreateNew,
  createNewLabel = 'Create New',
  maxHeight = '400px',
  className,
  filterFn,
}: ComplexAssetSelectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AssetItem | null>(null);

  // Determine the correct label
  const defaultItemLabel = itemLabel || assetType;

  // Fetch items based on assetType
  const { data: items, isLoading } = useQuery({
    queryKey: [`chimera-selectable-${assetType}s`],
    queryFn: async () => {
      switch (assetType) {
        case 'world':
          return await chimeraWorldsService.getSelectableWorlds();
        case 'pack':
          return await chimeraPacksService.getSelectablePacks();
        case 'ruleset':
          const result = await apiFetch<any[]>('/api/v2/chimera/admin/rulesets');
          if (!result.ok) {
            throw new Error(result.error.message || 'Failed to fetch rulesets');
          }
          return result.data || [];
        default:
          return [];
      }
    },
    staleTime: 30 * 1000,
  });

  // Apply filter if provided
  const filteredItems = filterFn && items ? items.filter(filterFn) : items || [];

  const handleItemClick = (item: AssetItem) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };

  const handleToggle = (itemId: string, checked: boolean) => {
    if (mode === 'single') {
      onSelectionChange(checked ? [itemId] : []);
    } else {
      if (checked) {
        onSelectionChange([...selectedIds, itemId]);
      } else {
        onSelectionChange(selectedIds.filter((id) => id !== itemId));
      }
    }
  };

  const handleSingleSelect = (itemId: string) => {
    onSelectionChange([itemId]);
  };

  const defaultRenderDetails = (item: AssetItem) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{item.display_name}</h3>
        {item.description_short && (
          <p className="text-sm text-muted-foreground mt-1">{item.description_short}</p>
        )}
      </div>
      {item.description_long && (
        <div>
          <h4 className="text-sm font-medium mb-2">Description</h4>
          <p className="text-sm whitespace-pre-wrap">{item.description_long}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {Object.entries(item)
          .filter(([key]) => !['id', 'display_name', 'description_short', 'description_long'].includes(key))
          .map(([key, value]) => (
            <div key={key}>
              <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
              <span className="text-muted-foreground">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className="border rounded-lg p-4 space-y-2 overflow-y-auto"
        style={{ maxHeight }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : mode === 'single' ? (
          <RadioGroup
            value={selectedIds[0] || ''}
            onValueChange={handleSingleSelect}
          >
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50">
                  <RadioGroupItem value={item.id} id={`asset-${item.id}`} />
                  <Label htmlFor={`asset-${item.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.display_name}</p>
                        {item.description_short && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{item.description_short}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        ) : (
          filteredItems.map((item) => {
            const isChecked = selectedIds.includes(item.id);
            return (
              <div key={item.id} className="flex items-start space-x-3 p-2 rounded hover:bg-muted/50">
                <Checkbox
                  id={`asset-${item.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => handleToggle(item.id, checked as boolean)}
                />
                <Label htmlFor={`asset-${item.id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{item.display_name}</p>
                      {item.description_short && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.description_short}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </Label>
              </div>
            );
          })
        )}
      </div>

      {onCreateNew && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          {createNewLabel}
        </Button>
      )}

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.display_name || 'Details'}</DialogTitle>
            <DialogDescription>
              View details for this {defaultItemLabel}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="mt-4">
              {renderItemDetails ? renderItemDetails(selectedItem) : defaultRenderDetails(selectedItem)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

