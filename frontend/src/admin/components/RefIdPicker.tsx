/**
 * Reference ID Picker Component
 * Scope-filtered search for prompt segment references
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { searchRefs, getRefById, type RefScope, type RefItem } from '@/services/refs';
import { toast } from 'sonner';

interface RefIdPickerProps {
  scope: RefScope;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RefIdPicker({ 
  scope, 
  value, 
  onChange, 
  placeholder,
  disabled = false 
}: RefIdPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RefItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RefItem | null>(null);

  // Load selected item when value changes
  useEffect(() => {
    if (value && !selectedItem) {
      loadSelectedItem(value);
    } else if (!value) {
      setSelectedItem(null);
    }
  }, [value]);

  const loadSelectedItem = async (id: string) => {
    try {
      const item = await getRefById(scope, id);
      setSelectedItem(item);
    } catch (error) {
      console.error('Failed to load selected item:', error);
      setSelectedItem(null);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchRefs(scope, query, 10);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search references:', error);
      toast.error('Failed to search references');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (item: RefItem) => {
    setSelectedItem(item);
    onChange(item.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleClear = () => {
    setSelectedItem(null);
    onChange(undefined);
    setSearchQuery('');
    setSearchResults([]);
  };

  const getScopeLabel = (scope: RefScope): string => {
    switch (scope) {
      case 'world': return 'World';
      case 'ruleset': return 'Ruleset';
      case 'entry': return 'Entry';
      case 'npc': return 'NPC';
      default: return scope;
    }
  };

  const getContextHelp = (scope: RefScope): string => {
    switch (scope) {
      case 'world': return 'Select a world to reference in this segment';
      case 'ruleset': return 'Select a ruleset to reference in this segment';
      case 'entry': return 'Select an entry point to reference in this segment';
      case 'npc': return 'Select an NPC to reference in this segment';
      default: return 'Select a reference for this segment';
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`ref-search-${scope}`}>
        Reference ({getScopeLabel(scope)})
      </Label>
      
      {/* Selected Item Display */}
      {selectedItem && (
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-gray-50">
          <Badge variant="secondary">{getScopeLabel(scope)}</Badge>
          <div className="flex-1">
            <div className="font-medium">{selectedItem.name}</div>
            <div className="text-sm text-gray-500">{selectedItem.slug}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Search Interface */}
      {!selectedItem && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id={`ref-search-${scope}`}
              placeholder={placeholder || `Search ${getScopeLabel(scope).toLowerCase()}s...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="pl-10"
              disabled={disabled}
            />
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                  disabled={disabled}
                >
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.slug}</div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-4 text-gray-500">
              <p>No {getScopeLabel(scope).toLowerCase()}s found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          )}

          {/* Loading */}
          {isSearching && (
            <div className="text-center py-4 text-gray-500">
              <p>Searching...</p>
            </div>
          )}
        </div>
      )}

      {/* Context Help */}
      <p className="text-sm text-gray-600">
        {getContextHelp(scope)}
      </p>
    </div>
  );
}