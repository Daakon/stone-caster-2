/**
 * Entry Rulesets Picker Component
 * Multi-select with drag-and-drop ordering for rulesets
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, X, Search } from 'lucide-react';
import { rulesetsService, type Ruleset } from '@/services/admin.rulesets';
import { toast } from 'sonner';

interface SelectedRuleset {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface EntryRulesetsPickerProps {
  selectedRulesets: SelectedRuleset[];
  onRulesetsChange: (rulesets: SelectedRuleset[]) => void;
  disabled?: boolean;
}

export function EntryRulesetsPicker({ 
  selectedRulesets, 
  onRulesetsChange, 
  disabled = false 
}: EntryRulesetsPickerProps) {
  const [availableRulesets, setAvailableRulesets] = useState<Ruleset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Load available rulesets
  useEffect(() => {
    loadRulesets();
  }, []);

  const loadRulesets = async () => {
    try {
      setIsLoading(true);
      const rulesets = await rulesetsService.getActiveRulesets();
      setAvailableRulesets(rulesets);
    } catch (error) {
      console.error('Failed to load rulesets:', error);
      toast.error('Failed to load rulesets');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter available rulesets (exclude already selected)
  const filteredRulesets = availableRulesets.filter(ruleset => {
    const isNotSelected = !selectedRulesets.some(selected => selected.id === ruleset.id);
    const matchesSearch = ruleset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ruleset.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return isNotSelected && matchesSearch;
  });

  const addRuleset = (rulesetId: string) => {
    const ruleset = availableRulesets.find(r => r.id === rulesetId);
    if (!ruleset) return;

    const newRuleset: SelectedRuleset = {
      id: ruleset.id,
      name: ruleset.name,
      slug: ruleset.slug,
      sort_order: selectedRulesets.length
    };

    onRulesetsChange([...selectedRulesets, newRuleset]);
    setSearchQuery('');
  };

  const removeRuleset = (rulesetId: string) => {
    const updated = selectedRulesets
      .filter(r => r.id !== rulesetId)
      .map((r, index) => ({ ...r, sort_order: index }));
    onRulesetsChange(updated);
  };

  const moveRuleset = (fromIndex: number, toIndex: number) => {
    const updated = [...selectedRulesets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    
    // Update sort orders
    const reordered = updated.map((r, index) => ({ ...r, sort_order: index }));
    onRulesetsChange(reordered);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveRuleset(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rulesets</CardTitle>
        <CardDescription>
          Select and order the rulesets that will be applied to this entry point.
          Rulesets are applied in the order shown below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Add */}
        <div className="space-y-2">
          <Label htmlFor="ruleset-search">Add Ruleset</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="ruleset-search"
                placeholder="Search rulesets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={disabled}
              />
            </div>
            <Select
              value=""
              onValueChange={addRuleset}
              disabled={disabled || filteredRulesets.length === 0}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select ruleset..." />
              </SelectTrigger>
              <SelectContent>
                {filteredRulesets.map(ruleset => (
                  <SelectItem key={ruleset.id} value={ruleset.id}>
                    {ruleset.name} ({ruleset.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Rulesets */}
        {selectedRulesets.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Rulesets (drag to reorder)</Label>
            <div className="space-y-2">
              {selectedRulesets
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((ruleset, index) => (
                  <div
                    key={ruleset.id}
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`
                      flex items-center gap-3 p-3 border rounded-lg bg-gray-50
                      ${!disabled ? 'cursor-move hover:bg-gray-100' : ''}
                      ${draggedIndex === index ? 'opacity-50' : ''}
                    `}
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">{ruleset.name}</div>
                      <div className="text-sm text-gray-500">{ruleset.slug}</div>
                    </div>
                    <Badge variant="secondary">#{ruleset.sort_order + 1}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRuleset(ruleset.id)}
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {selectedRulesets.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No rulesets selected</p>
            <p className="text-sm">Add rulesets using the search above</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


